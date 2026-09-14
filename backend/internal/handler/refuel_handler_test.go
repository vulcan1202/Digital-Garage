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

func TestRefuelHandler_Unauthorized(t *testing.T) {
	h := NewRefuelHandler(nil)

	reqList := httptest.NewRequest(http.MethodGet, "/vehicles/1/refuels", nil)
	wList := httptest.NewRecorder()
	h.List(wList, reqList)
	if wList.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", wList.Code)
	}

	reqPost := httptest.NewRequest(http.MethodPost, "/vehicles/1/refuels", nil)
	wPost := httptest.NewRecorder()
	h.Create(wPost, reqPost)
	if wPost.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", wPost.Code)
	}

	reqPatch := httptest.NewRequest(http.MethodPatch, "/refuels/1", nil)
	wPatch := httptest.NewRecorder()
	h.Update(wPatch, reqPatch)
	if wPatch.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", wPatch.Code)
	}

	reqDel := httptest.NewRequest(http.MethodDelete, "/refuels/1", nil)
	wDel := httptest.NewRecorder()
	h.Delete(wDel, reqDel)
	if wDel.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", wDel.Code)
	}
}
