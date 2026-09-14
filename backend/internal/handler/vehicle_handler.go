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
		response.DatabaseError(w, err)
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
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, vehicle)
}

func isValidVehicleType(vt string) bool {
	return vt == "car" || vt == "motorcycle" || vt == "other"
}

func isValidFuelType(ft string) bool {
	switch ft {
	case "gasoline_92", "gasoline_95", "gasoline_98", "diesel",
		"premium_diesel", "electric", "hybrid", "other":
		return true
	default:
		return false
	}
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

	req.VehicleType = strings.TrimSpace(req.VehicleType)
	if req.VehicleType == "" || !isValidVehicleType(req.VehicleType) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "車輛類型 (vehicle_type) 為必填且僅能為 car, motorcycle 或 other")
		return
	}

	initMileage := 0
	if req.InitialMileage != nil {
		initMileage = *req.InitialMileage
	} else if req.CurrentMileage != nil {
		initMileage = *req.CurrentMileage
	}

	if initMileage < 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "初始里程 (initial_mileage) 不得為負數")
		return
	}

	curMileage := initMileage
	if req.CurrentMileage != nil {
		curMileage = *req.CurrentMileage
	}

	if curMileage < 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "當前里程 (current_mileage) 不得為負數")
		return
	}

	if curMileage < initMileage {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "當前里程 (current_mileage) 不得小於初始里程 (initial_mileage)")
		return
	}

	if req.Year != nil && (*req.Year < 1886 || *req.Year > 2100) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "年份 (year) 必須介於 1886 至 2100 之間")
		return
	}

	if req.PurchasePrice != nil && *req.PurchasePrice < 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "購車價格 (purchase_price) 不得為負數")
		return
	}

	if req.EngineDisplacementCC != nil && *req.EngineDisplacementCC <= 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "排氣量 (engine_displacement_cc) 必須大於 0")
		return
	}

	if req.FuelType != nil {
		ft := strings.TrimSpace(*req.FuelType)
		if ft != "" && !isValidFuelType(ft) {
			response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "動力油品型態 (fuel_type) 非合法選項")
			return
		}
		if ft == "" {
			req.FuelType = nil
		} else {
			req.FuelType = &ft
		}
	}

	if req.LicensePlate != nil {
		lp := strings.TrimSpace(*req.LicensePlate)
		if lp == "" {
			req.LicensePlate = nil
		} else {
			req.LicensePlate = &lp
		}
	}

	vehicle, err := h.repo.CreateVehicle(r.Context(), userID, &req)
	if err != nil {
		response.DatabaseError(w, err)
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

	// 規則：initial_mileage 建立後不可修改，若收到欄位直接回傳 400 VALIDATION_ERROR
	if req.InitialMileage != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "初始基準里程 (initial_mileage) 建立後永久不可修改")
		return
	}

	if req.Brand != nil && strings.TrimSpace(*req.Brand) == "" {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "品牌 (brand) 不得為空")
		return
	}
	if req.Model != nil && strings.TrimSpace(*req.Model) == "" {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "型號 (model) 不得為空")
		return
	}

	if req.VehicleType != nil {
		vt := strings.TrimSpace(*req.VehicleType)
		if !isValidVehicleType(vt) {
			response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "車輛類型 (vehicle_type) 必須為 car, motorcycle 或 other")
			return
		}
		req.VehicleType = &vt
	}

	if req.CurrentMileage != nil && *req.CurrentMileage < 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "當前里程 (current_mileage) 不得為負數")
		return
	}
	if req.Year != nil && (*req.Year < 1886 || *req.Year > 2100) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "年份 (year) 必須介於 1886 至 2100 之間")
		return
	}
	if req.PurchasePrice != nil && *req.PurchasePrice < 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "購車價格 (purchase_price) 不得為負數")
		return
	}
	if req.EngineDisplacementCC != nil && *req.EngineDisplacementCC <= 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "排氣量 (engine_displacement_cc) 必須大於 0")
		return
	}
	if req.FuelType != nil {
		ft := strings.TrimSpace(*req.FuelType)
		if ft != "" && !isValidFuelType(ft) {
			response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "動力油品型態 (fuel_type) 非合法選項")
			return
		}
		if ft == "" {
			req.FuelType = nil
		} else {
			req.FuelType = &ft
		}
	}
	if req.LicensePlate != nil {
		lp := strings.TrimSpace(*req.LicensePlate)
		if lp == "" {
			req.LicensePlate = nil
		} else {
			req.LicensePlate = &lp
		}
	}

	vehicle, err := h.repo.UpdateVehicle(r.Context(), userID, id, &req)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此車輛或無存取權限")
			return
		}
		response.DatabaseError(w, err)
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
		response.DatabaseError(w, err)
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
		response.DatabaseError(w, err)
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
		response.DatabaseError(w, err)
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
		response.DatabaseError(w, err)
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
		response.DatabaseError(w, err)
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
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]any{"success": true})
}

