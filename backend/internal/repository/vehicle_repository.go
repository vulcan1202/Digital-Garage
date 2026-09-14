package repository

import (
	"context"
	"errors"
	"fmt"

	"digital-garage-backend/internal/model"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound = errors.New("not_found")
	ErrConflict = errors.New("conflict")
)

type VehicleRepository struct {
	pool *pgxpool.Pool
}

func NewVehicleRepository(pool *pgxpool.Pool) *VehicleRepository {
	return &VehicleRepository{pool: pool}
}

// ListVehicles 取得該使用者名下所有車輛，並整合封面圖片 URL
func (r *VehicleRepository) ListVehicles(ctx context.Context, userID string) ([]model.VehicleWithCover, error) {
	query := `
		SELECT 
			v.id, v.user_id, v.brand, v.model, v.year, 
			to_char(v.purchase_date, 'YYYY-MM-DD') AS purchase_date,
			v.initial_mileage, v.current_mileage,
			v.vehicle_type, v.purchase_price, v.fuel_type, v.engine_displacement_cc, v.license_plate,
			v.created_at, v.updated_at,
			(
				SELECT vp.url FROM "VehiclePhotos" vp 
				WHERE vp.vehicle_id = v.id 
				ORDER BY vp.is_cover DESC, vp.sort_order ASC, vp.id ASC 
				LIMIT 1
			) AS cover_url
		FROM "Vehicles" v
		WHERE v.user_id = $1
		ORDER BY v.created_at DESC;
	`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query vehicles: %w", err)
	}
	defer rows.Close()

	var vehicles []model.VehicleWithCover
	for rows.Next() {
		var v model.VehicleWithCover
		err := rows.Scan(
			&v.ID, &v.UserID, &v.Brand, &v.Model, &v.Year,
			&v.PurchaseDate, &v.InitialMileage, &v.CurrentMileage,
			&v.VehicleType, &v.PurchasePrice, &v.FuelType, &v.EngineDisplacementCC, &v.LicensePlate,
			&v.CreatedAt, &v.UpdatedAt, &v.CoverURL,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan vehicle: %w", err)
		}
		vehicles = append(vehicles, v)
	}

	if vehicles == nil {
		vehicles = []model.VehicleWithCover{}
	}
	return vehicles, nil
}

// GetVehicleByID 依 ID 取得車輛基本資訊與所有照片
func (r *VehicleRepository) GetVehicleByID(ctx context.Context, userID string, vehicleID int) (*model.VehicleWithPhotos, error) {
	vehicleQuery := `
		SELECT 
			id, user_id, brand, model, year, 
			to_char(purchase_date, 'YYYY-MM-DD') AS purchase_date,
			initial_mileage, current_mileage,
			vehicle_type, purchase_price, fuel_type, engine_displacement_cc, license_plate,
			created_at, updated_at
		FROM "Vehicles"
		WHERE id = $1 AND user_id = $2;
	`

	var v model.Vehicle
	err := r.pool.QueryRow(ctx, vehicleQuery, vehicleID, userID).Scan(
		&v.ID, &v.UserID, &v.Brand, &v.Model, &v.Year,
		&v.PurchaseDate, &v.InitialMileage, &v.CurrentMileage,
		&v.VehicleType, &v.PurchasePrice, &v.FuelType, &v.EngineDisplacementCC, &v.LicensePlate,
		&v.CreatedAt, &v.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to query vehicle: %w", err)
	}

	photosQuery := `
		SELECT id, vehicle_id, url, sort_order, is_cover, created_at
		FROM "VehiclePhotos"
		WHERE vehicle_id = $1
		ORDER BY sort_order ASC, id ASC;
	`

	rows, err := r.pool.Query(ctx, photosQuery, vehicleID)
	if err != nil {
		return nil, fmt.Errorf("failed to query vehicle photos: %w", err)
	}
	defer rows.Close()

	var photos []model.VehiclePhoto
	for rows.Next() {
		var p model.VehiclePhoto
		if err := rows.Scan(&p.ID, &p.VehicleID, &p.URL, &p.SortOrder, &p.IsCover, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan vehicle photo: %w", err)
		}
		photos = append(photos, p)
	}
	if photos == nil {
		photos = []model.VehiclePhoto{}
	}

	return &model.VehicleWithPhotos{
		Vehicle: v,
		Photos:  photos,
	}, nil
}

// CreateVehicle 新增車輛
func (r *VehicleRepository) CreateVehicle(ctx context.Context, userID string, req *model.CreateVehicleRequest) (*model.Vehicle, error) {
	initMileage := 0
	if req.InitialMileage != nil {
		initMileage = *req.InitialMileage
	} else if req.CurrentMileage != nil {
		initMileage = *req.CurrentMileage
	}

	curMileage := initMileage
	if req.CurrentMileage != nil {
		curMileage = *req.CurrentMileage
	}

	query := `
		INSERT INTO "Vehicles" (
			user_id, brand, model, vehicle_type, year, purchase_date, purchase_price,
			fuel_type, engine_displacement_cc, license_plate, initial_mileage, current_mileage
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, user_id, brand, model, year, to_char(purchase_date, 'YYYY-MM-DD'),
			initial_mileage, current_mileage, vehicle_type, purchase_price, fuel_type,
			engine_displacement_cc, license_plate, created_at, updated_at;
	`

	var v model.Vehicle
	err := r.pool.QueryRow(ctx, query,
		userID, req.Brand, req.Model, req.VehicleType, req.Year, req.PurchaseDate, req.PurchasePrice,
		req.FuelType, req.EngineDisplacementCC, req.LicensePlate, initMileage, curMileage,
	).Scan(
		&v.ID, &v.UserID, &v.Brand, &v.Model, &v.Year,
		&v.PurchaseDate, &v.InitialMileage, &v.CurrentMileage,
		&v.VehicleType, &v.PurchasePrice, &v.FuelType,
		&v.EngineDisplacementCC, &v.LicensePlate,
		&v.CreatedAt, &v.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create vehicle: %w", err)
	}

	return &v, nil
}

// UpdateVehicle 更新車輛資訊 (禁止修改 initial_mileage)
func (r *VehicleRepository) UpdateVehicle(ctx context.Context, userID string, vehicleID int, req *model.UpdateVehicleRequest) (*model.Vehicle, error) {
	query := `
		UPDATE "Vehicles"
		SET 
			brand = COALESCE($3, brand),
			model = COALESCE($4, model),
			vehicle_type = COALESCE($5, vehicle_type),
			year = CASE WHEN $6::boolean THEN $7::integer ELSE year END,
			purchase_date = CASE WHEN $8::boolean THEN $9::date ELSE purchase_date END,
			purchase_price = CASE WHEN $10::boolean THEN $11::numeric ELSE purchase_price END,
			fuel_type = CASE WHEN $12::boolean THEN $13::fuel_type ELSE fuel_type END,
			engine_displacement_cc = CASE WHEN $14::boolean THEN $15::integer ELSE engine_displacement_cc END,
			license_plate = CASE WHEN $16::boolean THEN $17::varchar ELSE license_plate END,
			current_mileage = COALESCE($18, current_mileage),
			updated_at = now()
		WHERE id = $1 AND user_id = $2
		RETURNING id, user_id, brand, model, year, to_char(purchase_date, 'YYYY-MM-DD'),
			initial_mileage, current_mileage, vehicle_type, purchase_price, fuel_type,
			engine_displacement_cc, license_plate, created_at, updated_at;
	`

	hasYear := req.Year != nil
	var yearVal *int
	if hasYear {
		yearVal = req.Year
	}

	hasDate := req.PurchaseDate != nil
	var dateVal *string
	if hasDate {
		dateVal = req.PurchaseDate
	}

	hasPrice := req.PurchasePrice != nil
	var priceVal *float64
	if hasPrice {
		priceVal = req.PurchasePrice
	}

	hasFuelType := req.FuelType != nil
	var fuelVal *string
	if hasFuelType {
		fuelVal = req.FuelType
	}

	hasCC := req.EngineDisplacementCC != nil
	var ccVal *int
	if hasCC {
		ccVal = req.EngineDisplacementCC
	}

	hasPlate := req.LicensePlate != nil
	var plateVal *string
	if hasPlate {
		plateVal = req.LicensePlate
	}

	var v model.Vehicle
	err := r.pool.QueryRow(ctx, query,
		vehicleID, userID,
		req.Brand, req.Model, req.VehicleType,
		hasYear, yearVal,
		hasDate, dateVal,
		hasPrice, priceVal,
		hasFuelType, fuelVal,
		hasCC, ccVal,
		hasPlate, plateVal,
		req.CurrentMileage,
	).Scan(
		&v.ID, &v.UserID, &v.Brand, &v.Model, &v.Year,
		&v.PurchaseDate, &v.InitialMileage, &v.CurrentMileage,
		&v.VehicleType, &v.PurchasePrice, &v.FuelType,
		&v.EngineDisplacementCC, &v.LicensePlate,
		&v.CreatedAt, &v.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to update vehicle: %w", err)
	}

	return &v, nil
}

// DeleteVehicle 刪除車輛
func (r *VehicleRepository) DeleteVehicle(ctx context.Context, userID string, vehicleID int) error {
	query := `DELETE FROM "Vehicles" WHERE id = $1 AND user_id = $2;`
	tag, err := r.pool.Exec(ctx, query, vehicleID, userID)
	if err != nil {
		return fmt.Errorf("failed to delete vehicle: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// AddPhoto 新增照片；若目前無封面，自動設為封面 (Transaction)
func (r *VehicleRepository) AddPhoto(ctx context.Context, userID string, vehicleID int, req *model.AddPhotoRequest) (*model.VehiclePhoto, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. 驗證車輛擁有權
	var exists bool
	err = tx.QueryRow(ctx, `SELECT true FROM "Vehicles" WHERE id = $1 AND user_id = $2;`, vehicleID, userID).Scan(&exists)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to verify vehicle ownership: %w", err)
	}

	// 2. 檢查車輛目前是否已有封面照片
	var hasCover bool
	_ = tx.QueryRow(ctx, `SELECT true FROM "VehiclePhotos" WHERE vehicle_id = $1 AND is_cover = true;`, vehicleID).Scan(&hasCover)

	isCover := false
	if req.IsCover != nil && *req.IsCover {
		// 若指定此張為封面，將其餘封面設為 false
		_, err = tx.Exec(ctx, `UPDATE "VehiclePhotos" SET is_cover = false WHERE vehicle_id = $1;`, vehicleID)
		if err != nil {
			return nil, fmt.Errorf("failed to clear existing cover: %w", err)
		}
		isCover = true
	} else if !hasCover {
		// 若目前尚無任何封面，本張自動升格為封面
		isCover = true
	}

	sortOrder := 0
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}

	// 3. 寫入照片
	insertQuery := `
		INSERT INTO "VehiclePhotos" (vehicle_id, url, sort_order, is_cover)
		VALUES ($1, $2, $3, $4)
		RETURNING id, vehicle_id, url, sort_order, is_cover, created_at;
	`

	var photo model.VehiclePhoto
	err = tx.QueryRow(ctx, insertQuery, vehicleID, req.URL, sortOrder, isCover).Scan(
		&photo.ID, &photo.VehicleID, &photo.URL, &photo.SortOrder, &photo.IsCover, &photo.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to insert vehicle photo: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit add photo transaction: %w", err)
	}

	return &photo, nil
}

// SetCoverPhoto 設定指定相片為封面 (Transaction: 原封面取消，新封面設定)
func (r *VehicleRepository) SetCoverPhoto(ctx context.Context, userID string, vehicleID int, photoID int) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. 驗證車輛擁有權
	var vehicleExists bool
	err = tx.QueryRow(ctx, `SELECT true FROM "Vehicles" WHERE id = $1 AND user_id = $2;`, vehicleID, userID).Scan(&vehicleExists)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("failed to verify vehicle ownership: %w", err)
	}

	// 2. 驗證照片存在於該車輛
	var photoExists bool
	err = tx.QueryRow(ctx, `SELECT true FROM "VehiclePhotos" WHERE id = $1 AND vehicle_id = $2;`, photoID, vehicleID).Scan(&photoExists)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("failed to verify photo existence: %w", err)
	}

	// 3. 原封面設為 false
	_, err = tx.Exec(ctx, `UPDATE "VehiclePhotos" SET is_cover = false WHERE vehicle_id = $1;`, vehicleID)
	if err != nil {
		return fmt.Errorf("failed to unset previous cover: %w", err)
	}

	// 4. 指定照片設為 true
	_, err = tx.Exec(ctx, `UPDATE "VehiclePhotos" SET is_cover = true WHERE id = $1 AND vehicle_id = $2;`, photoID, vehicleID)
	if err != nil {
		return fmt.Errorf("failed to set new cover: %w", err)
	}

	return tx.Commit(ctx)
}

// DeletePhoto 刪除相片；若刪除者為封面，自動推選下一張設為封面 (Transaction)
func (r *VehicleRepository) DeletePhoto(ctx context.Context, userID string, vehicleID int, photoID int) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. 驗證車輛擁有權
	var vehicleExists bool
	err = tx.QueryRow(ctx, `SELECT true FROM "Vehicles" WHERE id = $1 AND user_id = $2;`, vehicleID, userID).Scan(&vehicleExists)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("failed to verify vehicle ownership: %w", err)
	}

	// 2. 查詢該相片是否為封面
	var wasCover bool
	err = tx.QueryRow(ctx, `SELECT is_cover FROM "VehiclePhotos" WHERE id = $1 AND vehicle_id = $2;`, photoID, vehicleID).Scan(&wasCover)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("failed to find photo: %w", err)
	}

	// 3. 刪除相片
	_, err = tx.Exec(ctx, `DELETE FROM "VehiclePhotos" WHERE id = $1 AND vehicle_id = $2;`, photoID, vehicleID)
	if err != nil {
		return fmt.Errorf("failed to delete photo: %w", err)
	}

	// 4. 若原先為封面，推選下一張為封面
	if wasCover {
		var nextPhotoID int
		nextQuery := `
			SELECT id FROM "VehiclePhotos" 
			WHERE vehicle_id = $1 
			ORDER BY sort_order ASC, id ASC 
			LIMIT 1;
		`
		err = tx.QueryRow(ctx, nextQuery, vehicleID).Scan(&nextPhotoID)
		if err == nil {
			_, err = tx.Exec(ctx, `UPDATE "VehiclePhotos" SET is_cover = true WHERE id = $1;`, nextPhotoID)
			if err != nil {
				return fmt.Errorf("failed to promote next photo to cover: %w", err)
			}
		}
	}

	return tx.Commit(ctx)
}

// ListPhotos 取得指定車輛的照片清單 (封面置頂，其次依 sort_order 排序)
func (r *VehicleRepository) ListPhotos(ctx context.Context, userID string, vehicleID int) ([]model.VehiclePhoto, error) {
	var exists bool
	err := r.pool.QueryRow(ctx, `SELECT true FROM "Vehicles" WHERE id = $1 AND user_id = $2;`, vehicleID, userID).Scan(&exists)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to verify vehicle ownership: %w", err)
	}

	query := `
		SELECT id, vehicle_id, url, sort_order, is_cover, created_at
		FROM "VehiclePhotos"
		WHERE vehicle_id = $1
		ORDER BY is_cover DESC, sort_order ASC, created_at ASC;
	`
	rows, err := r.pool.Query(ctx, query, vehicleID)
	if err != nil {
		return nil, fmt.Errorf("failed to query vehicle photos: %w", err)
	}
	defer rows.Close()

	var photos []model.VehiclePhoto
	for rows.Next() {
		var p model.VehiclePhoto
		if err := rows.Scan(&p.ID, &p.VehicleID, &p.URL, &p.SortOrder, &p.IsCover, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan vehicle photo: %w", err)
		}
		photos = append(photos, p)
	}
	if photos == nil {
		photos = []model.VehiclePhoto{}
	}
	return photos, nil
}

// SyncVehicleMaxMileage 依 SQL GREATEST 聚合語句安全同步車輛當前最高里程
func (r *VehicleRepository) SyncVehicleMaxMileage(ctx context.Context, userID string, vehicleID int) error {
	query := `
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
	_, err := r.pool.Exec(ctx, query, vehicleID, userID)
	if err != nil {
		return fmt.Errorf("failed to sync max mileage: %w", err)
	}
	return nil
}

