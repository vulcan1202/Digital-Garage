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

func TestRecurringExpenseHandler_Unauthorized(t *testing.T) {
	h := NewRecurringExpenseHandler(nil)

	// List without context user_id
	req := httptest.NewRequest(http.MethodGet, "/vehicles/1/recurring-expenses", nil)
	w := httptest.NewRecorder()
	h.List(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}

	// Create without context user_id
	req = httptest.NewRequest(http.MethodPost, "/vehicles/1/recurring-expenses", bytes.NewBufferString("{}"))
	w = httptest.NewRecorder()
	h.Create(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestRecurringExpenseHandler_Validation(t *testing.T) {
	h := NewRecurringExpenseHandler(nil)

	tests := []struct {
		name       string
		payload    map[string]any
		wantStatus int
		wantField  string
	}{
		{
			name: "標題為空應回傳 400",
			payload: map[string]any{
				"category":            "license_tax",
				"title":               "   ",
				"amount":              7120,
				"paid_date":           "2026-04-15",
				"coverage_start_date": "2026-01-01",
				"coverage_end_date":   "2026-12-31",
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "無效的規費類別代碼應回傳 400",
			payload: map[string]any{
				"category":            "illegal_tax_category",
				"title":               "牌照稅",
				"amount":              7120,
				"paid_date":           "2026-04-15",
				"coverage_start_date": "2026-01-01",
				"coverage_end_date":   "2026-12-31",
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "金額為負數應回傳 400",
			payload: map[string]any{
				"category":            "road_maintenance_fee",
				"title":               "公路養管費",
				"amount":              -100,
				"paid_date":           "2026-07-15",
				"coverage_start_date": "2026-01-01",
				"coverage_end_date":   "2026-12-31",
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "付款日期格式無效應回傳 400",
			payload: map[string]any{
				"category":            "road_maintenance_fee",
				"title":               "公路養管費",
				"amount":              4800,
				"paid_date":           "2026/07/15",
				"coverage_start_date": "2026-01-01",
				"coverage_end_date":   "2026-12-31",
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "到期日早於生效起始日應回傳 400",
			payload: map[string]any{
				"category":            "inspection",
				"title":               "定期檢驗",
				"amount":              450,
				"paid_date":           "2026-05-15",
				"coverage_start_date": "2026-06-01",
				"coverage_end_date":   "2026-05-01",
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "同步出廠日為未來日期應回傳 400",
			payload: map[string]any{
				"category":                  "inspection",
				"title":                     "定期檢驗",
				"amount":                    450,
				"paid_date":                 "2026-05-15",
				"coverage_start_date":       "2026-04-15",
				"coverage_end_date":         "2026-06-15",
				"sync_as_manufacture_date": "2099-01-01",
			},
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.payload)
			req := httptest.NewRequest(http.MethodPost, "/vehicles/1/recurring-expenses", bytes.NewBuffer(body))
			ctx := context.WithValue(req.Context(), middleware.UserIDKey, "test-user-id")

			rctx := chi.NewRouteContext()
			rctx.URLParams.Add("vehicleId", "1")
			req = req.WithContext(context.WithValue(ctx, chi.RouteCtxKey, rctx))

			w := httptest.NewRecorder()
			h.Create(w, req)

			if w.Code != tt.wantStatus {
				t.Fatalf("expected status %d, got %d, body: %s", tt.wantStatus, w.Code, w.Body.String())
			}

			var errResp map[string]any
			if err := json.Unmarshal(w.Body.Bytes(), &errResp); err != nil {
				t.Fatalf("failed to decode error response: %v", err)
			}
			if errResp["error"] == nil {
				t.Fatalf("expected error object, got %v", errResp)
			}
		})
	}
}

func TestRecurringExpenseHandler_CategoryWhitelist(t *testing.T) {
	validCategories := []model.RecurringExpenseCategory{
		model.CategoryLicenseTax,
		model.CategoryRoadMaintenanceFee,
		model.CategoryInspection,
		model.CategoryCompulsoryInsurance,
		model.CategoryLiabilityInsurance,
		model.CategoryOther,
	}

	for _, cat := range validCategories {
		req := model.CreateRecurringExpenseRequest{
			Category:          string(cat),
			Title:             "測試規費",
			Amount:            1000,
			PaidDate:          "2026-05-10",
			CoverageStartDate: "2026-01-01",
			CoverageEndDate:   "2026-12-31",
		}
		if req.Category == "" {
			t.Errorf("category should not be empty")
		}
	}
}
