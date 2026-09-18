package logger

import (
	"net/http"
	"strings"
)

// sensitiveExactKeys 定義嚴格大小寫無關完全比對之機敏鍵名清單
// 依照 Privacy-by-Design 規範，禁止對 token_type、token_count 等業務鍵名誤判遮蔽
var sensitiveExactKeys = map[string]struct{}{
	"authorization": {},
	"password":      {},
	"token":         {},
	"access_token":  {},
	"refresh_token": {},
	"secret":        {},
	"jwt":           {},
	"api_key":       {},
	"cookie":        {},
}

const RedactedValue = "[REDACTED]"

// IsSensitiveKey 判定鍵名是否為機敏鍵名 (Case-Insensitive Exact Match)
func IsSensitiveKey(key string) bool {
	lower := strings.ToLower(strings.TrimSpace(key))
	_, found := sensitiveExactKeys[lower]
	return found
}

// SanitizeHeader 對 HTTP 標頭進行脫敏，遮蔽 Authorization 與 Cookie 等敏感資訊
func SanitizeHeader(h http.Header) map[string]string {
	sanitized := make(map[string]string)
	for k, v := range h {
		if len(v) == 0 {
			continue
		}
		lowerKey := strings.ToLower(k)
		if IsSensitiveKey(lowerKey) {
			if lowerKey == "authorization" && strings.HasPrefix(strings.ToLower(v[0]), "bearer ") {
				sanitized[k] = "Bearer " + RedactedValue
			} else {
				sanitized[k] = RedactedValue
			}
		} else {
			sanitized[k] = strings.Join(v, ", ")
		}
	}
	return sanitized
}

// SanitizeData 遞迴巡檢 Map、Slice 與巢狀結構，對所有機敏鍵值進行脫敏替換為 [REDACTED]
func SanitizeData(v any) any {
	if v == nil {
		return nil
	}

	switch val := v.(type) {
	case map[string]any:
		result := make(map[string]any, len(val))
		for k, item := range val {
			if IsSensitiveKey(k) {
				result[k] = RedactedValue
			} else {
				result[k] = SanitizeData(item)
			}
		}
		return result

	case []any:
		result := make([]any, len(val))
		for i, item := range val {
			result[i] = SanitizeData(item)
		}
		return result

	default:
		return val
	}
}
