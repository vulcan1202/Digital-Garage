package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
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

func TestModificationHandler_SettingSets_Unauthorized(t *testing.T) {
	h := NewModificationHandler(nil)

	// CreateSettingSet
	reqCreate := httptest.NewRequest(http.MethodPost, "/modifications/1/setting-sets", nil)
	wCreate := httptest.NewRecorder()
	h.CreateSettingSet(wCreate, reqCreate)
	if wCreate.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", wCreate.Code)
	}

	// UpdateSettingSet
	reqUpdate := httptest.NewRequest(http.MethodPatch, "/modifications/1/setting-sets/2", nil)
	wUpdate := httptest.NewRecorder()
	h.UpdateSettingSet(wUpdate, reqUpdate)
	if wUpdate.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", wUpdate.Code)
	}

	// DeleteSettingSet
	reqDelete := httptest.NewRequest(http.MethodDelete, "/modifications/1/setting-sets/2", nil)
	wDelete := httptest.NewRecorder()
	h.DeleteSettingSet(wDelete, reqDelete)
	if wDelete.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", wDelete.Code)
	}

	// CloneSettingSet
	reqClone := httptest.NewRequest(http.MethodPost, "/modifications/1/setting-sets/2/clone", nil)
	wClone := httptest.NewRecorder()
	h.CloneSettingSet(wClone, reqClone)
	if wClone.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", wClone.Code)
	}
}

func TestModificationHandler_SettingSets_Validation(t *testing.T) {
	h := NewModificationHandler(nil)

	r := chi.NewRouter()
	r.Patch("/modifications/{id}/setting-sets/{setId}", h.UpdateSettingSet)

	ctx := context.WithValue(context.Background(), middleware.UserIDKey, "user-uuid-123")

	// 無效 modID
	reqInvalidMod := httptest.NewRequest(http.MethodPatch, "/modifications/abc/setting-sets/1", strings.NewReader(`{"name":"test","recorded_date":"2026-09-15"}`))
	reqInvalidMod = reqInvalidMod.WithContext(ctx)
	wInvalidMod := httptest.NewRecorder()
	r.ServeHTTP(wInvalidMod, reqInvalidMod)
	if wInvalidMod.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request, got %d", wInvalidMod.Code)
	}

	// 無效 setID
	reqInvalidSet := httptest.NewRequest(http.MethodPatch, "/modifications/1/setting-sets/xyz", strings.NewReader(`{"name":"test","recorded_date":"2026-09-15"}`))
	reqInvalidSet = reqInvalidSet.WithContext(ctx)
	wInvalidSet := httptest.NewRecorder()
	r.ServeHTTP(wInvalidSet, reqInvalidSet)
	if wInvalidSet.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request, got %d", wInvalidSet.Code)
	}

	// 空名稱
	reqEmptyName := httptest.NewRequest(http.MethodPatch, "/modifications/1/setting-sets/2", strings.NewReader(`{"name":"  ","recorded_date":"2026-09-15"}`))
	reqEmptyName = reqEmptyName.WithContext(ctx)
	wEmptyName := httptest.NewRecorder()
	r.ServeHTTP(wEmptyName, reqEmptyName)
	if wEmptyName.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request for empty name, got %d", wEmptyName.Code)
	}

	// 空紀錄日期
	reqEmptyDate := httptest.NewRequest(http.MethodPatch, "/modifications/1/setting-sets/2", strings.NewReader(`{"name":"V2","recorded_date":""}`))
	reqEmptyDate = reqEmptyDate.WithContext(ctx)
	wEmptyDate := httptest.NewRecorder()
	r.ServeHTTP(wEmptyDate, reqEmptyDate)
	if wEmptyDate.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request for empty date, got %d", wEmptyDate.Code)
	}
}

