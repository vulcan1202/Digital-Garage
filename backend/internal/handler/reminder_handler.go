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

type ReminderHandler struct {
	repo *repository.ReminderRepository
}

func NewReminderHandler(repo *repository.ReminderRepository) *ReminderHandler {
	return &ReminderHandler{repo: repo}
}

func (h *ReminderHandler) List(w http.ResponseWriter, r *http.Request) {
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

	reminders, err := h.repo.ListReminders(r.Context(), userID, vehicleID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此車輛或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, reminders)
}

func (h *ReminderHandler) Create(w http.ResponseWriter, r *http.Request) {
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

	var req model.CreateReminderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "請求資料格式錯誤")
		return
	}

	if strings.TrimSpace(req.ItemName) == "" {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "請填寫提醒項目名稱")
		return
	}

	hasKm := req.IntervalKm != nil && *req.IntervalKm > 0
	hasMonths := req.IntervalMonths != nil && *req.IntervalMonths > 0
	if !hasKm && !hasMonths {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "保養週期必須至少指定「公里數」或「月份」其中一項為正整數")
		return
	}

	if req.BaseMileage != nil && *req.BaseMileage < 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "基準里程不得為負數")
		return
	}

	reminder, err := h.repo.CreateReminder(r.Context(), userID, vehicleID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此車輛或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, reminder)
}

func (h *ReminderHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	idStr := chi.URLParam(r, "id")
	reminderID, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的提醒識別碼")
		return
	}

	var req model.UpdateReminderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "請求資料格式錯誤")
		return
	}

	if req.ItemName != nil && strings.TrimSpace(*req.ItemName) == "" {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "提醒項目名稱不得為空")
		return
	}

	if req.IntervalKm != nil && req.IntervalMonths != nil {
		hasKm := *req.IntervalKm > 0
		hasMonths := *req.IntervalMonths > 0
		if !hasKm && !hasMonths {
			response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "保養週期必須至少指定「公里數」或「月份」其中一項為正整數")
			return
		}
	}

	if req.BaseMileage != nil && *req.BaseMileage < 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "基準里程不得為負數")
		return
	}

	reminder, err := h.repo.UpdateReminder(r.Context(), userID, reminderID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此提醒或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, reminder)
}

func (h *ReminderHandler) Complete(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	idStr := chi.URLParam(r, "id")
	reminderID, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的提醒識別碼")
		return
	}

	var req model.CompleteReminderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "請求資料格式錯誤")
		return
	}

	if req.CompletedMileage < 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "完成里程不得為負數")
		return
	}
	if strings.TrimSpace(req.CompletedDate) == "" {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "完成日期不得為空")
		return
	}

	reminder, err := h.repo.CompleteReminder(r.Context(), userID, reminderID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此提醒或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, reminder)
}

func (h *ReminderHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	idStr := chi.URLParam(r, "id")
	reminderID, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的提醒識別碼")
		return
	}

	err = h.repo.DeleteReminder(r.Context(), userID, reminderID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此提醒或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.NoContent(w)
}

func (h *ReminderHandler) SyncBase(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	var req model.SyncReminderBaseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "請求資料格式錯誤")
		return
	}

	err = h.repo.SyncBaseFromMaintenance(r.Context(), userID, req.MaintenanceRecordID, req.Mileage, req.Date)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此工單或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
