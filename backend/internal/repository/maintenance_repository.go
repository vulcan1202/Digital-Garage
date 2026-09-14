package repository

import (
	"context"
	"errors"
	"fmt"

	"digital-garage-backend/internal/model"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type MaintenanceRepository struct {
	pool *pgxpool.Pool
}

func NewMaintenanceRepository(pool *pgxpool.Pool) *MaintenanceRepository {
	return &MaintenanceRepository{pool: pool}
}

// ListMaintenance 取得車輛的所有保養維修紀錄及照片
func (r *MaintenanceRepository) ListMaintenance(ctx context.Context, userID string, vehicleID int) ([]model.MaintenanceRecordWithPhotos, error) {
	// 1. 驗證車輛擁有權
	var vehicleExists bool
	err := r.pool.QueryRow(ctx, `SELECT true FROM "Vehicles" WHERE id = $1 AND user_id = $2;`, vehicleID, userID).Scan(&vehicleExists)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to verify vehicle ownership: %w", err)
	}

	// 2. 查詢工單主表
	query := `
		SELECT 
			id, vehicle_id, record_type, item_name,
			to_char(service_date, 'YYYY-MM-DD') AS service_date,
			mileage, cost, shop_name, note, created_at, updated_at
		FROM "MaintenanceRecords"
		WHERE vehicle_id = $1
		ORDER BY service_date DESC, mileage DESC;
	`

	rows, err := r.pool.Query(ctx, query, vehicleID)
	if err != nil {
		return nil, fmt.Errorf("failed to query maintenance records: %w", err)
	}
	defer rows.Close()

	var records []model.MaintenanceRecordWithPhotos
	var recordIDs []int
	recordMap := make(map[int]int) // recordID -> slice index

	for rows.Next() {
		var mr model.MaintenanceRecord
		err := rows.Scan(
			&mr.ID, &mr.VehicleID, &mr.RecordType, &mr.ItemName,
			&mr.ServiceDate, &mr.Mileage, &mr.Cost, &mr.ShopName,
			&mr.Note, &mr.CreatedAt, &mr.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan maintenance record: %w", err)
		}
		recordMap[mr.ID] = len(records)
		recordIDs = append(recordIDs, mr.ID)
		records = append(records, model.MaintenanceRecordWithPhotos{
			MaintenanceRecord: mr,
			Photos:            []model.MaintenancePhoto{},
		})
	}

	if len(records) == 0 {
		return []model.MaintenanceRecordWithPhotos{}, nil
	}

	// 3. 查詢所有關聯照片
	photosQuery := `
		SELECT id, maintenance_record_id, url, sort_order, created_at
		FROM "MaintenancePhotos"
		WHERE maintenance_record_id = ANY($1)
		ORDER BY sort_order ASC, id ASC;
	`

	pRows, err := r.pool.Query(ctx, photosQuery, recordIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to query maintenance photos: %w", err)
	}
	defer pRows.Close()

	for pRows.Next() {
		var p model.MaintenancePhoto
		if err := pRows.Scan(&p.ID, &p.MaintenanceRecordID, &p.URL, &p.SortOrder, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan maintenance photo: %w", err)
		}
		if idx, ok := recordMap[p.MaintenanceRecordID]; ok {
			records[idx].Photos = append(records[idx].Photos, p)
		}
	}

	return records, nil
}

// CreateMaintenanceWithPhotos 建立保養維修紀錄與相片，並原子同步車輛最高里程 (Transaction)
func (r *MaintenanceRepository) CreateMaintenanceWithPhotos(
	ctx context.Context,
	userID string,
	vehicleID int,
	req *model.CreateMaintenanceRequest,
) (*model.MaintenanceRecordWithPhotos, error) {
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

	// 2. 寫入工單主表
	insertRecordQuery := `
		INSERT INTO "MaintenanceRecords" (
			vehicle_id, record_type, item_name, service_date, mileage, cost, shop_name, note
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, vehicle_id, record_type, item_name, to_char(service_date, 'YYYY-MM-DD'), mileage, cost, shop_name, note, created_at, updated_at;
	`

	var record model.MaintenanceRecord
	err = tx.QueryRow(ctx, insertRecordQuery,
		vehicleID, req.RecordType, req.ItemName, req.ServiceDate,
		req.Mileage, req.Cost, req.ShopName, req.Note,
	).Scan(
		&record.ID, &record.VehicleID, &record.RecordType, &record.ItemName,
		&record.ServiceDate, &record.Mileage, &record.Cost, &record.ShopName,
		&record.Note, &record.CreatedAt, &record.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to insert maintenance record: %w", err)
	}

	// 3. 寫入照片
	var photos []model.MaintenancePhoto
	if len(req.PhotoURLs) > 0 {
		insertPhotoQuery := `
			INSERT INTO "MaintenancePhotos" (maintenance_record_id, url, sort_order)
			VALUES ($1, $2, $3)
			RETURNING id, maintenance_record_id, url, sort_order, created_at;
		`
		for i, url := range req.PhotoURLs {
			var photo model.MaintenancePhoto
			err = tx.QueryRow(ctx, insertPhotoQuery, record.ID, url, i).Scan(
				&photo.ID, &photo.MaintenanceRecordID, &photo.URL, &photo.SortOrder, &photo.CreatedAt,
			)
			if err != nil {
				return nil, fmt.Errorf("failed to insert maintenance photo: %w", err)
			}
			photos = append(photos, photo)
		}
	}
	if photos == nil {
		photos = []model.MaintenancePhoto{}
	}

	// 4. SQL GREATEST 原子同步最高里程
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
		return nil, fmt.Errorf("failed to commit maintenance transaction: %w", err)
	}

	return &model.MaintenanceRecordWithPhotos{
		MaintenanceRecord: record,
		Photos:            photos,
	}, nil
}

// UpdateMaintenance 更新保養維修紀錄並原子同步最高里程 (Transaction)
func (r *MaintenanceRepository) UpdateMaintenance(ctx context.Context, userID string, recordID int, req *model.UpdateMaintenanceRequest) (*model.MaintenanceRecord, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. 驗證該紀錄屬於該使用者擁有的車輛
	var vehicleID int
	verifyQuery := `
		SELECT m.vehicle_id 
		FROM "MaintenanceRecords" m
		JOIN "Vehicles" v ON v.id = m.vehicle_id
		WHERE m.id = $1 AND v.user_id = $2;
	`
	err = tx.QueryRow(ctx, verifyQuery, recordID, userID).Scan(&vehicleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to verify maintenance record ownership: %w", err)
	}

	// 2. 更新工單
	updateQuery := `
		UPDATE "MaintenanceRecords"
		SET 
			record_type = CASE WHEN $2::boolean THEN $3::maintenance_record_type ELSE record_type END,
			item_name = COALESCE($4, item_name),
			service_date = CASE WHEN $5::boolean THEN $6::date ELSE service_date END,
			mileage = COALESCE($7, mileage),
			cost = COALESCE($8, cost),
			shop_name = CASE WHEN $9::boolean THEN $10::varchar ELSE shop_name END,
			note = CASE WHEN $11::boolean THEN $12::text ELSE note END,
			updated_at = now()
		WHERE id = $1
		RETURNING id, vehicle_id, record_type, item_name, to_char(service_date, 'YYYY-MM-DD'), mileage, cost, shop_name, note, created_at, updated_at;
	`

	hasType := req.RecordType != nil
	var typeVal *string
	if hasType {
		typeVal = req.RecordType
	}

	hasDate := req.ServiceDate != nil
	var dateVal *string
	if hasDate {
		dateVal = req.ServiceDate
	}

	hasShop := req.ShopName != nil
	var shopVal *string
	if hasShop {
		shopVal = req.ShopName
	}

	hasNote := req.Note != nil
	var noteVal *string
	if hasNote {
		noteVal = req.Note
	}

	var mr model.MaintenanceRecord
	err = tx.QueryRow(ctx, updateQuery,
		recordID,
		hasType, typeVal,
		req.ItemName,
		hasDate, dateVal,
		req.Mileage,
		req.Cost,
		hasShop, shopVal,
		hasNote, noteVal,
	).Scan(
		&mr.ID, &mr.VehicleID, &mr.RecordType, &mr.ItemName,
		&mr.ServiceDate, &mr.Mileage, &mr.Cost, &mr.ShopName,
		&mr.Note, &mr.CreatedAt, &mr.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update maintenance record: %w", err)
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
		return nil, fmt.Errorf("failed to commit maintenance update transaction: %w", err)
	}

	return &mr, nil
}

// DeleteMaintenance 刪除工單 (CASCADE 清理相片) 並原子安全回滾最高里程 (Transaction)
func (r *MaintenanceRepository) DeleteMaintenance(ctx context.Context, userID string, recordID int) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. 查詢所屬 vehicle_id 並驗證擁有權
	var vehicleID int
	verifyQuery := `
		SELECT m.vehicle_id 
		FROM "MaintenanceRecords" m
		JOIN "Vehicles" v ON v.id = m.vehicle_id
		WHERE m.id = $1 AND v.user_id = $2;
	`
	err = tx.QueryRow(ctx, verifyQuery, recordID, userID).Scan(&vehicleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("failed to verify maintenance record ownership: %w", err)
	}

	// 2. 刪除工單 (資料庫已設 ON DELETE CASCADE，相片自動連帶清除)
	deleteQuery := `DELETE FROM "MaintenanceRecords" WHERE id = $1;`
	tag, err := tx.Exec(ctx, deleteQuery, recordID)
	if err != nil {
		return fmt.Errorf("failed to delete maintenance record: %w", err)
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

// AddPhotos 為現有保養維修工單追加照片
func (r *MaintenanceRepository) AddPhotos(ctx context.Context, userID string, recordID int, photoURLs []string) ([]model.MaintenancePhoto, error) {
	// 1. 驗證該紀錄屬於該使用者擁有的車輛
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
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to verify maintenance record ownership: %w", err)
	}

	if len(photoURLs) == 0 {
		return []model.MaintenancePhoto{}, nil
	}

	insertQuery := `
		INSERT INTO "MaintenancePhotos" (maintenance_record_id, url, sort_order)
		VALUES ($1, $2, $3)
		RETURNING id, maintenance_record_id, url, sort_order, created_at;
	`

	var photos []model.MaintenancePhoto
	for i, url := range photoURLs {
		var photo model.MaintenancePhoto
		err = r.pool.QueryRow(ctx, insertQuery, recordID, url, i).Scan(
			&photo.ID, &photo.MaintenanceRecordID, &photo.URL, &photo.SortOrder, &photo.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to insert maintenance photo: %w", err)
		}
		photos = append(photos, photo)
	}

	return photos, nil
}

// DeletePhoto 刪除單張保養照片，並回傳其 URL 以便清除實體 Storage
func (r *MaintenanceRepository) DeletePhoto(ctx context.Context, userID string, photoID int) (string, error) {
	// 驗證擁有權並取得 URL
	var photoURL string
	verifyQuery := `
		SELECT p.url 
		FROM "MaintenancePhotos" p
		JOIN "MaintenanceRecords" m ON m.id = p.maintenance_record_id
		JOIN "Vehicles" v ON v.id = m.vehicle_id
		WHERE p.id = $1 AND v.user_id = $2;
	`
	err := r.pool.QueryRow(ctx, verifyQuery, photoID, userID).Scan(&photoURL)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", fmt.Errorf("failed to verify photo ownership: %w", err)
	}

	deleteQuery := `DELETE FROM "MaintenancePhotos" WHERE id = $1;`
	_, err = r.pool.Exec(ctx, deleteQuery, photoID)
	if err != nil {
		return "", fmt.Errorf("failed to delete maintenance photo: %w", err)
	}

	return photoURL, nil
}

