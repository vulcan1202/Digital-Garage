package middleware

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"digital-garage-backend/internal/config"
	"digital-garage-backend/internal/response"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const UserIDKey contextKey = "user_id"

// GetUserID 從 Request Context 中提取認證之 User UUID
func GetUserID(ctx context.Context) (string, error) {
	val := ctx.Value(UserIDKey)
	if userID, ok := val.(string); ok && userID != "" {
		return userID, nil
	}
	return "", fmt.Errorf("user_id not found in context")
}

// JWKKey 定義 Supabase JWKS Key 格式
type JWKKey struct {
	Kid string `json:"kid"`
	Kty string `json:"kty"`
	Alg string `json:"alg"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
}

type JWKSResponse struct {
	Keys []JWKKey `json:"keys"`
}

// JWKSCache 快取 Supabase 公鑰
type JWKSCache struct {
	mu        sync.RWMutex
	keys      map[string]*ecdsa.PublicKey
	lastFetch time.Time
	jwksURL   string
}

func newJWKSCache(jwksURL string) *JWKSCache {
	return &JWKSCache{
		keys:    make(map[string]*ecdsa.PublicKey),
		jwksURL: jwksURL,
	}
}

func (c *JWKSCache) getKey(kid string) (*ecdsa.PublicKey, error) {
	c.mu.RLock()
	key, exists := c.keys[kid]
	recent := time.Since(c.lastFetch) < 1*time.Hour
	c.mu.RUnlock()

	if exists && recent {
		return key, nil
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	// 再次檢查是否已被其他 goroutine 刷新
	if key, exists := c.keys[kid]; exists && time.Since(c.lastFetch) < 1*time.Hour {
		return key, nil
	}

	if c.jwksURL == "" {
		return nil, fmt.Errorf("JWKS URL is not configured")
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(c.jwksURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch JWKS from %s: %w", c.jwksURL, err)
	}
	defer resp.Body.Close()

	var jwks JWKSResponse
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return nil, fmt.Errorf("failed to decode JWKS: %w", err)
	}

	for _, k := range jwks.Keys {
		if k.Kty == "EC" && k.Crv == "P-256" && k.X != "" && k.Y != "" {
			pubKey, err := parseECDSAPublicKey(k.X, k.Y)
			if err == nil {
				c.keys[k.Kid] = pubKey
			}
		}
	}
	c.lastFetch = time.Now()

	if key, ok := c.keys[kid]; ok {
		return key, nil
	}
	return nil, fmt.Errorf("key with kid %q not found in JWKS", kid)
}

func parseECDSAPublicKey(xBase64, yBase64 string) (*ecdsa.PublicKey, error) {
	xBytes, err := base64.RawURLEncoding.DecodeString(xBase64)
	if err != nil {
		return nil, fmt.Errorf("invalid x coordinate: %w", err)
	}
	yBytes, err := base64.RawURLEncoding.DecodeString(yBase64)
	if err != nil {
		return nil, fmt.Errorf("invalid y coordinate: %w", err)
	}

	return &ecdsa.PublicKey{
		Curve: elliptic.P256(),
		X:     new(big.Int).SetBytes(xBytes),
		Y:     new(big.Int).SetBytes(yBytes),
	}, nil
}

// AuthMiddleware 建立支援動態 ES256 (JWKS) 與 HS256 (Secret) 的 JWT 鑑權中間件
func AuthMiddleware(cfg *config.Config) func(http.Handler) http.Handler {
	jwksCache := newJWKSCache(cfg.JWKSEndpoint)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "缺少認證標頭 Authorization")
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "認證標頭格式須為 Bearer <token>")
				return
			}
			tokenStr := strings.TrimSpace(parts[1])

			token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
				// 根據演算法動態判定簽名金鑰
				switch t.Method.Alg() {
				case "HS256":
					if cfg.SupabaseJWTSecret == "" {
						return nil, fmt.Errorf("HS256 secret not configured")
					}
					return []byte(cfg.SupabaseJWTSecret), nil
				case "ES256":
					kid, _ := t.Header["kid"].(string)
					return jwksCache.getKey(kid)
				default:
					return nil, fmt.Errorf("unsupported signing algorithm: %s", t.Method.Alg())
				}
			})

			if err != nil || !token.Valid {
				response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "認證憑證無效或已過期")
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "無法解析 Token Claims")
				return
			}

			sub, ok := claims["sub"].(string)
			if !ok || sub == "" {
				response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "憑證中缺少使用者識別資訊 (sub)")
				return
			}

			// 寫入 Request Context 與跨中介層共享元資料
			if meta := GetRequestMetadata(r.Context()); meta != nil {
				meta.UserID = sub
			}
			ctx := context.WithValue(r.Context(), UserIDKey, sub)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
