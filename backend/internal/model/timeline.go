package model

import "time"

// TimelineEvent 對應資料庫 vehicle_timeline View
type TimelineEvent struct {
	VehicleID   int       `json:"vehicle_id"`
	EventType   string    `json:"event_type"` // "refuel" | "maintenance" | "repair" | "modification"
	EventID     int       `json:"event_id"`
	EventDate   string    `json:"event_date"` // YYYY-MM-DD
	Mileage     int       `json:"mileage"`
	Cost        float64   `json:"cost"`
	Title       string    `json:"title"`
	Description *string   `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}
