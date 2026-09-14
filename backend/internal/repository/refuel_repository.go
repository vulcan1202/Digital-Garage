package repository

import (
	"context"
	"errors"
	"fmt"

	"digital-garage-backend/internal/model"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RefuelRepository struct {
	pool *pgxpool.Pool
}

func NewRefuelRepository(pool *pgxpool.Pool) *RefuelRepository {
	return &RefuelRepository{pool: pool}
}

// ListRefuels 查詢車輛之加油紀錄 (依日期及里程降序排序)
func (r *RefuelRepository) ListRefuels(ctx context.Context, userID string, vehicleID int) ([]model.Refuel, error) {
	// 1. 驗證車輛擁有權
	var vehicleExists bool
	err := r.pool.QueryRow(ctx, `SELECT true FROM "Vehicles" WHERE id = $1 AND user_id = $2;`, vehicleID, userID).Scan(&vehicleExists)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to verify vehicle ownership: %w", err)
	}

	query := `
		SELECT 
			id, vehicle_id, to_char(refuel_date, 'YYYY-MM-DD') AS refuel_date,
			mileage, volume, price_per_unit, total_cost, fuel_type,
			created_at, updated_at
		FROM "Refuels"
		WHERE vehicle_id = $1
		ORDER BY refuel_date DESC, mileage DESC;
	`

	rows, err := r.pool.Query(ctx, query, vehicleID)
	if err != nil {
		return nil, fmt.Errorf("failed to query refuels: %w", err)
	}
	defer rows.Close()

	var refuels []model.Refuel
	for rows.Next() {
		var rf model.Refuel
		err := rows.Scan(
			&rf.ID, &rf.VehicleID, &rf.RefuelDate,
			&rf.Mileage, &rf.Volume, &rf.PricePerUnit,
			&rf.TotalCost, &rf.FuelType, &rf.CreatedAt, &rf.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan refuel: %w", err)
		}
		refuels = append(refuels, rf)
	}

	if refuels == nil {
		refuels = []model.Refuel{}
	}
	return refuels, nil
}

// CreateRefuel 新增加油紀錄並原子同步車輛最高里程 (Transaction)
func (r *RefuelRepository) CreateRefuel(ctx context.Context, userID string, vehicleID int, req *model.CreateRefuelRequest) (*model.Refuel, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. 驗證車輛擁有權
	var vehicleExists bool
	err = tx.QueryRow(ctx, `SELECT true FROM "Vehicles" WHERE id = $1 AND user_id = $2;`, vehicleID, userID).Scan(&vehicleExists)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to verify vehicle ownership: %w", err)
	}

	// 2. 寫入加油紀錄
	insertQuery := `
		INSERT INTO "Refuels" (
			vehicle_id, refuel_date, mileage, volume, price_per_unit, total_cost, fuel_type
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, vehicle_id, to_char(refuel_date, 'YYYY-MM-DD'), mileage, volume, price_per_unit, total_cost, fuel_type, created_at, updated_at;
	`

	var rf model.Refuel
	err = tx.QueryRow(ctx, insertQuery,
		vehicleID, req.RefuelDate, req.Mileage, req.Volume, req.PricePerUnit, req.TotalCost, req.FuelType,
	).Scan(
		&rf.ID, &rf.VehicleID, &rf.RefuelDate,
		&rf.Mileage, &rf.Volume, &rf.PricePerUnit,
		&rf.TotalCost, &rf.FuelType, &rf.CreatedAt, &rf.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to insert refuel: %w", err)
	}

	// 3. SQL GREATEST 原子同步最高里程
	syncQuery := `
		UPDATE "Vehicles"
		SET current_mileage = GREATEST(
			initial_mileage,
			COALESCE((SELECT MAX(mileage) FROM "Refuels" WHERE vehicle_id = $1), 0),
			COALESCE((SELECT MAX(mileage) FROM "MaintenanceRecords" WHERE vehicle_id = $1), 0),
			COALESCE((SELECT MAX(install_mileage) FROM "Modifications" WHERE vehicle_id = $1), 0)
		),
		updated_at = now()
		WHERE id = $1 AND user_id = $2;
	`
	_, err = tx.Exec(ctx, syncQuery, vehicleID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to sync vehicle mileage: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit refuel transaction: %w", err)
	}

	return &rf, nil
}

// UpdateRefuel 更新加油紀錄並原子同步最高里程 (Transaction)
func (r *RefuelRepository) UpdateRefuel(ctx context.Context, userID string, refuelID int, req *model.UpdateRefuelRequest) (*model.Refuel, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. 驗證該紀錄確屬當前使用者所屬車輛
	var vehicleID int
	verifyQuery := `
		SELECT r.vehicle_id 
		FROM "Refuels" r
		JOIN "Vehicles" v ON v.id = r.vehicle_id
		WHERE r.id = $1 AND v.user_id = $2;
	`
	err = tx.QueryRow(ctx, verifyQuery, refuelID, userID).Scan(&vehicleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to verify refuel ownership: %w", err)
	}

	// 2. 更新資料
	updateQuery := `
		UPDATE "Refuels"
		SET 
			refuel_date = CASE WHEN $2::boolean THEN $3::date ELSE refuel_date END,
			mileage = COALESCE($4, mileage),
			volume = COALESCE($5, volume),
			price_per_unit = CASE WHEN $6::boolean THEN $7::decimal(10,2) ELSE price_per_unit END,
			total_cost = COALESCE($8, total_cost),
			fuel_type = CASE WHEN $9::boolean THEN $10::fuel_type ELSE fuel_type END,
			updated_at = now()
		WHERE id = $1
		RETURNING id, vehicle_id, to_char(refuel_date, 'YYYY-MM-DD'), mileage, volume, price_per_unit, total_cost, fuel_type, created_at, updated_at;
	`

	hasDate := req.RefuelDate != nil
	var dateVal *string
	if hasDate {
		dateVal = req.RefuelDate
	}

	hasPrice := req.PricePerUnit != nil
	var priceVal *float64
	if hasPrice {
		priceVal = req.PricePerUnit
	}

	hasFuelType := req.FuelType != nil
	var fuelTypeVal *string
	if hasFuelType {
		fuelTypeVal = req.FuelType
	}

	var rf model.Refuel
	err = tx.QueryRow(ctx, updateQuery,
		refuelID,
		hasDate, dateVal,
		req.Mileage,
		req.Volume,
		hasPrice, priceVal,
		req.TotalCost,
		hasFuelType, fuelTypeVal,
	).Scan(
		&rf.ID, &rf.VehicleID, &rf.RefuelDate,
		&rf.Mileage, &rf.Volume, &rf.PricePerUnit,
		&rf.TotalCost, &rf.FuelType, &rf.CreatedAt, &rf.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update refuel: %w", err)
	}

	// 3. SQL GREATEST 原子同步最高里程
	syncQuery := `
		UPDATE "Vehicles"
		SET current_mileage = GREATEST(
			initial_mileage,
			COALESCE((SELECT MAX(mileage) FROM "Refuels" WHERE vehicle_id = $1), 0),
			COALESCE((SELECT MAX(mileage) FROM "MaintenanceRecords" WHERE vehicle_id = $1), 0),
			COALESCE((SELECT MAX(install_mileage) FROM "Modifications" WHERE vehicle_id = $1), 0)
		),
		updated_at = now()
		WHERE id = $1 AND user_id = $2;
	`
	_, err = tx.Exec(ctx, syncQuery, vehicleID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to sync vehicle mileage: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit refuel update transaction: %w", err)
	}

	return &rf, nil
}

// DeleteRefuel 刪除加油紀錄並原子安全回滾最高里程 (Transaction)
func (r *RefuelRepository) DeleteRefuel(ctx context.Context, userID string, refuelID int) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. 查詢所屬 vehicle_id 並驗證擁有權
	var vehicleID int
	verifyQuery := `
		SELECT r.vehicle_id 
		FROM "Refuels" r
		JOIN "Vehicles" v ON v.id = r.vehicle_id
		WHERE r.id = $1 AND v.user_id = $2;
	`
	err = tx.QueryRow(ctx, verifyQuery, refuelID, userID).Scan(&vehicleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("failed to verify refuel ownership: %w", err)
	}

	// 2. 刪除紀錄
	deleteQuery := `DELETE FROM "Refuels" WHERE id = $1;`
	tag, err := tx.Exec(ctx, deleteQuery, refuelID)
	if err != nil {
		return fmt.Errorf("failed to delete refuel: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}

	// 3. SQL GREATEST 原子回滾/同步最高里程
	syncQuery := `
		UPDATE "Vehicles"
		SET current_mileage = GREATEST(
			initial_mileage,
			COALESCE((SELECT MAX(mileage) FROM "Refuels" WHERE vehicle_id = $1), 0),
			COALESCE((SELECT MAX(mileage) FROM "MaintenanceRecords" WHERE vehicle_id = $1), 0),
			COALESCE((SELECT MAX(install_mileage) FROM "Modifications" WHERE vehicle_id = $1), 0)
		),
		updated_at = now()
		WHERE id = $1 AND user_id = $2;
	`
	_, err = tx.Exec(ctx, syncQuery, vehicleID, userID)
	if err != nil {
		return fmt.Errorf("failed to sync vehicle mileage: %w", err)
	}

	return tx.Commit(ctx)
}
