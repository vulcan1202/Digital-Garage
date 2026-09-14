package model

import "time"

// Reminder 對應資料庫 Reminders 資料表
type Reminder struct {
	ID                      int       `json:"id"`
	VehicleID               int       `json:"vehicle_id"`
	ItemName                string    `json:"item_name"`
	IntervalKm              *int      `json:"interval_km"`
	IntervalMonths          *int      `json:"interval_months"`
	BaseMileage             *int      `json:"base_mileage"`
	BaseDate                *string   `json:"base_date"` // YYYY-MM-DD
	LastCompletedMileage    *int      `json:"last_completed_mileage"`
	LastCompletedDate       *string   `json:"last_completed_date"` // YYYY-MM-DD
	LastMaintenanceRecordID *int      `json:"last_maintenance_record_id"`
	Status                  string    `json:"status"` // "active" | "paused"
	CreatedAt               time.Time `json:"created_at"`
	UpdatedAt               time.Time `json:"updated_at"`
}

// CreateReminderRequest 新增提醒之請求 Payload
type CreateReminderRequest struct {
	ItemName                string  `json:"item_name"`
	IntervalKm              *int    `json:"interval_km"`
	IntervalMonths          *int    `json:"interval_months"`
	BaseMileage             *int    `json:"base_mileage"`
	BaseDate                *string `json:"base_date"`
	LastCompletedMileage    *int    `json:"last_completed_mileage"`
	LastCompletedDate       *string `json:"last_completed_date"`
	LastMaintenanceRecordID *int    `json:"last_maintenance_record_id"`
	Status                  *string `json:"status"`
}

// UpdateReminderRequest 更新提醒之請求 Payload
type UpdateReminderRequest struct {
	ItemName                *string `json:"item_name"`
	IntervalKm              *int    `json:"interval_km"`
	IntervalMonths          *int    `json:"interval_months"`
	BaseMileage             *int    `json:"base_mileage"`
	BaseDate                *string `json:"base_date"`
	LastCompletedMileage    *int    `json:"last_completed_mileage"`
	LastCompletedDate       *string `json:"last_completed_date"`
	LastMaintenanceRecordID *int    `json:"last_maintenance_record_id"`
	Status                  *string `json:"status"`
}

// CompleteReminderRequest 完成保養提醒之請求 Payload (週期基準前移)
type CompleteReminderRequest struct {
	CompletedMileage    int    `json:"completed_mileage"`
	CompletedDate       string `json:"completed_date"` // YYYY-MM-DD
	MaintenanceRecordID *int   `json:"maintenance_record_id"`
}

// SyncReminderBaseRequest 當工單更新時同步提醒之請求 Payload
type SyncReminderBaseRequest struct {
	MaintenanceRecordID int     `json:"maintenance_record_id"`
	Mileage             *int    `json:"mileage"`
	Date                *string `json:"date"`
}
