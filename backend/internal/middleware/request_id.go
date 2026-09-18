package middleware

import (
	"context"
	"crypto/rand"
	"fmt"
	"net/http"
	"regexp"
)

type requestContextKey string

const (
	// RequestIDKey 是 Context 中儲存 Request ID 的鍵值
	RequestIDKey requestContextKey = "request_id"
	// RequestMetadataKey 是 Context 中儲存請求元資料指針的鍵值
	RequestMetadataKey requestContextKey = "request_metadata"
)

// RequestMetadata 儲存跨中介層傳遞之請求元資料 (讓外層 Logger 的 defer 能讀取內層 AuthMiddleware 注入之 UserID)
type RequestMetadata struct {
	RequestID string
	UserID    string
}

// requestIDRegex 定義合法 Request ID 字元集：大小寫英數、底線、連字號
var requestIDRegex = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

// ValidateRequestID 依零信任原則檢驗 Client 傳入的 Request ID 是否合法 (長度 8~64 且符合字元集)
func ValidateRequestID(id string) bool {
	if len(id) < 8 || len(id) > 64 {
		return false
	}
	return requestIDRegex.MatchString(id)
}

// GenerateUUIDv4 使用 crypto/rand 產生符合 RFC 4122 之安全隨機 UUID v4
func GenerateUUIDv4() (string, error) {
	var b [16]byte
	_, err := rand.Read(b[:])
	if err != nil {
		return "", fmt.Errorf("crypto/rand read failed: %w", err)
	}

	// 設定版本 (Version 4: 0100xxxx)
	b[6] = (b[6] & 0x0f) | 0x40
	// 設定變形 (Variant RFC 4122: 10xxxxxx)
	b[8] = (b[8] & 0x3f) | 0x80

	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16]), nil
}

// MustGenerateUUIDv4 產生 UUID v4，若極端情況發生系統隨機數故障則使用 fallback
func MustGenerateUUIDv4() string {
	uuid, err := GenerateUUIDv4()
	if err != nil {
		// 極端備用 (以全 0 避免 panic，但 crypto/rand 在 Linux/macOS/Windows 不會報錯)
		return "00000000-0000-4000-8000-000000000000"
	}
	return uuid
}

// RequestIDMiddleware 提供零信任 Request Correlation ID 驗證、注入與回應機制
func RequestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		incomingID := r.Header.Get("X-Request-ID")
		var authoritativeID string

		// 零信任驗證：長度 8~64 且符合字元集才保留，否則一律以 crypto/rand 重新生成
		if ValidateRequestID(incomingID) {
			authoritativeID = incomingID
		} else {
			authoritativeID = MustGenerateUUIDv4()
		}

		// 建立跨中介層共享元資料指針
		meta := &RequestMetadata{
			RequestID: authoritativeID,
		}

		// 將 Request ID 與 Metadata 指針注入 Request Context
		ctx := context.WithValue(r.Context(), RequestIDKey, authoritativeID)
		ctx = context.WithValue(ctx, RequestMetadataKey, meta)

		// 權威輸出：在 Response Header 寫入最終採用之權威 ID
		w.Header().Set("X-Request-ID", authoritativeID)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetRequestID 自 Context 提取 Request Correlation ID
func GetRequestID(ctx context.Context) string {
	if val := ctx.Value(RequestIDKey); val != nil {
		if id, ok := val.(string); ok {
			return id
		}
	}
	if val := ctx.Value(RequestMetadataKey); val != nil {
		if meta, ok := val.(*RequestMetadata); ok && meta != nil {
			return meta.RequestID
		}
	}
	return ""
}

// GetRequestMetadata 自 Context 提取跨中介層元資料指針
func GetRequestMetadata(ctx context.Context) *RequestMetadata {
	if val := ctx.Value(RequestMetadataKey); val != nil {
		if meta, ok := val.(*RequestMetadata); ok {
			return meta
		}
	}
	return nil
}
