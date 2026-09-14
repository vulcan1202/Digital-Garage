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

	t.Run("新增車輛時若缺少 vehicle_type 應回傳 400 VALIDATION_ERROR", func(t *testing.T) {
		body, _ := json.Marshal(model.CreateVehicleRequest{
			Brand:       "Yamaha",
			Model:       "MT-07",
			VehicleType: "",
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

	t.Run("新增車輛時若 vehicle_type 為非法字串應回傳 400 VALIDATION_ERROR", func(t *testing.T) {
		body, _ := json.Marshal(model.CreateVehicleRequest{
			Brand:       "Yamaha",
			Model:       "MT-07",
			VehicleType: "plane",
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

	t.Run("新增車輛時若初始里程為負數應回傳 400 VALIDATION_ERROR", func(t *testing.T) {
		negativeMileage := -100
		body, _ := json.Marshal(model.CreateVehicleRequest{
			Brand:          "Porsche",
			Model:          "911 GT3",
			VehicleType:    "car",
			InitialMileage: &negativeMileage,
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

	t.Run("新增車輛時若當前里程為負數應回傳 400 VALIDATION_ERROR", func(t *testing.T) {
		negativeMileage := -50
		body, _ := json.Marshal(model.CreateVehicleRequest{
			Brand:          "Porsche",
			Model:          "911 GT3",
			VehicleType:    "car",
			CurrentMileage: &negativeMileage,
		})
		req := httptest.NewRequest("POST", "/vehicles", bytes.NewReader(body))
		rec := httptest.NewRecorder()

		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", rec.Code)
		}
	})

	t.Run("新增車輛時若當前里程小於初始里程應回傳 400 VALIDATION_ERROR", func(t *testing.T) {
		initM := 1000
		curM := 500
		body, _ := json.Marshal(model.CreateVehicleRequest{
			Brand:          "Porsche",
			Model:          "911 GT3",
			VehicleType:    "car",
			InitialMileage: &initM,
			CurrentMileage: &curM,
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

	t.Run("新增車輛時若購車價格為負數應回傳 400 VALIDATION_ERROR", func(t *testing.T) {
		negativePrice := -100.0
		body, _ := json.Marshal(model.CreateVehicleRequest{
			Brand:         "Porsche",
			Model:         "911 GT3",
			VehicleType:   "car",
			PurchasePrice: &negativePrice,
		})
		req := httptest.NewRequest("POST", "/vehicles", bytes.NewReader(body))
		rec := httptest.NewRecorder()

		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", rec.Code)
		}
	})

	t.Run("新增車輛時若年份不合理應回傳 400 VALIDATION_ERROR", func(t *testing.T) {
		invalidYear := 1800
		body, _ := json.Marshal(model.CreateVehicleRequest{
			Brand:       "Porsche",
			Model:       "911 GT3",
			VehicleType: "car",
			Year:        &invalidYear,
		})
		req := httptest.NewRequest("POST", "/vehicles", bytes.NewReader(body))
		rec := httptest.NewRecorder()

		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", rec.Code)
		}
	})
}

func TestVehicleHandler_Update_InitialMileage_Immutable(t *testing.T) {
	h := NewVehicleHandler(nil)

	r := chi.NewRouter()
	r.Patch("/vehicles/{id}", func(w http.ResponseWriter, req *http.Request) {
		ctx := context.WithValue(req.Context(), middleware.UserIDKey, "test-user-uuid")
		h.Update(w, req.WithContext(ctx))
	})

	t.Run("更新車輛時若嘗試修改 initial_mileage 應直接回傳 400 VALIDATION_ERROR", func(t *testing.T) {
		newInit := 5000
		body, _ := json.Marshal(model.UpdateVehicleRequest{
			InitialMileage: &newInit,
		})
		req := httptest.NewRequest("PATCH", "/vehicles/1", bytes.NewReader(body))
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

func TestVehicleHandler_Unauthorized(t *testing.T) {
	h := NewVehicleHandler(nil)

	req := httptest.NewRequest(http.MethodGet, "/vehicles", nil)
	w := httptest.NewRecorder()
	h.List(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", w.Code)
	}

	reqPost := httptest.NewRequest(http.MethodPost, "/vehicles", nil)
	wPost := httptest.NewRecorder()
	h.Create(wPost, reqPost)
	if wPost.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", wPost.Code)
	}
}
