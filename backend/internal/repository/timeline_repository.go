package repository

import (
	"context"
	"errors"
	"fmt"

	"digital-garage-backend/internal/model"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TimelineRepository struct {
	pool *pgxpool.Pool
}

func NewTimelineRepository(pool *pgxpool.Pool) *TimelineRepository {
	return &TimelineRepository{pool: pool}
}

// GetVehicleTimeline 依車輛 ID 與分頁參數查詢 vehicle_timeline View
func (r *TimelineRepository) GetVehicleTimeline(ctx context.Context, userID string, vehicleID int, limit int, offset int) ([]model.TimelineEvent, error) {
	// 驗證車輛擁有權
	var vID int
	verifyQuery := `SELECT id FROM "Vehicles" WHERE id = $1 AND user_id = $2;`
	err := r.pool.QueryRow(ctx, verifyQuery, vehicleID, userID).Scan(&vID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to verify vehicle ownership: %w", err)
	}

	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	query := `
		SELECT 
			vehicle_id, event_type, event_id,
			to_char(event_date, 'YYYY-MM-DD'),
			mileage, cost, title, description, created_at
		FROM vehicle_timeline
		WHERE vehicle_id = $1
		ORDER BY event_date DESC, mileage DESC NULLS LAST, created_at DESC, event_id DESC
		LIMIT $2 OFFSET $3;
	`
	rows, err := r.pool.Query(ctx, query, vehicleID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query vehicle_timeline view: %w", err)
	}
	defer rows.Close()

	events := make([]model.TimelineEvent, 0)
	for rows.Next() {
		var e model.TimelineEvent
		err := rows.Scan(
			&e.VehicleID, &e.EventType, &e.EventID,
			&e.EventDate,
			&e.Mileage, &e.Cost, &e.Title, &e.Description, &e.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan timeline event row: %w", err)
		}
		events = append(events, e)
	}

	return events, nil
}
