package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"digital-garage-backend/internal/middleware"
	"digital-garage-backend/internal/model"
	"digital-garage-backend/internal/repository"
	"digital-garage-backend/internal/response"

	"github.com/go-chi/chi/v5"
)

type RecurringExpenseHandler struct {
	repo *repository.RecurringExpenseRepository
}

func NewRecurringExpenseHandler(repo *repository.RecurringExpenseRepository) *RecurringExpenseHandler {
	return &RecurringExpenseHandler{repo: repo}
}

// List 取得車輛的所有規費紀錄
func (h *RecurringExpenseHandler) List(w http.ResponseWriter, r *http.Request) {
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

	category := r.URL.Query().Get("category")
	items, err := h.repo.ListByVehicleID(r.Context(), userID, vehicleID, category)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此車輛或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, items)
}

// GetByID 取得單筆規費紀錄
func (h *RecurringExpenseHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的規費紀錄識別碼")
		return
	}

	item, err := h.repo.GetByID(r.Context(), userID, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此規費紀錄或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, item)
}

// Create 新增規費紀錄
func (h *RecurringExpenseHandler) Create(w http.ResponseWriter, r *http.Request) {
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

	var req model.CreateRecurringExpenseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "INVALID_JSON", "請提供合法的 JSON 資料")
		return
	}

	// 1. Title 驗證
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" || len([]rune(req.Title)) > 100 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "標題不可為空且長度上限為 100 字元")
		return
	}

	// 2. Category 驗證
	switch model.RecurringExpenseCategory(req.Category) {
	case model.CategoryLicenseTax, model.CategoryRoadMaintenanceFee, model.CategoryInspection,
		model.CategoryCompulsoryInsurance, model.CategoryLiabilityInsurance, model.CategoryOther:
	default:
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的規費類別代碼")
		return
	}

	// 3. Amount 驗證
	if req.Amount < 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "金額不可為負數")
		return
	}

	// 4. 日期格式驗證
	_, err = time.Parse("2006-01-02", req.PaidDate)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "付款日期格式無效，須為 YYYY-MM-DD")
		return
	}

	startDate, err := time.Parse("2006-01-02", req.CoverageStartDate)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "生效起始日格式無效，須為 YYYY-MM-DD")
		return
	}

	endDate, err := time.Parse("2006-01-02", req.CoverageEndDate)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "到期截止日格式無效，須為 YYYY-MM-DD")
		return
	}

	// 5. 日期起訖邏輯校驗
	if endDate.Before(startDate) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "到期截止日不得早於生效起始日")
		return
	}

	// 6. 同步發照日驗證 (若提供)
	if req.SyncAsRegistrationDate != nil && *req.SyncAsRegistrationDate != "" {
		regDate, err := time.Parse("2006-01-02", *req.SyncAsRegistrationDate)
		if err != nil {
			response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "原發照日期格式無效，須為 YYYY-MM-DD")
			return
		}
		if regDate.After(time.Now()) {
			response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "原發照日期不可晚於當前日期")
			return
		}
	} else if req.SyncAsManufactureDate != nil && *req.SyncAsManufactureDate != "" {
		// 舊版相容
		mfgDate, err := time.Parse("2006-01-02", *req.SyncAsManufactureDate)
		if err != nil {
			response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "出廠日期格式無效，須為 YYYY-MM-DD")
			return
		}
		if mfgDate.After(time.Now()) {
			response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "出廠日期不可晚於當前日期")
			return
		}
	}

	created, err := h.repo.Create(r.Context(), userID, vehicleID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此車輛或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, created)
}

// Update 更新規費紀錄
func (h *RecurringExpenseHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的規費紀錄識別碼")
		return
	}

	var req model.UpdateRecurringExpenseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "INVALID_JSON", "請提供合法的 JSON 資料")
		return
	}

	// 驗證欄位
	if req.Title != nil {
		trimmed := strings.TrimSpace(*req.Title)
		if trimmed == "" || len([]rune(trimmed)) > 100 {
			response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "標題不可為空且長度上限為 100 字元")
			return
		}
		req.Title = &trimmed
	}

	if req.Category != nil {
		switch model.RecurringExpenseCategory(*req.Category) {
		case model.CategoryLicenseTax, model.CategoryRoadMaintenanceFee, model.CategoryInspection,
			model.CategoryCompulsoryInsurance, model.CategoryLiabilityInsurance, model.CategoryOther:
		default:
			response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的規費類別代碼")
			return
		}
	}

	if req.Amount != nil && *req.Amount < 0 {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "金額不可為負數")
		return
	}

	if req.PaidDate != nil {
		if _, err := time.Parse("2006-01-02", *req.PaidDate); err != nil {
			response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "付款日期格式無效，須為 YYYY-MM-DD")
			return
		}
	}

	var startDate, endDate time.Time
	if req.CoverageStartDate != nil {
		t, err := time.Parse("2006-01-02", *req.CoverageStartDate)
		if err != nil {
			response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "生效起始日格式無效，須為 YYYY-MM-DD")
			return
		}
		startDate = t
	}

	if req.CoverageEndDate != nil {
		t, err := time.Parse("2006-01-02", *req.CoverageEndDate)
		if err != nil {
			response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "到期截止日格式無效，須為 YYYY-MM-DD")
			return
		}
		endDate = t
	}

	if req.CoverageStartDate != nil && req.CoverageEndDate != nil {
		if endDate.Before(startDate) {
			response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "到期截止日不得早於生效起始日")
			return
		}
	}

	updated, err := h.repo.Update(r.Context(), userID, id, &req)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此規費紀錄或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, updated)
}

// Delete 刪除規費紀錄
func (h *RecurringExpenseHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "未認證的使用者")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "無效的規費紀錄識別碼")
		return
	}

	err = h.repo.Delete(r.Context(), userID, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此規費紀錄或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// GetLatestStatus 取得車輛規費與定檢項目之最新狀態摘要
func (h *RecurringExpenseHandler) GetLatestStatus(w http.ResponseWriter, r *http.Request) {
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

	summaries, err := h.repo.GetLatestStatusSummary(r.Context(), userID, vehicleID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "查無此車輛或無存取權限")
			return
		}
		response.DatabaseError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, summaries)
}
