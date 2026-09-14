package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"digital-garage-backend/internal/middleware"

	"github.com/go-chi/chi/v5"
)

func TestModificationHandler_Unauthorized(t *testing.T) {
	h := NewModificationHandler(nil)

	req := httptest.NewRequest(http.MethodGet, "/vehicles/1/modifications", nil)
	w := httptest.NewRecorder()
	h.List(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", w.Code)
	}

	reqDetails := httptest.NewRequest(http.MethodGet, "/modifications/1", nil)
	wDetails := httptest.NewRecorder()
	h.GetDetails(wDetails, reqDetails)
	if wDetails.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", wDetails.Code)
	}

	reqPost := httptest.NewRequest(http.MethodPost, "/vehicles/1/modifications", nil)
	wPost := httptest.NewRecorder()
	h.Create(wPost, reqPost)
	if wPost.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", wPost.Code)
	}

	reqPatch := httptest.NewRequest(http.MethodPatch, "/modifications/1", nil)
	wPatch := httptest.NewRecorder()
	h.Update(wPatch, reqPatch)
	if wPatch.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", wPatch.Code)
	}

	reqDel := httptest.NewRequest(http.MethodDelete, "/modifications/1", nil)
	wDel := httptest.NewRecorder()
	h.Delete(wDel, reqDel)
	if wDel.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", wDel.Code)
	}

	reqSetCurrent := httptest.NewRequest(http.MethodPut, "/modifications/1/setting-sets/2/current", nil)
	wSetCurrent := httptest.NewRecorder()
	h.SetCurrentSettingSet(wSetCurrent, reqSetCurrent)
	if wSetCurrent.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", wSetCurrent.Code)
	}
}

func TestModificationHandler_InvalidIDs(t *testing.T) {
	h := NewModificationHandler(nil)

	r := chi.NewRouter()
	r.Get("/vehicles/{vehicleId}/modifications", h.List)
	r.Get("/modifications/{id}", h.GetDetails)

	req := httptest.NewRequest(http.MethodGet, "/vehicles/abc/modifications", nil)
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-uuid-123")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request, got %d", w.Code)
	}

	reqDetails := httptest.NewRequest(http.MethodGet, "/modifications/xyz", nil)
	reqDetails = reqDetails.WithContext(ctx)

	wDetails := httptest.NewRecorder()
	r.ServeHTTP(wDetails, reqDetails)
	if wDetails.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request, got %d", wDetails.Code)
	}
}
