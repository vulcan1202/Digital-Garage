package response

import (
	"encoding/json"
	"log"
	"net/http"
)

// SuccessResponse 成功回應格式包裝
type SuccessResponse struct {
	Data any `json:"data"`
}

// ErrorResponse 錯誤回應格式包裝，嚴格對齊前端 AppError
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// JSON 輸出標準成功 JSON 回應
func JSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(SuccessResponse{Data: data})
}

// Error 輸出標準錯誤 JSON 回應
func Error(w http.ResponseWriter, status int, code string, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(ErrorResponse{
		Error:   code,
		Message: message,
	})
}

// DatabaseError 記錄內部真實錯誤並輸出脫敏後的 500 DATABASE_ERROR
func DatabaseError(w http.ResponseWriter, err error) {
	log.Printf("[DATABASE_ERROR] %v", err)
	Error(w, http.StatusInternalServerError, "DATABASE_ERROR", "資料庫操作異常，請稍後再試")
}

// NoContent 輸出 204 No Content
func NoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}
