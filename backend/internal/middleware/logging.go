package middleware

import (
	"net/http"
	"time"

	"digital-garage-backend/internal/logger"
)

// responseWriterRecorder 封裝 http.ResponseWriter 以攔截記錄 HTTP 狀態碼與寫入位元組
type responseWriterRecorder struct {
	http.ResponseWriter
	status       int
	bytesWritten int64
	wroteHeader  bool
}

func (r *responseWriterRecorder) WriteHeader(statusCode int) {
	if !r.wroteHeader {
		r.status = statusCode
		r.wroteHeader = true
		r.ResponseWriter.WriteHeader(statusCode)
	}
}

func (r *responseWriterRecorder) Write(b []byte) (int, error) {
	if !r.wroteHeader {
		r.WriteHeader(http.StatusOK)
	}
	n, err := r.ResponseWriter.Write(b)
	r.bytesWritten += int64(n)
	return n, err
}

// StructuredLoggerMiddleware 記錄每一筆 API 請求之結構化日誌，輸出符合 Google Cloud Logging 規範
func StructuredLoggerMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		startTime := time.Now()

		recorder := &responseWriterRecorder{
			ResponseWriter: w,
			status:         0,
			bytesWritten:   0,
			wroteHeader:    false,
		}

		defer func() {
			duration := time.Since(startTime)

			// 若 Handler 未顯式呼叫 WriteHeader，依照 Go net/http 規範預設為 200 OK
			status := recorder.status
			if status == 0 {
				status = http.StatusOK
			}

			// 取得 Context 中的 Request ID
			reqID := GetRequestID(r.Context())

			// 自共享指標中安全提取可能由後續 AuthMiddleware 注入之 UserID
			var userID string
			if meta := GetRequestMetadata(r.Context()); meta != nil {
				userID = meta.UserID
			}
			if userID == "" {
				if u, err := GetUserID(r.Context()); err == nil {
					userID = u
				}
			}

			// 狀態碼分級規範：2xx/3xx -> INFO, 4xx -> WARNING, 5xx -> ERROR
			var severity string
			switch {
			case status >= 500:
				severity = "ERROR"
			case status >= 400:
				severity = "WARNING"
			default:
				severity = "INFO"
			}

			// 隱私設計：僅記錄安全之 URL Path，絕不記錄含有機敏資料之 Query String
			safeURL := r.URL.Path

			httpLog := &logger.HTTPRequestLog{
				RequestMethod: r.Method,
				RequestURL:    safeURL,
				Status:        status,
				ResponseSize:  recorder.bytesWritten,
				Latency:       logger.FormatLatency(duration),
			}

			logger.LogHTTPRequest(r.Context(), logger.LogEntry{
				Severity:    severity,
				Message:     "http_request",
				RequestID:   reqID,
				UserID:      userID,
				HTTPRequest: httpLog,
			})
		}()

		next.ServeHTTP(recorder, r)
	})
}
