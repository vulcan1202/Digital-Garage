package model

import "time"

// Vehicle 對應資料庫 Vehicles 資料表
type Vehicle struct {
	ID             int       `json:"id"`
	UserID         string    `json:"user_id"`
	Brand          string    `json:"brand"`
	Model          string    `json:"model"`
	Year           *int      `json:"year"`
	PurchaseDate   *string   `json:"purchase_date"` // YYYY-MM-DD
	InitialMileage int       `json:"initial_mileage"`
	CurrentMileage int       `json:"current_mileage"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// VehiclePhoto 對應資料庫 VehiclePhotos 資料表
type VehiclePhoto struct {
	ID        int       `json:"id"`
	VehicleID int       `json:"vehicle_id"`
	URL       string    `json:"url"`
	SortOrder int       `json:"sort_order"`
	IsCover   bool      `json:"is_cover"`
	CreatedAt time.Time `json:"created_at"`
}

// VehicleWithCover 車輛聚合封面照片之回傳結構，對齊前端 VehicleWithCover
type VehicleWithCover struct {
	ID             int       `json:"id"`
	UserID         string    `json:"user_id"`
	Brand          string    `json:"brand"`
	Model          string    `json:"model"`
	Year           *int      `json:"year"`
	PurchaseDate   *string   `json:"purchase_date"`
	InitialMileage int       `json:"initial_mileage"`
	CurrentMileage int       `json:"current_mileage"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	CoverURL       *string   `json:"cover_url"`
}

// VehicleWithPhotos 車輛與所有關聯照片之結構，對齊前端 getVehicleById
type VehicleWithPhotos struct {
	Vehicle
	Photos []VehiclePhoto `json:"photos"`
}

// CreateVehicleRequest 新增車輛之請求 Payload
type CreateVehicleRequest struct {
	Brand          string  `json:"brand"`
	Model          string  `json:"model"`
	Year           *int    `json:"year"`
	PurchaseDate   *string `json:"purchase_date"`
	InitialMileage *int    `json:"initial_mileage"`
	CurrentMileage *int    `json:"current_mileage"`
}

// UpdateVehicleRequest 更新車輛之請求 Payload
type UpdateVehicleRequest struct {
	Brand          *string `json:"brand"`
	Model          *string `json:"model"`
	Year           *int    `json:"year"`
	PurchaseDate   *string `json:"purchase_date"`
	InitialMileage *int    `json:"initial_mileage"`
	CurrentMileage *int    `json:"current_mileage"`
}

// AddPhotoRequest 新增相片之請求 Payload
type AddPhotoRequest struct {
	URL       string `json:"url"`
	SortOrder *int   `json:"sort_order"`
	IsCover   *bool  `json:"is_cover"`
}
