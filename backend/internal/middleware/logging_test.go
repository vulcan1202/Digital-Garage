package middleware

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"digital-garage-backend/internal/logger"
)

func TestStructuredLoggerAndRecovery(t *testing.T) {
	testCases := []struct {
		name             string
		handlerFunc      http.HandlerFunc
		expectedStatus   int
		expectedSeverity string
		expectedSize     int64
	}{
		{
			name: "200 OK 正常回應",
			handlerFunc: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte("hello world"))
			},
			expectedStatus:   http.StatusOK,
			expectedSeverity: "INFO",
			expectedSize:     11,
		},
		{
			name: "未顯式呼叫 WriteHeader 應預設補正為 200 OK",
			handlerFunc: func(w http.ResponseWriter, r *http.Request) {
				_, _ = w.Write([]byte("auto 200"))
			},
			expectedStatus:   http.StatusOK,
			expectedSeverity: "INFO",
			expectedSize:     8,
		},
		{
			name: "204 No Content 回應",
			handlerFunc: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusNoContent)
			},
			expectedStatus:   http.StatusNoContent,
			expectedSeverity: "INFO",
			expectedSize:     0,
		},
		{
			name: "400 Bad Request 應記錄為 WARNING",
			handlerFunc: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusBadRequest)
				_, _ = w.Write([]byte("bad request"))
			},
			expectedStatus:   http.StatusBadRequest,
			expectedSeverity: "WARNING",
			expectedSize:     11,
		},
		{
			name: "401 Unauthorized 應記錄為 WARNING",
			handlerFunc: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusUnauthorized)
			},
			expectedStatus:   http.StatusUnauthorized,
			expectedSeverity: "WARNING",
			expectedSize:     0,
		},
		{
			name: "422 Unprocessable Entity 應記錄為 WARNING",
			handlerFunc: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusUnprocessableEntity)
			},
			expectedStatus:   http.StatusUnprocessableEntity,
			expectedSeverity: "WARNING",
			expectedSize:     0,
		},
		{
			name: "500 Internal Server Error 應記錄為 ERROR",
			handlerFunc: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte("server error"))
			},
			expectedStatus:   http.StatusInternalServerError,
			expectedSeverity: "ERROR",
			expectedSize:     12,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			var logBuf bytes.Buffer
			logger.SetDefaultOutput(&logBuf)

			chain := RequestIDMiddleware(StructuredLoggerMiddleware(tc.handlerFunc))

			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.Header.Set("X-Request-ID", "test-log-req-1234")
			rec := httptest.NewRecorder()

			chain.ServeHTTP(rec, req)

			if rec.Code != tc.expectedStatus {
				t.Errorf("預期狀態碼 %d，但得到 %d", tc.expectedStatus, rec.Code)
			}

			logOutput := logBuf.String()
			if logOutput == "" {
				t.Fatalf("StructuredLogger 未輸出任何日誌")
			}

			// 驗證輸出為合法單行 JSON
			var parsedLog map[string]any
			if err := json.Unmarshal([]byte(strings.TrimSpace(logOutput)), &parsedLog); err != nil {
				t.Fatalf("日誌非合法 JSON 格式: %v\n原文: %s", err, logOutput)
			}

			if parsedLog["severity"] != tc.expectedSeverity {
				t.Errorf("預期 severity=%s，但得到 %v", tc.expectedSeverity, parsedLog["severity"])
			}
			if parsedLog["request_id"] != "test-log-req-1234" {
				t.Errorf("預期 request_id=test-log-req-1234，但得到 %v", parsedLog["request_id"])
			}

			httpReq, ok := parsedLog["httpRequest"].(map[string]any)
			if !ok {
				t.Fatalf("日誌缺少 httpRequest 結構")
			}

			if int(httpReq["status"].(float64)) != tc.expectedStatus {
				t.Errorf("httpRequest.status 預期 %d，但得到 %v", tc.expectedStatus, httpReq["status"])
			}
			if int64(httpReq["responseSize"].(float64)) != tc.expectedSize {
				t.Errorf("httpRequest.responseSize 預期 %d，但得到 %v", tc.expectedSize, httpReq["responseSize"])
			}

			latencyStr, ok := httpReq["latency"].(string)
			if !ok || !strings.HasSuffix(latencyStr, "s") {
				t.Errorf("httpRequest.latency 格式不符合秒數字串帶 s 後綴 (例如 0.125s): %v", latencyStr)
			}
		})
	}
}

func TestRecoveryMiddleware_CapturesPanic(t *testing.T) {
	var logBuf bytes.Buffer
	logger.SetDefaultOutput(&logBuf)

	panicHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("database connection pool exhausted")
	})

	chain := RequestIDMiddleware(StructuredLoggerMiddleware(RecoveryMiddleware(panicHandler)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/panic-endpoint", nil)
	req.Header.Set("X-Request-ID", "panic-trace-req-8888")
	rec := httptest.NewRecorder()

	// 確保不產生 unhandled panic 導致進程中斷
	chain.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("Panic 發生時預期回應 500，但得到 %d", rec.Code)
	}

	var respBody map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&respBody); err != nil {
		t.Fatalf("500 回應非合法 JSON: %v", err)
	}

	if respBody["error"] != "INTERNAL_ERROR" {
		t.Errorf("預期錯誤代碼 INTERNAL_ERROR，得到 %v", respBody["error"])
	}

	// 檢查用戶端回應絕對不得包含 stack trace 或資料庫錯誤原文
	if strings.Contains(rec.Body.String(), "database connection pool") || strings.Contains(rec.Body.String(), "goroutine") {
		t.Errorf("500 回應中外洩了後端內部堆疊或異常原文")
	}

	// 驗證後端日誌確實有記錄含有堆疊之 ERROR
	logOutput := logBuf.String()
	if !strings.Contains(logOutput, "panic-trace-req-8888") {
		t.Errorf("Panic 日誌缺少 request_id")
	}
	if !strings.Contains(logOutput, "ERROR") {
		t.Errorf("Panic 日誌 severity 未標示為 ERROR")
	}
}
