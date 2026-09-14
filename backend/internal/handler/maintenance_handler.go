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

type MaintenanceHandler struct {
	repo *repository.MaintenanceRepository
}

func NewMaintenanceHandler(repo *repository.MaintenanceRepository) *MaintenanceHandler {
	return &MaintenanceHandler{repo: repo}
}

func (h *MaintenanceHandler) List(w http.ResponseWriter, r *http.Request) {
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

	records, err := h.repo.ListMaintenance(r.Context(), userID, vehicleID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此車輛或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, records)
}

func (h *MaintenanceHandler) Create(w http.ResponseWriter, r *http.Request) {
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

	var req model.CreateMaintenanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "請求資料格式錯誤")
		return
	}

	req.RecordType = strings.TrimSpace(req.RecordType)
	if req.RecordType != "maintenance" && req.RecordType != "repair" {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "工單類型 (record_type) 必須為 maintenance 或 repair")
		return
	}

	req.ItemName = strings.TrimSpace(req.ItemName)
	if req.ItemName == "" {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "施作項目 (item_name) 為必填")
		return
	}

	req.ServiceDate = strings.TrimSpace(req.ServiceDate)
	if req.ServiceDate == "" {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "保修日期 (service_date) 為必填")
		return
	}

	if req.Mileage < 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "里程數 (mileage) 不得為負數")
		return
	}

	if req.Cost < 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "費用金額 (cost) 不得為負數")
		return
	}

	record, err := h.repo.CreateMaintenanceWithPhotos(r.Context(), userID, vehicleID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此車輛或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, record)
}

func (h *MaintenanceHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	idStr := chi.URLParam(r, "id")
	recordID, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的工單識別碼")
		return
	}

	var req model.UpdateMaintenanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "請求資料格式錯誤")
		return
	}

	if req.RecordType != nil && *req.RecordType != "maintenance" && *req.RecordType != "repair" {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "工單類型必須為 maintenance 或 repair")
		return
	}

	if req.Mileage != nil && *req.Mileage < 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "里程數不得為負數")
		return
	}

	if req.Cost != nil && *req.Cost < 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "費用金額不得為負數")
		return
	}

	record, err := h.repo.UpdateMaintenance(r.Context(), userID, recordID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此工單或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, record)
}

func (h *MaintenanceHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	idStr := chi.URLParam(r, "id")
	recordID, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的工單識別碼")
		return
	}

	err = h.repo.DeleteMaintenance(r.Context(), userID, recordID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此工單或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.NoContent(w)
}

func (h *MaintenanceHandler) AddPhotos(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	idStr := chi.URLParam(r, "id")
	recordID, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的工單識別碼")
		return
	}

	var req model.AddPhotosRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "請求資料格式錯誤")
		return
	}

	if len(req.PhotoURLs) == 0 {
		response.JSON(w, http.StatusOK, []model.MaintenancePhoto{})
		return
	}

	photos, err := h.repo.AddPhotos(r.Context(), userID, recordID, req.PhotoURLs)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此工單或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, photos)
}

func (h *MaintenanceHandler) DeletePhoto(w http.ResponseWriter, r *http.Request) {
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

	response.JSON(w, http.StatusOK, model.DeletePhotoResponse{PhotoURL: photoURL})
}
