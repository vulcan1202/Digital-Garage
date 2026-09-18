package model

import "time"

// RecurringExpenseCategory 週期性規費類別
type RecurringExpenseCategory string

const (
	CategoryLicenseTax          RecurringExpenseCategory = "license_tax"          // 牌照稅
	CategoryRoadMaintenanceFee  RecurringExpenseCategory = "road_maintenance_fee" // 公路使用養護安全管理費（公路養管費）
	CategoryInspection          RecurringExpenseCategory = "inspection"           // 定期檢驗 / 排氣定檢
	CategoryCompulsoryInsurance RecurringExpenseCategory = "compulsory_insurance" // 強制汽車責任保險
	CategoryLiabilityInsurance  RecurringExpenseCategory = "liability_insurance"  // 任意第三人責任險 / 車體險
	CategoryOther               RecurringExpenseCategory = "other"                // 其他規費
)

// RecurringExpense 對應 RecurringExpenses 資料表實體
type RecurringExpense struct {
	ID                int                      `json:"id"`
	VehicleID         int                      `json:"vehicle_id"`
	Category          RecurringExpenseCategory `json:"category"`
	Title             string                   `json:"title"`
	Amount            float64                  `json:"amount"`
	PaidDate          string                   `json:"paid_date"`           // YYYY-MM-DD
	CoverageStartDate string                   `json:"coverage_start_date"` // YYYY-MM-DD
	CoverageEndDate   string                   `json:"coverage_end_date"`   // YYYY-MM-DD
	Notes             *string                  `json:"notes"`
	CreatedAt         time.Time                `json:"created_at"`
	UpdatedAt         time.Time                `json:"updated_at"`
}

// CreateRecurringExpenseRequest 建立規費紀錄 Payload
type CreateRecurringExpenseRequest struct {
	Category              string  `json:"category"`
	Title                 string  `json:"title"`
	Amount                float64 `json:"amount"`
	PaidDate              string  `json:"paid_date"`
	CoverageStartDate     string  `json:"coverage_start_date"`
	CoverageEndDate       string  `json:"coverage_end_date"`
	Notes                 *string `json:"notes"`
	SyncAsManufactureDate *string `json:"sync_as_manufacture_date"` // 可選：若勾選同步設為出廠日，於同一事務內更新 Vehicles 表
}

// UpdateRecurringExpenseRequest 更新規費紀錄 Payload
type UpdateRecurringExpenseRequest struct {
	Category          *string  `json:"category"`
	Title             *string  `json:"title"`
	Amount            *float64 `json:"amount"`
	PaidDate          *string  `json:"paid_date"`
	CoverageStartDate *string  `json:"coverage_start_date"`
	CoverageEndDate   *string  `json:"coverage_end_date"`
	Notes             *string  `json:"notes"`
}

// RecurringStatusSummary 車輛當前週期項目彙整狀態（提供給儀表板與座艙）
type RecurringStatusSummary struct {
	Category        RecurringExpenseCategory `json:"category"`
	LatestRecordID  *int                     `json:"latest_record_id"`
	Title           string                   `json:"title"`
	LastPaidDate    *string                  `json:"last_paid_date"`
	CoverageEndDate *string                  `json:"coverage_end_date"`
	DaysRemaining   *int                     `json:"days_remaining"`
	Status          string                   `json:"status"` // "good", "due_soon", "overdue", "unset"
}
