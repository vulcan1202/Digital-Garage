package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"digital-garage-backend/internal/config"

	"github.com/golang-jwt/jwt/v5"
)

func TestAuthMiddleware(t *testing.T) {
	testSecret := "test-super-secret-key-1234567890"
	cfg := &config.Config{
		SupabaseJWTSecret: testSecret,
	}
	authMW := AuthMiddleware(cfg)

	t.Run("缺少 Authorization 標頭時應回傳 401", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/vehicles", nil)
		rec := httptest.NewRecorder()

		handler := authMW(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			t.Fatal("handler should not be called")
		}))

		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected status 401, got %d", rec.Code)
		}
	})

	t.Run("無效 Token 時應回傳 401", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/vehicles", nil)
		req.Header.Set("Authorization", "Bearer invalid-token-xyz")
		rec := httptest.NewRecorder()

		handler := authMW(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			t.Fatal("handler should not be called")
		}))

		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected status 401, got %d", rec.Code)
		}
	})

	t.Run("有效 HS256 Token 應成功解析並注入 user_id 至 Context", func(t *testing.T) {
		expectedUserID := "user-uuid-12345"
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub": expectedUserID,
			"exp": time.Now().Add(1 * time.Hour).Unix(),
		})
		tokenString, err := token.SignedString([]byte(testSecret))
		if err != nil {
			t.Fatalf("failed to sign token: %v", err)
		}

		req := httptest.NewRequest("GET", "/api/v1/vehicles", nil)
		req.Header.Set("Authorization", "Bearer "+tokenString)
		rec := httptest.NewRecorder()

		called := false
		handler := authMW(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			called = true
			userID, err := GetUserID(r.Context())
			if err != nil {
				t.Fatalf("unexpected error getting user_id: %v", err)
			}
			if userID != expectedUserID {
				t.Errorf("expected user_id %s, got %s", expectedUserID, userID)
			}
			w.WriteHeader(http.StatusOK)
		}))

		handler.ServeHTTP(rec, req)
		if !called {
			t.Fatal("expected handler to be called")
		}
		if rec.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rec.Code)
		}
	})
}
