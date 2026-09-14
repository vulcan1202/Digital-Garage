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

type TimelineHandler struct {
	repo *repository.TimelineRepository
}

func NewTimelineHandler(repo *repository.TimelineRepository) *TimelineHandler {
	return &TimelineHandler{repo: repo}
}

func (h *TimelineHandler) GetTimeline(w http.ResponseWriter, r *http.Request) {
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

	limit := 20
	if lStr := r.URL.Query().Get("limit"); lStr != "" {
		if parsedL, err := strconv.Atoi(lStr); err == nil && parsedL > 0 {
			limit = parsedL
		}
	}

	offset := 0
	if oStr := r.URL.Query().Get("offset"); oStr != "" {
		if parsedO, err := strconv.Atoi(oStr); err == nil && parsedO >= 0 {
			offset = parsedO
		}
	}

	events, err := h.repo.GetVehicleTimeline(r.Context(), userID, vehicleID, limit, offset)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此車輛或無存取權限")
			return
		}
		response.Error(w, http.StatusInternalServerError, "DATABASE_ERROR", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, events)
}
