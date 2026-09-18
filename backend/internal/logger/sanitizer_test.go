package logger

import (
	"net/http"
	"testing"
)

func TestSanitizeHeader(t *testing.T) {
	h := make(http.Header)
	h.Set("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret")
	h.Set("Cookie", "session_id=12345; user=alex")
	h.Set("Content-Type", "application/json")
	h.Set("X-Custom-Header", "allowed-value")

	sanitized := SanitizeHeader(h)

	if sanitized["Authorization"] != "Bearer [REDACTED]" {
		t.Errorf("Authorization 未正確脫敏，得到: %s", sanitized["Authorization"])
	}
	if sanitized["Cookie"] != "[REDACTED]" {
		t.Errorf("Cookie 未正確脫敏，得到: %s", sanitized["Cookie"])
	}
	if sanitized["Content-Type"] != "application/json" {
		t.Errorf("Content-Type 應被保留，得到: %s", sanitized["Content-Type"])
	}
	if sanitized["X-Custom-Header"] != "allowed-value" {
		t.Errorf("X-Custom-Header 應被保留，得到: %s", sanitized["X-Custom-Header"])
	}
}

func TestSanitizeData_NestedAndEdgeCases(t *testing.T) {
	input := map[string]any{
		"user_id":      "usr-100",
		"password":     "superSecret123",
		"PASSWORD":     "capsLockSecret",
		"token":        "jwt.raw.token",
		"access_token": "act-12345",
		"TOKEN_TYPE":   "Bearer", // 不得誤判遮蔽
		"token_count":  5,        // 不得誤判遮蔽
		"nested_info": map[string]any{
			"api_key":   "sk-test-9999",
			"shop_name": "馳加輪胎",
			"sub_list": []any{
				map[string]any{
					"refresh_token": "rft-7777",
					"item_name":     "機油更換",
				},
				"plain-string-item",
			},
		},
	}

	sanitized := SanitizeData(input).(map[string]any)

	// 檢查機敏欄位是否成功脫敏
	if sanitized["password"] != RedactedValue {
		t.Errorf("password 未脫敏")
	}
	if sanitized["PASSWORD"] != RedactedValue {
		t.Errorf("大小寫變更之 PASSWORD 未脫敏")
	}
	if sanitized["token"] != RedactedValue {
		t.Errorf("token 未脫敏")
	}
	if sanitized["access_token"] != RedactedValue {
		t.Errorf("access_token 未脫敏")
	}

	// 檢查業務欄位未被誤殺
	if sanitized["TOKEN_TYPE"] != "Bearer" {
		t.Errorf("TOKEN_TYPE 被誤判遮蔽，得到: %v", sanitized["TOKEN_TYPE"])
	}
	if sanitized["token_count"] != 5 {
		t.Errorf("token_count 被誤判遮蔽，得到: %v", sanitized["token_count"])
	}
	if sanitized["user_id"] != "usr-100" {
		t.Errorf("user_id 應保留")
	}

	// 檢查巢狀物件與切片
	nested := sanitized["nested_info"].(map[string]any)
	if nested["api_key"] != RedactedValue {
		t.Errorf("巢狀 api_key 未脫敏")
	}
	if nested["shop_name"] != "馳加輪胎" {
		t.Errorf("巢狀 shop_name 應被保留")
	}

	subList := nested["sub_list"].([]any)
	subMap := subList[0].(map[string]any)
	if subMap["refresh_token"] != RedactedValue {
		t.Errorf("切片內巢狀 refresh_token 未脫敏")
	}
	if subMap["item_name"] != "機油更換" {
		t.Errorf("切片內 item_name 應被保留")
	}
	if subList[1] != "plain-string-item" {
		t.Errorf("切片字串純量應被保留")
	}
}
