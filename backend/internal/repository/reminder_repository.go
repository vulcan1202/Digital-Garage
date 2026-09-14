package repository

import (
	"context"
	"errors"
	"fmt"

	"digital-garage-backend/internal/model"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ReminderRepository struct {
	pool *pgxpool.Pool
}

func NewReminderRepository(pool *pgxpool.Pool) *ReminderRepository {
	return &ReminderRepository{pool: pool}
}

// ListReminders 取得車輛所有保養提醒 (驗證使用者車輛擁有權，依 created_at 升序)
func (r *ReminderRepository) ListReminders(ctx context.Context, userID string, vehicleID int) ([]model.Reminder, error) {
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

	query := `
		SELECT 
			id, vehicle_id, item_name, interval_km, interval_months,
			base_mileage, to_char(base_date, 'YYYY-MM-DD'),
			last_completed_mileage, to_char(last_completed_date, 'YYYY-MM-DD'),
			last_maintenance_record_id, status, created_at, updated_at
		FROM "Reminders"
		WHERE vehicle_id = $1
		ORDER BY created_at ASC;
	`
	rows, err := r.pool.Query(ctx, query, vehicleID)
	if err != nil {
		return nil, fmt.Errorf("failed to query reminders: %w", err)
	}
	defer rows.Close()

	reminders := make([]model.Reminder, 0)
	for rows.Next() {
		var rem model.Reminder
		var statusStr string
		err := rows.Scan(
			&rem.ID, &rem.VehicleID, &rem.ItemName, &rem.IntervalKm, &rem.IntervalMonths,
			&rem.BaseMileage, &rem.BaseDate,
			&rem.LastCompletedMileage, &rem.LastCompletedDate,
			&rem.LastMaintenanceRecordID, &statusStr, &rem.CreatedAt, &rem.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan reminder row: %w", err)
		}
		rem.Status = statusStr
		reminders = append(reminders, rem)
	}

	return reminders, nil
}

// CreateReminder 新增保養提醒
func (r *ReminderRepository) CreateReminder(ctx context.Context, userID string, vehicleID int, req *model.CreateReminderRequest) (*model.Reminder, error) {
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

	hasDate := req.BaseDate != nil
	var dateVal *string
	if hasDate {
		dateVal = req.BaseDate
	}

	hasCompDate := req.LastCompletedDate != nil
	var compDateVal *string
	if hasCompDate {
		compDateVal = req.LastCompletedDate
	}

	status := "active"
	if req.Status != nil && *req.Status != "" {
		status = *req.Status
	}

	insertQuery := `
		INSERT INTO "Reminders" (
			vehicle_id, item_name, interval_km, interval_months,
			base_mileage, base_date, last_completed_mileage, last_completed_date,
			last_maintenance_record_id, status, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4,
			$5, CASE WHEN $6::boolean THEN $7::date ELSE NULL END,
			$8, CASE WHEN $9::boolean THEN $10::date ELSE NULL END,
			$11, $12::reminder_status, now(), now()
		)
		RETURNING 
			id, vehicle_id, item_name, interval_km, interval_months,
			base_mileage, to_char(base_date, 'YYYY-MM-DD'),
			last_completed_mileage, to_char(last_completed_date, 'YYYY-MM-DD'),
			last_maintenance_record_id, status, created_at, updated_at;
	`

	var rem model.Reminder
	var statusStr string
	err = r.pool.QueryRow(ctx, insertQuery,
		vehicleID, req.ItemName, req.IntervalKm, req.IntervalMonths,
		req.BaseMileage, hasDate, dateVal,
		req.LastCompletedMileage, hasCompDate, compDateVal,
		req.LastMaintenanceRecordID, status,
	).Scan(
		&rem.ID, &rem.VehicleID, &rem.ItemName, &rem.IntervalKm, &rem.IntervalMonths,
		&rem.BaseMileage, &rem.BaseDate,
		&rem.LastCompletedMileage, &rem.LastCompletedDate,
		&rem.LastMaintenanceRecordID, &statusStr, &rem.CreatedAt, &rem.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to insert reminder: %w", err)
	}
	rem.Status = statusStr

	return &rem, nil
}

// UpdateReminder 更新保養提醒
func (r *ReminderRepository) UpdateReminder(ctx context.Context, userID string, reminderID int, req *model.UpdateReminderRequest) (*model.Reminder, error) {
	// 驗證擁有權
	var vehicleID int
	verifyQuery := `
		SELECT r.vehicle_id 
		FROM "Reminders" r
		JOIN "Vehicles" v ON v.id = r.vehicle_id
		WHERE r.id = $1 AND v.user_id = $2;
	`
	err := r.pool.QueryRow(ctx, verifyQuery, reminderID, userID).Scan(&vehicleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to verify reminder ownership: %w", err)
	}

	updateQuery := `
		UPDATE "Reminders"
		SET 
			item_name = COALESCE($2, item_name),
			interval_km = CASE WHEN $3::boolean THEN $4::integer ELSE interval_km END,
			interval_months = CASE WHEN $5::boolean THEN $6::integer ELSE interval_months END,
			base_mileage = CASE WHEN $7::boolean THEN $8::integer ELSE base_mileage END,
			base_date = CASE WHEN $9::boolean THEN $10::date ELSE base_date END,
			last_completed_mileage = CASE WHEN $11::boolean THEN $12::integer ELSE last_completed_mileage END,
			last_completed_date = CASE WHEN $13::boolean THEN $14::date ELSE last_completed_date END,
			last_maintenance_record_id = CASE WHEN $15::boolean THEN $16::integer ELSE last_maintenance_record_id END,
			status = CASE WHEN $17::boolean THEN $18::reminder_status ELSE status END,
			updated_at = now()
		WHERE id = $1
		RETURNING 
			id, vehicle_id, item_name, interval_km, interval_months,
			base_mileage, to_char(base_date, 'YYYY-MM-DD'),
			last_completed_mileage, to_char(last_completed_date, 'YYYY-MM-DD'),
			last_maintenance_record_id, status, created_at, updated_at;
	`

	hasKm := req.IntervalKm != nil
	hasMonths := req.IntervalMonths != nil
	hasBaseMileage := req.BaseMileage != nil
	hasBaseDate := req.BaseDate != nil
	hasLastMileage := req.LastCompletedMileage != nil
	hasLastDate := req.LastCompletedDate != nil
	hasLastRecID := req.LastMaintenanceRecordID != nil
	hasStatus := req.Status != nil

	var rem model.Reminder
	var statusStr string
	err = r.pool.QueryRow(ctx, updateQuery,
		reminderID,
		req.ItemName,
		hasKm, req.IntervalKm,
		hasMonths, req.IntervalMonths,
		hasBaseMileage, req.BaseMileage,
		hasBaseDate, req.BaseDate,
		hasLastMileage, req.LastCompletedMileage,
		hasLastDate, req.LastCompletedDate,
		hasLastRecID, req.LastMaintenanceRecordID,
		hasStatus, req.Status,
	).Scan(
		&rem.ID, &rem.VehicleID, &rem.ItemName, &rem.IntervalKm, &rem.IntervalMonths,
		&rem.BaseMileage, &rem.BaseDate,
		&rem.LastCompletedMileage, &rem.LastCompletedDate,
		&rem.LastMaintenanceRecordID, &statusStr, &rem.CreatedAt, &rem.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update reminder: %w", err)
	}
	rem.Status = statusStr

	return &rem, nil
}

// CompleteReminder 完成保養提醒 (週期基準前移)
func (r *ReminderRepository) CompleteReminder(ctx context.Context, userID string, reminderID int, req *model.CompleteReminderRequest) (*model.Reminder, error) {
	// 驗證擁有權
	var vehicleID int
	verifyQuery := `
		SELECT r.vehicle_id 
		FROM "Reminders" r
		JOIN "Vehicles" v ON v.id = r.vehicle_id
		WHERE r.id = $1 AND v.user_id = $2;
	`
	err := r.pool.QueryRow(ctx, verifyQuery, reminderID, userID).Scan(&vehicleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to verify reminder ownership: %w", err)
	}

	completeQuery := `
		UPDATE "Reminders"
		SET 
			last_completed_mileage = $2,
			last_completed_date = $3::date,
			last_maintenance_record_id = $4,
			updated_at = now()
		WHERE id = $1
		RETURNING 
			id, vehicle_id, item_name, interval_km, interval_months,
			base_mileage, to_char(base_date, 'YYYY-MM-DD'),
			last_completed_mileage, to_char(last_completed_date, 'YYYY-MM-DD'),
			last_maintenance_record_id, status, created_at, updated_at;
	`

	var rem model.Reminder
	var statusStr string
	err = r.pool.QueryRow(ctx, completeQuery,
		reminderID, req.CompletedMileage, req.CompletedDate, req.MaintenanceRecordID,
	).Scan(
		&rem.ID, &rem.VehicleID, &rem.ItemName, &rem.IntervalKm, &rem.IntervalMonths,
		&rem.BaseMileage, &rem.BaseDate,
		&rem.LastCompletedMileage, &rem.LastCompletedDate,
		&rem.LastMaintenanceRecordID, &statusStr, &rem.CreatedAt, &rem.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to complete reminder: %w", err)
	}
	rem.Status = statusStr

	return &rem, nil
}

// DeleteReminder 刪除保養提醒
func (r *ReminderRepository) DeleteReminder(ctx context.Context, userID string, reminderID int) error {
	// 驗證擁有權
	var vehicleID int
	verifyQuery := `
		SELECT r.vehicle_id 
		FROM "Reminders" r
		JOIN "Vehicles" v ON v.id = r.vehicle_id
		WHERE r.id = $1 AND v.user_id = $2;
	`
	err := r.pool.QueryRow(ctx, verifyQuery, reminderID, userID).Scan(&vehicleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("failed to verify reminder ownership: %w", err)
	}

	deleteQuery := `DELETE FROM "Reminders" WHERE id = $1;`
	tag, err := r.pool.Exec(ctx, deleteQuery, reminderID)
	if err != nil {
		return fmt.Errorf("failed to delete reminder: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

// SyncBaseFromMaintenance 當保養工單修改里程或日期時，同步更新關聯之提醒基準
func (r *ReminderRepository) SyncBaseFromMaintenance(ctx context.Context, userID string, recordID int, mileage *int, date *string) error {
	// 驗證工單所有權
	var vehicleID int
	verifyQuery := `
		SELECT m.vehicle_id 
		FROM "MaintenanceRecords" m
		JOIN "Vehicles" v ON v.id = m.vehicle_id
		WHERE m.id = $1 AND v.user_id = $2;
	`
	err := r.pool.QueryRow(ctx, verifyQuery, recordID, userID).Scan(&vehicleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("failed to verify maintenance record ownership: %w", err)
	}

	syncQuery := `
		UPDATE "Reminders"
		SET 
			base_mileage = COALESCE($2, base_mileage),
			base_date = CASE WHEN $3::boolean THEN $4::date ELSE base_date END,
			updated_at = now()
		WHERE last_maintenance_record_id = $1;
	`
	hasDate := date != nil
	_, err = r.pool.Exec(ctx, syncQuery, recordID, mileage, hasDate, date)
	if err != nil {
		return fmt.Errorf("failed to sync reminder base: %w", err)
	}

	return nil
}
