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

type RefuelHandler struct {
	repo *repository.RefuelRepository
}

func NewRefuelHandler(repo *repository.RefuelRepository) *RefuelHandler {
	return &RefuelHandler{repo: repo}
}

func (h *RefuelHandler) List(w http.ResponseWriter, r *http.Request) {
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

	refuels, err := h.repo.ListRefuels(r.Context(), userID, vehicleID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此車輛或無存取權限")
			return
		}
		response.Error(w, http.StatusInternalServerError, "DATABASE_ERROR", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, refuels)
}

func (h *RefuelHandler) Create(w http.ResponseWriter, r *http.Request) {
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

	var req model.CreateRefuelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "請求資料格式錯誤")
		return
	}

	req.RefuelDate = strings.TrimSpace(req.RefuelDate)
	if req.RefuelDate == "" {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "加油日期 (refuel_date) 為必填")
		return
	}
	if req.Mileage < 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "里程數 (mileage) 不得為負數")
		return
	}
	if req.Volume <= 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "加油量 (volume) 必須大於 0")
		return
	}
	if req.TotalCost < 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "總金額 (total_cost) 不得為負數")
		return
	}
	req.FuelType = strings.TrimSpace(req.FuelType)
	if req.FuelType == "" {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "油品種類 (fuel_type) 為必填")
		return
	}

	refuel, err := h.repo.CreateRefuel(r.Context(), userID, vehicleID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此車輛或無存取權限")
			return
		}
		response.Error(w, http.StatusInternalServerError, "DATABASE_ERROR", err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, refuel)
}

func (h *RefuelHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	idStr := chi.URLParam(r, "id")
	refuelID, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的加油紀錄識別碼")
		return
	}

	var req model.UpdateRefuelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "請求資料格式錯誤")
		return
	}

	if req.Mileage != nil && *req.Mileage < 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "里程數不得為負數")
		return
	}
	if req.Volume != nil && *req.Volume <= 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "加油量必須大於 0")
		return
	}
	if req.TotalCost != nil && *req.TotalCost < 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "總金額不得為負數")
		return
	}

	refuel, err := h.repo.UpdateRefuel(r.Context(), userID, refuelID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此紀錄或無存取權限")
			return
		}
		response.Error(w, http.StatusInternalServerError, "DATABASE_ERROR", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, refuel)
}

func (h *RefuelHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	idStr := chi.URLParam(r, "id")
	refuelID, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的加油紀錄識別碼")
		return
	}

	err = h.repo.DeleteRefuel(r.Context(), userID, refuelID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此紀錄或無存取權限")
			return
		}
		response.Error(w, http.StatusInternalServerError, "DATABASE_ERROR", err.Error())
		return
	}

	response.NoContent(w)
}
