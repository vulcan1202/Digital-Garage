package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"digital-garage-backend/internal/middleware"

	"github.com/go-chi/chi/v5"
)

func TestReminderHandler_Unauthorized(t *testing.T) {
	h := NewReminderHandler(nil)

	req := httptest.NewRequest(http.MethodGet, "/vehicles/1/reminders", nil)
	w := httptest.NewRecorder()

	h.List(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", w.Code)
	}

	reqPost := httptest.NewRequest(http.MethodPost, "/vehicles/1/reminders", nil)
	wPost := httptest.NewRecorder()
	h.Create(wPost, reqPost)
	if wPost.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", wPost.Code)
	}

	reqPatch := httptest.NewRequest(http.MethodPatch, "/reminders/1", nil)
	wPatch := httptest.NewRecorder()
	h.Update(wPatch, reqPatch)
	if wPatch.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", wPatch.Code)
	}

	reqComplete := httptest.NewRequest(http.MethodPost, "/reminders/1/complete", nil)
	wComplete := httptest.NewRecorder()
	h.Complete(wComplete, reqComplete)
	if wComplete.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", wComplete.Code)
	}

	reqDel := httptest.NewRequest(http.MethodDelete, "/reminders/1", nil)
	wDel := httptest.NewRecorder()
	h.Delete(wDel, reqDel)
	if wDel.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", wDel.Code)
	}
}

func TestReminderHandler_InvalidVehicleID(t *testing.T) {
	h := NewReminderHandler(nil)

	r := chi.NewRouter()
	r.Get("/vehicles/{vehicleId}/reminders", h.List)

	req := httptest.NewRequest(http.MethodGet, "/vehicles/abc/reminders", nil)
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-uuid-123")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request, got %d", w.Code)
	}
}
