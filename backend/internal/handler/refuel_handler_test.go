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

func TestRefuelHandler_Validation(t *testing.T) {
	h := NewRefuelHandler(nil)

	r := chi.NewRouter()
	r.Post("/vehicles/{vehicleId}/refuels", func(w http.ResponseWriter, req *http.Request) {
		ctx := context.WithValue(req.Context(), middleware.UserIDKey, "test-user-uuid")
		h.Create(w, req.WithContext(ctx))
	})

	t.Run("若加油日期為空應回傳 400 VALIDATION_ERROR", func(t *testing.T) {
		body, _ := json.Marshal(model.CreateRefuelRequest{
			RefuelDate: "",
			Mileage:    1000,
			Volume:     30,
			TotalCost:  1000,
			FuelType:   "gasoline_95",
		})
		req := httptest.NewRequest("POST", "/vehicles/1/refuels", bytes.NewReader(body))
		rec := httptest.NewRecorder()

		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", rec.Code)
		}
	})

	t.Run("若加油量小於等於 0 應回傳 400 VALIDATION_ERROR", func(t *testing.T) {
		body, _ := json.Marshal(model.CreateRefuelRequest{
			RefuelDate: "2026-09-14",
			Mileage:    1000,
			Volume:     0,
			TotalCost:  1000,
			FuelType:   "gasoline_95",
		})
		req := httptest.NewRequest("POST", "/vehicles/1/refuels", bytes.NewReader(body))
		rec := httptest.NewRecorder()

		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", rec.Code)
		}
	})

	t.Run("若里程數為負數應回傳 400 VALIDATION_ERROR", func(t *testing.T) {
		body, _ := json.Marshal(model.CreateRefuelRequest{
			RefuelDate: "2026-09-14",
			Mileage:    -10,
			Volume:     30,
			TotalCost:  1000,
			FuelType:   "gasoline_95",
		})
		req := httptest.NewRequest("POST", "/vehicles/1/refuels", bytes.NewReader(body))
		rec := httptest.NewRecorder()

		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", rec.Code)
		}
	})
}
