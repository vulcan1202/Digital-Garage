package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"digital-garage-backend/internal/middleware"
	"digital-garage-backend/internal/response"

	"github.com/go-chi/chi/v5"
)

func TestAnalyticsHandler_Unauthorized(t *testing.T) {
	h := NewAnalyticsHandler(nil)

	req := httptest.NewRequest(http.MethodGet, "/vehicles/1/analytics/cost", nil)
	w := httptest.NewRecorder()
	h.GetCostAnalytics(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", w.Code)
	}
}

func TestAnalyticsHandler_Validation(t *testing.T) {
	h := NewAnalyticsHandler(nil)

	r := chi.NewRouter()
	r.Get("/vehicles/{vehicleId}/analytics/cost", h.GetCostAnalytics)

	tests := []struct {
		name       string
		targetURL  string
		wantStatus int
		wantCode   string
	}{
		{
			name:       "無效的車輛識別碼 (非數字)",
			targetURL:  "/vehicles/abc/analytics/cost",
			wantStatus: http.StatusBadRequest,
			wantCode:   "VALIDATION_ERROR",
		},
		{
			name:       "months 小於 1 (0)",
			targetURL:  "/vehicles/1/analytics/cost?months=0",
			wantStatus: http.StatusBadRequest,
			wantCode:   "VALIDATION_ERROR",
		},
		{
			name:       "months 大於 24 (25)",
			targetURL:  "/vehicles/1/analytics/cost?months=25",
			wantStatus: http.StatusBadRequest,
			wantCode:   "VALIDATION_ERROR",
		},
		{
			name:       "months 為非整數文字 (xyz)",
			targetURL:  "/vehicles/1/analytics/cost?months=xyz",
			wantStatus: http.StatusBadRequest,
			wantCode:   "VALIDATION_ERROR",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tt.targetURL, nil)
			ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-uuid-123")
			req = req.WithContext(ctx)

			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("got status %d, want %d", w.Code, tt.wantStatus)
			}

			var errResp response.ErrorResponse
			if err := json.NewDecoder(w.Body).Decode(&errResp); err != nil {
				t.Fatalf("failed to decode response: %v", err)
			}
			if errResp.Error != tt.wantCode {
				t.Errorf("got error code %s, want %s", errResp.Error, tt.wantCode)
			}
		})
	}
}
