package middleware

import (
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
)

var uuidV4Regex = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

func TestRequestIDMiddleware_TableCases(t *testing.T) {
	tests := []struct {
		name              string
		incomingID        string
		expectPreserved   bool
		expectedResult    string
		expectMatchUUIDv4 bool
	}{
		{
			name:              "TC-RID-01: 空字串標頭應強制重置為 UUID v4",
			incomingID:        "",
			expectPreserved:   false,
			expectMatchUUIDv4: true,
		},
		{
			name:              "TC-RID-02: 7 字元 (小於 8 字元下限) 應強制重置為 UUID v4",
			incomingID:        "abc1234",
			expectPreserved:   false,
			expectMatchUUIDv4: true,
		},
		{
			name:            "TC-RID-03: 8 字元 (下限邊界) 應保留原值",
			incomingID:      "abc12345",
			expectPreserved: true,
			expectedResult:  "abc12345",
		},
		{
			name:            "TC-RID-04: 36 字元標準 UUID v4 應保留原值",
			incomingID:      "c4b1d6f2-9f1e-4c12-8e11-5a3d0f7a2e81",
			expectPreserved: true,
			expectedResult:  "c4b1d6f2-9f1e-4c12-8e11-5a3d0f7a2e81",
		},
		{
			name:            "TC-RID-05: 64 字元 (上限邊界) 應保留原值",
			incomingID:      strings.Repeat("a", 64),
			expectPreserved: true,
			expectedResult:  strings.Repeat("a", 64),
		},
		{
			name:              "TC-RID-06: 65 字元 (超過 64 字元上限) 應強制重置為 UUID v4",
			incomingID:        strings.Repeat("a", 65),
			expectPreserved:   false,
			expectMatchUUIDv4: true,
		},
		{
			name:              "TC-RID-07: 含有 CRLF 控制字元應強制重置 (防範標頭注入)",
			incomingID:        "req_id\r\nInjected: True",
			expectPreserved:   false,
			expectMatchUUIDv4: true,
		},
		{
			name:              "TC-RID-08: 含有非法特殊字元應強制重置",
			incomingID:        "req#1234*&!",
			expectPreserved:   false,
			expectMatchUUIDv4: true,
		},
		{
			name:            "TC-RID-09: 包含底線與連字號之合法 ID 應保留",
			incomingID:      "client-trace_id-9999",
			expectPreserved: true,
			expectedResult:  "client-trace_id-9999",
		},
		{
			name:              "TC-RID-10: 包含空白字元應強制重置",
			incomingID:        "valid 123456",
			expectPreserved:   false,
			expectMatchUUIDv4: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var contextID string
			var metadataID string

			handler := RequestIDMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				contextID = GetRequestID(r.Context())
				if meta := GetRequestMetadata(r.Context()); meta != nil {
					metadataID = meta.RequestID
				}
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte("OK"))
			}))

			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			if tc.incomingID != "" {
				req.Header.Set("X-Request-ID", tc.incomingID)
			}
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			respHeaderID := rec.Header().Get("X-Request-ID")

			// 驗證 Response Header 必須存在
			if respHeaderID == "" {
				t.Fatalf("Response Header 缺少 X-Request-ID")
			}

			// 驗證 Context 取得的 ID 必須與 Response Header 完全一致
			if contextID != respHeaderID {
				t.Errorf("Context ID (%s) 與 Response Header ID (%s) 不一致", contextID, respHeaderID)
			}
			if metadataID != respHeaderID {
				t.Errorf("Metadata ID (%s) 與 Response Header ID (%s) 不一致", metadataID, respHeaderID)
			}

			if tc.expectPreserved {
				if respHeaderID != tc.expectedResult {
					t.Errorf("預期保留 ID %q，但得到 %q", tc.expectedResult, respHeaderID)
				}
			} else {
				if respHeaderID == tc.incomingID && tc.incomingID != "" {
					t.Errorf("預期重置非法 ID，但仍保留原值 %q", respHeaderID)
				}
				if tc.expectMatchUUIDv4 && !uuidV4Regex.MatchString(respHeaderID) {
					t.Errorf("重新生成之 ID %q 不符合 RFC 4122 UUID v4 格式", respHeaderID)
				}
			}
		})
	}
}
