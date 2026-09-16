package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"digital-garage-backend/internal/middleware"
	"digital-garage-backend/internal/model"
	"digital-garage-backend/internal/repository"
	"digital-garage-backend/internal/response"

	"github.com/go-chi/chi/v5"
)

type ModificationHandler struct {
	repo *repository.ModificationRepository
}

func NewModificationHandler(repo *repository.ModificationRepository) *ModificationHandler {
	return &ModificationHandler{repo: repo}
}

func (h *ModificationHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	vIDStr := chi.URLParam(r, "vehicleId")
	vehicleID, err := strconv.Atoi(vIDStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的車輛識別碼")
		return
	}

	mods, err := h.repo.ListModifications(r.Context(), userID, vehicleID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此車輛或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, mods)
}

func (h *ModificationHandler) GetDetails(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	idStr := chi.URLParam(r, "id")
	modID, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的改裝品識別碼")
		return
	}

	details, err := h.repo.GetModificationDetails(r.Context(), userID, modID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此改裝品或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, details)
}

func (h *ModificationHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	vIDStr := chi.URLParam(r, "vehicleId")
	vehicleID, err := strconv.Atoi(vIDStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的車輛識別碼")
		return
	}

	var req model.CreateModificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "請求資料格式錯誤")
		return
	}

	if strings.TrimSpace(req.ItemName) == "" {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "請填寫改裝品名稱")
		return
	}

	if strings.TrimSpace(req.Category) == "" {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "請選擇改裝品分類")
		return
	}

	if req.InstallMileage != nil && *req.InstallMileage < 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "安裝里程不得為負數")
		return
	}

	if req.PurchasePrice != nil && *req.PurchasePrice < 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "購入價格不得為負數")
		return
	}
	if req.InstallPrice != nil && *req.InstallPrice < 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "安裝工資不得為負數")
		return
	}

	mod, err := h.repo.CreateModification(r.Context(), userID, vehicleID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此車輛或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, mod)
}

func (h *ModificationHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	idStr := chi.URLParam(r, "id")
	modID, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的改裝品識別碼")
		return
	}

	var req model.UpdateModificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "請求資料格式錯誤")
		return
	}

	if req.ItemName != nil && strings.TrimSpace(*req.ItemName) == "" {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "改裝品名稱不得為空")
		return
	}

	if req.InstallMileage != nil && *req.InstallMileage < 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "安裝里程不得為負數")
		return
	}

	if req.PurchasePrice != nil && *req.PurchasePrice < 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "購入價格不得為負數")
		return
	}
	if req.InstallPrice != nil && *req.InstallPrice < 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "安裝工資不得為負數")
		return
	}

	mod, err := h.repo.UpdateModification(r.Context(), userID, modID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此改裝品或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, mod)
}

func (h *ModificationHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	idStr := chi.URLParam(r, "id")
	modID, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的改裝品識別碼")
		return
	}

	err = h.repo.DeleteModification(r.Context(), userID, modID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此改裝品或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.NoContent(w)
}

func (h *ModificationHandler) AddPhotos(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	idStr := chi.URLParam(r, "id")
	modID, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的改裝品識別碼")
		return
	}

	var req model.AddModificationPhotosRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "請求資料格式錯誤")
		return
	}

	photos, err := h.repo.AddPhotos(r.Context(), userID, modID, req.Photos)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此改裝品或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, photos)
}

func (h *ModificationHandler) DeletePhoto(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	photoIDStr := chi.URLParam(r, "photoId")
	photoID, err := strconv.Atoi(photoIDStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的照片識別碼")
		return
	}

	photoURL, err := h.repo.DeletePhoto(r.Context(), userID, photoID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此照片或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"photo_url": photoURL})
}

func (h *ModificationHandler) CreateSettingSet(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	idStr := chi.URLParam(r, "id")
	modID, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的改裝品識別碼")
		return
	}

	var req model.CreateSettingSetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "請求資料格式錯誤")
		return
	}

	if strings.TrimSpace(req.Name) == "" {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "請填寫設定組名稱")
		return
	}
	if strings.TrimSpace(req.RecordedDate) == "" {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "請填寫設定組紀錄日期")
		return
	}

	settingSet, err := h.repo.CreateSettingSet(r.Context(), userID, modID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此改裝品或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, settingSet)
}

func (h *ModificationHandler) SetCurrentSettingSet(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	idStr := chi.URLParam(r, "id")
	modID, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的改裝品識別碼")
		return
	}

	setIDStr := chi.URLParam(r, "setId")
	setID, err := strconv.Atoi(setIDStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的設定組識別碼")
		return
	}

	err = h.repo.SetCurrentSettingSet(r.Context(), userID, modID, setID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此設定組或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *ModificationHandler) UpdateSettingSet(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	modID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的改裝品識別碼")
		return
	}

	setID, err := strconv.Atoi(chi.URLParam(r, "setId"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的設定組識別碼")
		return
	}

	var req model.UpdateSettingSetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "請求資料格式錯誤")
		return
	}

	if strings.TrimSpace(req.Name) == "" {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "請填寫設定組名稱")
		return
	}
	if strings.TrimSpace(req.RecordedDate) == "" {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "請填寫設定組紀錄日期")
		return
	}

	updatedSet, err := h.repo.UpdateSettingSet(r.Context(), userID, modID, setID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此設定組或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, updatedSet)
}

func (h *ModificationHandler) DeleteSettingSet(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	modID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的改裝品識別碼")
		return
	}

	setID, err := strconv.Atoi(chi.URLParam(r, "setId"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的設定組識別碼")
		return
	}

	err = h.repo.DeleteSettingSet(r.Context(), userID, modID, setID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此設定組或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.NoContent(w)
}

func (h *ModificationHandler) CloneSettingSet(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	modID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的改裝品識別碼")
		return
	}

	setID, err := strconv.Atoi(chi.URLParam(r, "setId"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的設定組識別碼")
		return
	}

	var req model.CloneSettingSetRequest
	if r.Body != nil && r.ContentLength > 0 {
		_ = json.NewDecoder(r.Body).Decode(&req)
	}

	clonedSet, err := h.repo.CloneSettingSet(r.Context(), userID, modID, setID, req.Name)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此設定組或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, clonedSet)
}

