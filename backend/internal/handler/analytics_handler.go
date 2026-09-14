package handler

import (
	"errors"
	"net/http"
	"strconv"

	"digital-garage-backend/internal/middleware"
	"digital-garage-backend/internal/repository"
	"digital-garage-backend/internal/response"

	"github.com/go-chi/chi/v5"
)

type AnalyticsHandler struct {
	repo *repository.AnalyticsRepository
}

func NewAnalyticsHandler(repo *repository.AnalyticsRepository) *AnalyticsHandler {
	return &AnalyticsHandler{repo: repo}
}

// GetCostAnalytics 查詢車輛持有與營運成本多維度分析
// GET /api/v1/vehicles/{vehicleId}/analytics/cost?months=12
func (h *AnalyticsHandler) GetCostAnalytics(w http.ResponseWriter, r *http.Request) {
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

	// 驗證 months 參數：default = 12, min = 1, max = 24
	months := 12
	if mStr := r.URL.Query().Get("months"); mStr != "" {
		parsedM, err := strconv.Atoi(mStr)
		if err != nil || parsedM < 1 || parsedM > 24 {
			response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "查詢月份 (months) 必須為 1 至 24 之間的整數")
			return
		}
		months = parsedM
	}

	analytics, err := h.repo.GetVehicleCostAnalytics(r.Context(), userID, vehicleID, months)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此車輛或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, analytics)
}
