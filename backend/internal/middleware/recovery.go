package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"runtime/debug"

	"digital-garage-backend/internal/logger"
)

// RecoveryMiddleware 攔截 Handler 執行期間之未預期 Panic，產出結構化 ERROR 日誌並回應 500
func RecoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rvr := recover(); rvr != nil {
				reqID := GetRequestID(r.Context())
				stack := string(debug.Stack())

				var userID string
				if meta := GetRequestMetadata(r.Context()); meta != nil {
					userID = meta.UserID
				}

				// 伺服器端結構化日誌記錄 Panic 堆疊
				logger.LogHTTPRequest(r.Context(), logger.LogEntry{
					Severity:   "ERROR",
					Message:    fmt.Sprintf("panic recovered: %v", rvr),
					RequestID:  reqID,
					UserID:     userID,
					StackTrace: stack,
					HTTPRequest: &logger.HTTPRequestLog{
						RequestMethod: r.Method,
						RequestURL:    r.URL.Path,
						Status:        http.StatusInternalServerError,
						ResponseSize:  0,
						Latency:       "0.000000s",
					},
				})

				// 回應用戶端安全之 500 JSON，嚴禁洩漏後端 Stack Trace
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				_ = json.NewEncoder(w).Encode(map[string]any{
					"error":   "INTERNAL_ERROR",
					"message": "伺服器內部異常，請稍後再試",
				})
			}
		}()

		next.ServeHTTP(w, r)
	})
}
