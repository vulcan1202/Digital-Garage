package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"digital-garage-backend/internal/middleware"
	"digital-garage-backend/internal/model"

	"github.com/go-chi/chi/v5"
)

func TestVehicleHandler_Validation(t *testing.T) {
	h := NewVehicleHandler(nil) // repo 不會被呼叫，因為驗證階段即攔截

	r := chi.NewRouter()
	r.Post("/vehicles", func(w http.ResponseWriter, req *http.Request) {
		// 模擬已通過 AuthMiddleware
		ctx := context.WithValue(req.Context(), middleware.UserIDKey, "test-user-uuid")
		h.Create(w, req.WithContext(ctx))
	})

	t.Run("新增車輛時若 brand 或 model 為空字串應回傳 400 VALIDATION_ERROR", func(t *testing.T) {
		body, _ := json.Marshal(model.CreateVehicleRequest{
			Brand: "",
			Model: "",
		})
		req := httptest.NewRequest("POST", "/vehicles", bytes.NewReader(body))
		rec := httptest.NewRecorder()

		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", rec.Code)
		}

		var resp map[string]string
		_ = json.NewDecoder(rec.Body).Decode(&resp)
		if resp["error"] != "VALIDATION_ERROR" {
			t.Errorf("expected error code VALIDATION_ERROR, got %s", resp["error"])
		}
	})
}
