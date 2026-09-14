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

type VehicleHandler struct {
	repo *repository.VehicleRepository
}

func NewVehicleHandler(repo *repository.VehicleRepository) *VehicleHandler {
	return &VehicleHandler{repo: repo}
}

func (h *VehicleHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.List)
	r.Post("/", h.Create)
	r.Get("/{id}", h.GetByID)
	r.Patch("/{id}", h.Update)
	r.Delete("/{id}", h.Delete)
	r.Get("/{id}/photos", h.ListPhotos)
	r.Post("/{id}/photos", h.AddPhoto)
	r.Patch("/{id}/photos/{photoId}/cover", h.SetCoverPhoto)
	r.Delete("/{id}/photos/{photoId}", h.DeletePhoto)
	r.Post("/{id}/sync-mileage", h.SyncMileage)
}

func (h *VehicleHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	vehicles, err := h.repo.ListVehicles(r.Context(), userID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "DATABASE_ERROR", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, vehicles)
}

func (h *VehicleHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的車輛識別碼")
		return
	}

	vehicle, err := h.repo.GetVehicleByID(r.Context(), userID, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此車輛或無存取權限")
			return
		}
		response.Error(w, http.StatusInternalServerError, "DATABASE_ERROR", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, vehicle)
}

func (h *VehicleHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	var req model.CreateVehicleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "請求資料格式錯誤")
		return
	}

	req.Brand = strings.TrimSpace(req.Brand)
	req.Model = strings.TrimSpace(req.Model)
	if req.Brand == "" || req.Model == "" {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "品牌 (brand) 與型號 (model) 為必填欄位")
		return
	}

	vehicle, err := h.repo.CreateVehicle(r.Context(), userID, &req)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "DATABASE_ERROR", err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, vehicle)
}

func (h *VehicleHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的車輛識別碼")
		return
	}

	var req model.UpdateVehicleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "請求資料格式錯誤")
		return
	}

	vehicle, err := h.repo.UpdateVehicle(r.Context(), userID, id, &req)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此車輛或無存取權限")
			return
		}
		response.Error(w, http.StatusInternalServerError, "DATABASE_ERROR", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, vehicle)
}

func (h *VehicleHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的車輛識別碼")
		return
	}

	err = h.repo.DeleteVehicle(r.Context(), userID, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此車輛或無存取權限")
			return
		}
		response.Error(w, http.StatusInternalServerError, "DATABASE_ERROR", err.Error())
		return
	}

	response.NoContent(w)
}

func (h *VehicleHandler) AddPhoto(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的車輛識別碼")
		return
	}

	var req model.AddPhotoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "請求資料格式錯誤")
		return
	}

	req.URL = strings.TrimSpace(req.URL)
	if req.URL == "" {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "照片網址 (url) 為必填")
		return
	}

	photo, err := h.repo.AddPhoto(r.Context(), userID, id, &req)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此車輛或無存取權限")
			return
		}
		response.Error(w, http.StatusInternalServerError, "DATABASE_ERROR", err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, photo)
}

func (h *VehicleHandler) SetCoverPhoto(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	idStr := chi.URLParam(r, "id")
	vehicleID, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的車輛識別碼")
		return
	}

	photoIDStr := chi.URLParam(r, "photoId")
	photoID, err := strconv.Atoi(photoIDStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的照片識別碼")
		return
	}

	err = h.repo.SetCoverPhoto(r.Context(), userID, vehicleID, photoID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此車輛或照片")
			return
		}
		response.Error(w, http.StatusInternalServerError, "DATABASE_ERROR", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, map[string]any{"success": true})
}

func (h *VehicleHandler) DeletePhoto(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	idStr := chi.URLParam(r, "id")
	vehicleID, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的車輛識別碼")
		return
	}

	photoIDStr := chi.URLParam(r, "photoId")
	photoID, err := strconv.Atoi(photoIDStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的照片識別碼")
		return
	}

	err = h.repo.DeletePhoto(r.Context(), userID, vehicleID, photoID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此車輛或照片")
			return
		}
		response.Error(w, http.StatusInternalServerError, "DATABASE_ERROR", err.Error())
		return
	}

	response.NoContent(w)
}

func (h *VehicleHandler) ListPhotos(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	idStr := chi.URLParam(r, "id")
	vehicleID, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的車輛識別碼")
		return
	}

	photos, err := h.repo.ListPhotos(r.Context(), userID, vehicleID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此車輛或無存取權限")
			return
		}
		response.Error(w, http.StatusInternalServerError, "DATABASE_ERROR", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, photos)
}

func (h *VehicleHandler) SyncMileage(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	idStr := chi.URLParam(r, "id")
	vehicleID, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的車輛識別碼")
		return
	}

	err = h.repo.SyncVehicleMaxMileage(r.Context(), userID, vehicleID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "DATABASE_ERROR", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, map[string]any{"success": true})
}

