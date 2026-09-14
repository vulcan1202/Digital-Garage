package model

import "time"

// Refuel 對應資料庫 Refuels 資料表
type Refuel struct {
	ID           int       `json:"id"`
	VehicleID    int       `json:"vehicle_id"`
	RefuelDate   string    `json:"refuel_date"` // YYYY-MM-DD
	Mileage      int       `json:"mileage"`
	Volume       float64   `json:"volume"`
	PricePerUnit *float64  `json:"price_per_unit"`
	TotalCost    float64   `json:"total_cost"`
	FuelType     string    `json:"fuel_type"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// CreateRefuelRequest 新增加油紀錄之請求 Payload
type CreateRefuelRequest struct {
	RefuelDate   string   `json:"refuel_date"` // YYYY-MM-DD
	Mileage      int      `json:"mileage"`
	Volume       float64  `json:"volume"`
	PricePerUnit *float64 `json:"price_per_unit"`
	TotalCost    float64  `json:"total_cost"`
	FuelType     string   `json:"fuel_type"`
}

// UpdateRefuelRequest 更新加油紀錄之請求 Payload
type UpdateRefuelRequest struct {
	RefuelDate   *string  `json:"refuel_date"`
	Mileage      *int     `json:"mileage"`
	Volume       *float64 `json:"volume"`
	PricePerUnit *float64 `json:"price_per_unit"`
	TotalCost    *float64 `json:"total_cost"`
	FuelType     *string  `json:"fuel_type"`
}
