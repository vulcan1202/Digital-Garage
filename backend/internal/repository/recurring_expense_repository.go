package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"digital-garage-backend/internal/model"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RecurringExpenseRepository struct {
	pool *pgxpool.Pool
}

func NewRecurringExpenseRepository(pool *pgxpool.Pool) *RecurringExpenseRepository {
	return &RecurringExpenseRepository{pool: pool}
}

// verifyVehicleOwnership 內部輔助函式：確認車輛是否存在且隸屬於該使用者
func (r *RecurringExpenseRepository) verifyVehicleOwnership(ctx context.Context, userID string, vehicleID int) error {
	var dummy int
	err := r.pool.QueryRow(ctx, `SELECT id FROM "Vehicles" WHERE id = $1 AND user_id = $2;`, vehicleID, userID).Scan(&dummy)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("failed to verify vehicle ownership: %w", err)
	}
	return nil
}

// ListByVehicleID 取得指定車輛之所有週期規費紀錄（可依 category 篩選）
func (r *RecurringExpenseRepository) ListByVehicleID(ctx context.Context, userID string, vehicleID int, category string) ([]model.RecurringExpense, error) {
	if err := r.verifyVehicleOwnership(ctx, userID, vehicleID); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			id, vehicle_id, category, title, amount,
			to_char(paid_date, 'YYYY-MM-DD') AS paid_date,
			to_char(coverage_start_date, 'YYYY-MM-DD') AS coverage_start_date,
			to_char(coverage_end_date, 'YYYY-MM-DD') AS coverage_end_date,
			notes, created_at, updated_at
		FROM "RecurringExpenses"
		WHERE vehicle_id = $1 AND ($2 = '' OR category::text = $2)
		ORDER BY coverage_end_date DESC, paid_date DESC, id DESC;
	`

	rows, err := r.pool.Query(ctx, query, vehicleID, category)
	if err != nil {
		return nil, fmt.Errorf("failed to query recurring expenses: %w", err)
	}
	defer rows.Close()

	var items []model.RecurringExpense
	for rows.Next() {
		var item model.RecurringExpense
		err := rows.Scan(
			&item.ID, &item.VehicleID, &item.Category, &item.Title, &item.Amount,
			&item.PaidDate, &item.CoverageStartDate, &item.CoverageEndDate,
			&item.Notes, &item.CreatedAt, &item.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan recurring expense: %w", err)
		}
		items = append(items, item)
	}

	if items == nil {
		items = []model.RecurringExpense{}
	}
	return items, nil
}

// GetByID 依 ID 取得單筆週期規費紀錄
func (r *RecurringExpenseRepository) GetByID(ctx context.Context, userID string, id int) (*model.RecurringExpense, error) {
	query := `
		SELECT 
			re.id, re.vehicle_id, re.category, re.title, re.amount,
			to_char(re.paid_date, 'YYYY-MM-DD') AS paid_date,
			to_char(re.coverage_start_date, 'YYYY-MM-DD') AS coverage_start_date,
			to_char(re.coverage_end_date, 'YYYY-MM-DD') AS coverage_end_date,
			re.notes, re.created_at, re.updated_at
		FROM "RecurringExpenses" re
		JOIN "Vehicles" v ON v.id = re.vehicle_id
		WHERE re.id = $1 AND v.user_id = $2;
	`

	var item model.RecurringExpense
	err := r.pool.QueryRow(ctx, query, id, userID).Scan(
		&item.ID, &item.VehicleID, &item.Category, &item.Title, &item.Amount,
		&item.PaidDate, &item.CoverageStartDate, &item.CoverageEndDate,
		&item.Notes, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to query recurring expense by id: %w", err)
	}

	return &item, nil
}

// Create 新增規費紀錄。若指定 SyncAsManufactureDate，於單一 pgx.Tx 交易內同步更新 Vehicles 出廠日
func (r *RecurringExpenseRepository) Create(ctx context.Context, userID string, vehicleID int, req *model.CreateRecurringExpenseRequest) (*model.RecurringExpense, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. 鎖定並校驗車輛所有權
	var vID int
	err = tx.QueryRow(ctx, `SELECT id FROM "Vehicles" WHERE id = $1 AND user_id = $2 FOR UPDATE;`, vehicleID, userID).Scan(&vID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to lock vehicle: %w", err)
	}

	// 2. 若勾選同步行照原發照日，更新 Vehicles 表
	if req.SyncAsRegistrationDate != nil && *req.SyncAsRegistrationDate != "" {
		updateRegQuery := `
			UPDATE "Vehicles"
			SET registration_date = $1::date, updated_at = now()
			WHERE id = $2 AND user_id = $3;
		`
		_, err = tx.Exec(ctx, updateRegQuery, *req.SyncAsRegistrationDate, vehicleID, userID)
		if err != nil {
			return nil, fmt.Errorf("failed to sync registration_date in transaction: %w", err)
		}
	} else if req.SyncAsManufactureDate != nil && *req.SyncAsManufactureDate != "" {
		// 舊版向後相容
		updateMfgQuery := `
			UPDATE "Vehicles"
			SET manufacture_date = $1::date, updated_at = now()
			WHERE id = $2 AND user_id = $3;
		`
		_, err = tx.Exec(ctx, updateMfgQuery, *req.SyncAsManufactureDate, vehicleID, userID)
		if err != nil {
			return nil, fmt.Errorf("failed to sync manufacture_date in transaction: %w", err)
		}
	}

	// 3. 寫入 RecurringExpenses 紀錄
	insertQuery := `
		INSERT INTO "RecurringExpenses" (
			vehicle_id, category, title, amount, paid_date, coverage_start_date, coverage_end_date, notes
		) VALUES ($1, $2::recurring_expense_category, $3, $4, $5::date, $6::date, $7::date, $8)
		RETURNING 
			id, vehicle_id, category, title, amount,
			to_char(paid_date, 'YYYY-MM-DD'),
			to_char(coverage_start_date, 'YYYY-MM-DD'),
			to_char(coverage_end_date, 'YYYY-MM-DD'),
			notes, created_at, updated_at;
	`

	var item model.RecurringExpense
	err = tx.QueryRow(ctx, insertQuery,
		vehicleID, req.Category, req.Title, req.Amount, req.PaidDate,
		req.CoverageStartDate, req.CoverageEndDate, req.Notes,
	).Scan(
		&item.ID, &item.VehicleID, &item.Category, &item.Title, &item.Amount,
		&item.PaidDate, &item.CoverageStartDate, &item.CoverageEndDate,
		&item.Notes, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to insert recurring expense: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return &item, nil
}

// Update 更新規費紀錄
func (r *RecurringExpenseRepository) Update(ctx context.Context, userID string, id int, req *model.UpdateRecurringExpenseRequest) (*model.RecurringExpense, error) {
	query := `
		UPDATE "RecurringExpenses" re
		SET 
			category = CASE WHEN $3::boolean THEN $4::recurring_expense_category ELSE re.category END,
			title = COALESCE($5, re.title),
			amount = COALESCE($6, re.amount),
			paid_date = CASE WHEN $7::boolean THEN $8::date ELSE re.paid_date END,
			coverage_start_date = CASE WHEN $9::boolean THEN $10::date ELSE re.coverage_start_date END,
			coverage_end_date = CASE WHEN $11::boolean THEN $12::date ELSE re.coverage_end_date END,
			notes = CASE WHEN $13::boolean THEN $14::text ELSE re.notes END,
			updated_at = now()
		FROM "Vehicles" v
		WHERE re.id = $1 AND re.vehicle_id = v.id AND v.user_id = $2
		RETURNING 
			re.id, re.vehicle_id, re.category, re.title, re.amount,
			to_char(re.paid_date, 'YYYY-MM-DD'),
			to_char(re.coverage_start_date, 'YYYY-MM-DD'),
			to_char(re.coverage_end_date, 'YYYY-MM-DD'),
			re.notes, re.created_at, re.updated_at;
	`

	hasCat := req.Category != nil
	var catVal *string
	if hasCat {
		catVal = req.Category
	}

	hasPaidDate := req.PaidDate != nil
	var paidDateVal *string
	if hasPaidDate {
		paidDateVal = req.PaidDate
	}

	hasStart := req.CoverageStartDate != nil
	var startVal *string
	if hasStart {
		startVal = req.CoverageStartDate
	}

	hasEnd := req.CoverageEndDate != nil
	var endVal *string
	if hasEnd {
		endVal = req.CoverageEndDate
	}

	hasNotes := req.Notes != nil
	var notesVal *string
	if hasNotes {
		notesVal = req.Notes
	}

	var item model.RecurringExpense
	err := r.pool.QueryRow(ctx, query,
		id, userID,
		hasCat, catVal,
		req.Title, req.Amount,
		hasPaidDate, paidDateVal,
		hasStart, startVal,
		hasEnd, endVal,
		hasNotes, notesVal,
	).Scan(
		&item.ID, &item.VehicleID, &item.Category, &item.Title, &item.Amount,
		&item.PaidDate, &item.CoverageStartDate, &item.CoverageEndDate,
		&item.Notes, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to update recurring expense: %w", err)
	}

	return &item, nil
}

// Delete 刪除規費紀錄
func (r *RecurringExpenseRepository) Delete(ctx context.Context, userID string, id int) error {
	query := `
		DELETE FROM "RecurringExpenses" re
		USING "Vehicles" v
		WHERE re.id = $1 AND re.vehicle_id = v.id AND v.user_id = $2;
	`
	tag, err := r.pool.Exec(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("failed to delete recurring expense: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// GetLatestStatusSummary 取得指定車輛在各項週期類別之最新涵蓋與到期狀態
func (r *RecurringExpenseRepository) GetLatestStatusSummary(ctx context.Context, userID string, vehicleID int) ([]model.RecurringStatusSummary, error) {
	if err := r.verifyVehicleOwnership(ctx, userID, vehicleID); err != nil {
		return nil, err
	}

	categories := []struct {
		cat   model.RecurringExpenseCategory
		title string
	}{
		{model.CategoryLicenseTax, "牌照稅"},
		{model.CategoryRoadMaintenanceFee, "公路使用養護安全管理費"},
		{model.CategoryInspection, "定期檢驗 / 排氣定檢"},
		{model.CategoryCompulsoryInsurance, "強制汽車責任險"},
		{model.CategoryLiabilityInsurance, "任意第三人責任險"},
	}

	summaries := make([]model.RecurringStatusSummary, 0, len(categories))
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)

	for _, c := range categories {
		query := `
			SELECT 
				id, title,
				to_char(paid_date, 'YYYY-MM-DD') AS paid_date,
				to_char(coverage_end_date, 'YYYY-MM-DD') AS coverage_end_date,
				coverage_end_date
			FROM "RecurringExpenses"
			WHERE vehicle_id = $1 AND category = $2
			ORDER BY coverage_end_date DESC, id DESC
			LIMIT 1;
		`

		var (
			recID       int
			recTitle    string
			paidDate    string
			endDateStr  string
			coverageEnd time.Time
		)

		err := r.pool.QueryRow(ctx, query, vehicleID, string(c.cat)).Scan(
			&recID, &recTitle, &paidDate, &endDateStr, &coverageEnd,
		)

		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				summaries = append(summaries, model.RecurringStatusSummary{
					Category: c.cat,
					Title:    c.title,
					Status:   "unset",
				})
				continue
			}
			return nil, fmt.Errorf("failed to query latest status for category %s: %w", c.cat, err)
		}

		daysRemaining := int(coverageEnd.Sub(today).Hours() / 24)
		status := "good"
		if daysRemaining < 0 {
			status = "overdue"
		} else if daysRemaining <= 30 {
			status = "due_soon"
		}

		summaries = append(summaries, model.RecurringStatusSummary{
			Category:        c.cat,
			LatestRecordID:  &recID,
			Title:           recTitle,
			LastPaidDate:    &paidDate,
			CoverageEndDate: &endDateStr,
			DaysRemaining:   &daysRemaining,
			Status:          status,
		})
	}

	return summaries, nil
}
