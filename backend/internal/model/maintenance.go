package model

import "time"

// MaintenanceRecord 對應資料庫 MaintenanceRecords 資料表
type MaintenanceRecord struct {
	ID          int       `json:"id"`
	VehicleID   int       `json:"vehicle_id"`
	RecordType  string    `json:"record_type"` // 'maintenance' | 'repair'
	ItemName    string    `json:"item_name"`
	ServiceDate string    `json:"service_date"` // YYYY-MM-DD
	Mileage     int       `json:"mileage"`
	Cost        float64   `json:"cost"`
	ShopName    *string   `json:"shop_name"`
	Note        *string   `json:"note"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// MaintenancePhoto 對應資料庫 MaintenancePhotos 資料表
type MaintenancePhoto struct {
	ID                  int       `json:"id"`
	MaintenanceRecordID int       `json:"maintenance_record_id"`
	URL                 string    `json:"url"`
	SortOrder           int       `json:"sort_order"`
	CreatedAt           time.Time `json:"created_at"`
}

// MaintenanceRecordWithPhotos 整合保養維修紀錄與相片列表
type MaintenanceRecordWithPhotos struct {
	MaintenanceRecord
	Photos []MaintenancePhoto `json:"photos"`
}

// CreateMaintenanceRequest 新增保養維修之請求 Payload
type CreateMaintenanceRequest struct {
	RecordType  string   `json:"record_type"`
	ItemName    string   `json:"item_name"`
	ServiceDate string   `json:"service_date"`
	Mileage     int      `json:"mileage"`
	Cost        float64  `json:"cost"`
	ShopName    *string  `json:"shop_name"`
	Note        *string  `json:"note"`
	PhotoURLs   []string `json:"photo_urls"`
}

// UpdateMaintenanceRequest 更新保養維修之請求 Payload
type UpdateMaintenanceRequest struct {
	RecordType  *string  `json:"record_type"`
	ItemName    *string  `json:"item_name"`
	ServiceDate *string  `json:"service_date"`
	Mileage     *int     `json:"mileage"`
	Cost        *float64 `json:"cost"`
	ShopName    *string  `json:"shop_name"`
	Note        *string  `json:"note"`
}

// AddPhotosRequest 追加保養照片之請求 Payload
type AddPhotosRequest struct {
	PhotoURLs []string `json:"photo_urls"`
}

// DeletePhotoResponse 刪除保養照片回傳資料 (包含實體 URL 供客戶端清理 Storage)
type DeletePhotoResponse struct {
	PhotoURL string `json:"photo_url"`
}
