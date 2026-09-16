package model

import "time"

// Modification 對應資料庫 Modifications 資料表
type Modification struct {
	ID             int       `json:"id"`
	VehicleID      int       `json:"vehicle_id"`
	Brand          *string   `json:"brand"`
	ItemName       string    `json:"item_name"`
	Model          *string   `json:"model"`
	Category       string    `json:"category"` // modification_category enum
	PurchaseDate   *string   `json:"purchase_date"` // YYYY-MM-DD
	InstallDate    *string   `json:"install_date"` // YYYY-MM-DD
	InstallMileage *int      `json:"install_mileage"`
	PurchasePrice  float64   `json:"purchase_price"`
	InstallPrice   float64   `json:"install_price"`
	ShopName       *string   `json:"shop_name"`
	Note           *string   `json:"note"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// ModificationPhoto 對應資料庫 ModificationPhotos 資料表
type ModificationPhoto struct {
	ID             int       `json:"id"`
	ModificationID int       `json:"modification_id"`
	URL            string    `json:"url"`
	SortOrder      int       `json:"sort_order"`
	PhotoType      *string   `json:"photo_type"`
	CreatedAt      time.Time `json:"created_at"`
}

// ModificationSetting 對應資料庫 ModificationSettings 資料表
type ModificationSetting struct {
	ID           int       `json:"id"`
	SettingSetID int       `json:"setting_set_id"`
	SettingName  string    `json:"setting_name"`
	SettingValue string    `json:"setting_value"`
	Unit         *string   `json:"unit"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// ModificationSettingSet 對應資料庫 ModificationSettingSets 資料表
type ModificationSettingSet struct {
	ID             int                   `json:"id"`
	ModificationID int                   `json:"modification_id"`
	Name           string                `json:"name"`
	RecordedDate   string                `json:"recorded_date"` // YYYY-MM-DD
	Mileage        *int                  `json:"mileage"`
	Note           *string               `json:"note"`
	IsCurrent      bool                  `json:"is_current"`
	CreatedAt      time.Time             `json:"created_at"`
	UpdatedAt      time.Time             `json:"updated_at"`
	Settings       []ModificationSetting `json:"settings"`
}

// ModificationWithDetails 包含照片與所有調校設定組
type ModificationWithDetails struct {
	Modification
	Photos      []ModificationPhoto      `json:"photos"`
	SettingSets []ModificationSettingSet `json:"setting_sets"`
}

// CreateModificationRequest 新增改裝品之請求 Payload
type CreateModificationRequest struct {
	Brand          *string  `json:"brand"`
	ItemName       string   `json:"item_name"`
	Model          *string  `json:"model"`
	Category       string   `json:"category"`
	PurchaseDate   *string  `json:"purchase_date"`
	InstallDate    *string  `json:"install_date"`
	InstallMileage *int     `json:"install_mileage"`
	PurchasePrice  *float64 `json:"purchase_price"`
	InstallPrice   *float64 `json:"install_price"`
	ShopName       *string  `json:"shop_name"`
	Note           *string  `json:"note"`
}

// UpdateModificationRequest 更新改裝品之請求 Payload
type UpdateModificationRequest struct {
	Brand          *string  `json:"brand"`
	ItemName       *string  `json:"item_name"`
	Model          *string  `json:"model"`
	Category       *string  `json:"category"`
	PurchaseDate   *string  `json:"purchase_date"`
	InstallDate    *string  `json:"install_date"`
	InstallMileage *int     `json:"install_mileage"`
	PurchasePrice  *float64 `json:"purchase_price"`
	InstallPrice   *float64 `json:"install_price"`
	ShopName       *string  `json:"shop_name"`
	Note           *string  `json:"note"`
}

// SettingItemRequest 設定細項請求參數
type SettingItemRequest struct {
	SettingName  string  `json:"setting_name"`
	SettingValue string  `json:"setting_value"`
	Unit         *string `json:"unit"`
}

// CreateSettingSetRequest 建立設定組請求 Payload
type CreateSettingSetRequest struct {
	Name         string               `json:"name"`
	RecordedDate string               `json:"recorded_date"` // YYYY-MM-DD
	Mileage      *int                 `json:"mileage"`
	Note         *string              `json:"note"`
	IsCurrent    bool                 `json:"is_current"`
	Settings     []SettingItemRequest `json:"settings"`
}

// PhotoItemRequest 追加改裝相片請求項目
type PhotoItemRequest struct {
	URL       string  `json:"url"`
	PhotoType *string `json:"photo_type"`
}

// AddModificationPhotosRequest 追加照片請求 Payload
type AddModificationPhotosRequest struct {
	Photos []PhotoItemRequest `json:"photos"`
}

// UpdateSettingSetRequest 更新設定組請求 Payload
type UpdateSettingSetRequest struct {
	Name         string               `json:"name"`
	RecordedDate string               `json:"recorded_date"` // YYYY-MM-DD
	Mileage      *int                 `json:"mileage"`
	Note         *string              `json:"note"`
	Settings     []SettingItemRequest `json:"settings"`
}

// CloneSettingSetRequest 複製設定組請求 Payload
type CloneSettingSetRequest struct {
	Name *string `json:"name"`
}
