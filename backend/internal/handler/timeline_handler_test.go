package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"digital-garage-backend/internal/middleware"

	"github.com/go-chi/chi/v5"
)

func TestTimelineHandler_Unauthorized(t *testing.T) {
	h := NewTimelineHandler(nil)

	req := httptest.NewRequest(http.MethodGet, "/vehicles/1/timeline", nil)
	w := httptest.NewRecorder()
	h.GetTimeline(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", w.Code)
	}
}

func TestTimelineHandler_InvalidVehicleID(t *testing.T) {
	h := NewTimelineHandler(nil)

	r := chi.NewRouter()
	r.Get("/vehicles/{vehicleId}/timeline", h.GetTimeline)

	req := httptest.NewRequest(http.MethodGet, "/vehicles/invalid/timeline", nil)
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-uuid-123")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request, got %d", w.Code)
	}
}
