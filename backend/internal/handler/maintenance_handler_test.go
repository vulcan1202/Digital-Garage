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

func TestMaintenanceHandler_Validation(t *testing.T) {
	h := NewMaintenanceHandler(nil)

	r := chi.NewRouter()
	r.Post("/vehicles/{vehicleId}/maintenance", func(w http.ResponseWriter, req *http.Request) {
		ctx := context.WithValue(req.Context(), middleware.UserIDKey, "test-user-uuid")
		h.Create(w, req.WithContext(ctx))
	})

	t.Run("若 record_type 不是 maintenance 或 repair 應回傳 400 VALIDATION_ERROR", func(t *testing.T) {
		body, _ := json.Marshal(model.CreateMaintenanceRequest{
			RecordType:  "invalid_type",
			ItemName:    "更換機油",
			ServiceDate: "2026-09-14",
			Mileage:     10000,
			Cost:        2500,
		})
		req := httptest.NewRequest("POST", "/vehicles/1/maintenance", bytes.NewReader(body))
		rec := httptest.NewRecorder()

		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", rec.Code)
		}
	})

	t.Run("若 item_name 為空應回傳 400 VALIDATION_ERROR", func(t *testing.T) {
		body, _ := json.Marshal(model.CreateMaintenanceRequest{
			RecordType:  "maintenance",
			ItemName:    "",
			ServiceDate: "2026-09-14",
			Mileage:     10000,
			Cost:        2500,
		})
		req := httptest.NewRequest("POST", "/vehicles/1/maintenance", bytes.NewReader(body))
		rec := httptest.NewRecorder()

		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", rec.Code)
		}
	})

	t.Run("若費用為負數應回傳 400 VALIDATION_ERROR", func(t *testing.T) {
		body, _ := json.Marshal(model.CreateMaintenanceRequest{
			RecordType:  "maintenance",
			ItemName:    "更換機油",
			ServiceDate: "2026-09-14",
			Mileage:     10000,
			Cost:        -500,
		})
		req := httptest.NewRequest("POST", "/vehicles/1/maintenance", bytes.NewReader(body))
		rec := httptest.NewRecorder()

		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", rec.Code)
		}
	})
}
