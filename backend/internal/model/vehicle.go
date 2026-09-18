package model

import "time"

// Vehicle 對應資料庫 Vehicles 資料表
type Vehicle struct {
	ID                   int       `json:"id"`
	UserID               string    `json:"user_id"`
	Brand                string    `json:"brand"`
	Model                string    `json:"model"`
	Year                 *int      `json:"year"`
	ManufactureDate      *string   `json:"manufacture_date"` // YYYY-MM-DD
	PurchaseDate         *string   `json:"purchase_date"`    // YYYY-MM-DD
	InitialMileage       int       `json:"initial_mileage"`
	CurrentMileage       int       `json:"current_mileage"`
	VehicleType          string    `json:"vehicle_type"`
	PurchasePrice        *float64  `json:"purchase_price"`
	FuelType             *string   `json:"fuel_type"`
	EngineDisplacementCC *int      `json:"engine_displacement_cc"`
	LicensePlate         *string   `json:"license_plate"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

// VehiclePhoto 對對資料庫 VehiclePhotos 資料表
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
	ID                   int       `json:"id"`
	UserID               string    `json:"user_id"`
	Brand                string    `json:"brand"`
	Model                string    `json:"model"`
	Year                 *int      `json:"year"`
	ManufactureDate      *string   `json:"manufacture_date"`
	PurchaseDate         *string   `json:"purchase_date"`
	InitialMileage       int       `json:"initial_mileage"`
	CurrentMileage       int       `json:"current_mileage"`
	VehicleType          string    `json:"vehicle_type"`
	PurchasePrice        *float64  `json:"purchase_price"`
	FuelType             *string   `json:"fuel_type"`
	EngineDisplacementCC *int      `json:"engine_displacement_cc"`
	LicensePlate         *string   `json:"license_plate"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
	CoverURL             *string   `json:"cover_url"`
}

// VehicleWithPhotos 車輛與所有關聯照片之結構，對齊前端 getVehicleById
type VehicleWithPhotos struct {
	Vehicle
	Photos []VehiclePhoto `json:"photos"`
}

// CreateVehicleRequest 新增車輛之請求 Payload
type CreateVehicleRequest struct {
	Brand                string   `json:"brand"`
	Model                string   `json:"model"`
	VehicleType          string   `json:"vehicle_type"` // 必填：car, motorcycle, other
	Year                 *int     `json:"year"`
	ManufactureDate      *string  `json:"manufacture_date"`
	PurchaseDate         *string  `json:"purchase_date"`
	PurchasePrice        *float64 `json:"purchase_price"`
	FuelType             *string  `json:"fuel_type"`
	EngineDisplacementCC *int     `json:"engine_displacement_cc"`
	LicensePlate         *string  `json:"license_plate"`
	InitialMileage       *int     `json:"initial_mileage"`
	CurrentMileage       *int     `json:"current_mileage"`
}

// UpdateVehicleRequest 更新車輛之請求 Payload (initial_mileage 僅用於若客戶端傳入時回傳 400 驗證攔截)
type UpdateVehicleRequest struct {
	Brand                *string  `json:"brand"`
	Model                *string  `json:"model"`
	VehicleType          *string  `json:"vehicle_type"`
	Year                 *int     `json:"year"`
	ManufactureDate      *string  `json:"manufacture_date"`
	PurchaseDate         *string  `json:"purchase_date"`
	PurchasePrice        *float64 `json:"purchase_price"`
	FuelType             *string  `json:"fuel_type"`
	EngineDisplacementCC *int     `json:"engine_displacement_cc"`
	LicensePlate         *string  `json:"license_plate"`
	InitialMileage       *int     `json:"initial_mileage"` // 若非空直接報 400 不可修改
	CurrentMileage       *int     `json:"current_mileage"`
}

// AddPhotoRequest 新增相片之請求 Payload
type AddPhotoRequest struct {
	URL       string `json:"url"`
	SortOrder *int   `json:"sort_order"`
	IsCover   *bool  `json:"is_cover"`
}
