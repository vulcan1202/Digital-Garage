package repository

import (
	"context"
	"errors"
	"fmt"

	"digital-garage-backend/internal/model"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ModificationRepository struct {
	pool *pgxpool.Pool
}

func NewModificationRepository(pool *pgxpool.Pool) *ModificationRepository {
	return &ModificationRepository{pool: pool}
}

// ListModifications 取得車輛所有改裝品清單
func (r *ModificationRepository) ListModifications(ctx context.Context, userID string, vehicleID int) ([]model.Modification, error) {
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
			id, vehicle_id, brand, item_name, model, category,
			to_char(purchase_date, 'YYYY-MM-DD'),
			to_char(install_date, 'YYYY-MM-DD'),
			install_mileage, purchase_price, install_price, shop_name, note,
			created_at, updated_at
		FROM "Modifications"
		WHERE vehicle_id = $1
		ORDER BY install_date DESC NULLS LAST, created_at DESC;
	`
	rows, err := r.pool.Query(ctx, query, vehicleID)
	if err != nil {
		return nil, fmt.Errorf("failed to query modifications: %w", err)
	}
	defer rows.Close()

	mods := make([]model.Modification, 0)
	for rows.Next() {
		var m model.Modification
		err := rows.Scan(
			&m.ID, &m.VehicleID, &m.Brand, &m.ItemName, &m.Model, &m.Category,
			&m.PurchaseDate, &m.InstallDate, &m.InstallMileage,
			&m.PurchasePrice, &m.InstallPrice, &m.ShopName, &m.Note,
			&m.CreatedAt, &m.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan modification row: %w", err)
		}
		mods = append(mods, m)
	}

	return mods, nil
}

// GetModificationDetails 取得單一改裝品完整資訊 (包含照片、設定組與各設定組細項)
func (r *ModificationRepository) GetModificationDetails(ctx context.Context, userID string, modID int) (*model.ModificationWithDetails, error) {
	// 1. 取得改裝品本體並驗證擁有權
	modQuery := `
		SELECT 
			m.id, m.vehicle_id, m.brand, m.item_name, m.model, m.category,
			to_char(m.purchase_date, 'YYYY-MM-DD'),
			to_char(m.install_date, 'YYYY-MM-DD'),
			m.install_mileage, m.purchase_price, m.install_price, m.shop_name, m.note,
			m.created_at, m.updated_at
		FROM "Modifications" m
		JOIN "Vehicles" v ON v.id = m.vehicle_id
		WHERE m.id = $1 AND v.user_id = $2;
	`
	var m model.Modification
	err := r.pool.QueryRow(ctx, modQuery, modID, userID).Scan(
		&m.ID, &m.VehicleID, &m.Brand, &m.ItemName, &m.Model, &m.Category,
		&m.PurchaseDate, &m.InstallDate, &m.InstallMileage,
		&m.PurchasePrice, &m.InstallPrice, &m.ShopName, &m.Note,
		&m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to query modification detail: %w", err)
	}

	res := &model.ModificationWithDetails{
		Modification: m,
		Photos:       make([]model.ModificationPhoto, 0),
		SettingSets:  make([]model.ModificationSettingSet, 0),
	}

	// 2. 取得照片列表
	photoQuery := `
		SELECT id, modification_id, url, sort_order, photo_type, created_at
		FROM "ModificationPhotos"
		WHERE modification_id = $1
		ORDER BY sort_order ASC;
	`
	pRows, err := r.pool.Query(ctx, photoQuery, modID)
	if err != nil {
		return nil, fmt.Errorf("failed to query modification photos: %w", err)
	}
	defer pRows.Close()

	for pRows.Next() {
		var p model.ModificationPhoto
		if err := pRows.Scan(&p.ID, &p.ModificationID, &p.URL, &p.SortOrder, &p.PhotoType, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan modification photo: %w", err)
		}
		res.Photos = append(res.Photos, p)
	}

	// 3. 取得設定組列表
	setQuery := `
		SELECT 
			id, modification_id, name, to_char(recorded_date, 'YYYY-MM-DD'),
			mileage, note, is_current, created_at, updated_at
		FROM "ModificationSettingSets"
		WHERE modification_id = $1
		ORDER BY recorded_date DESC, created_at DESC;
	`
	sRows, err := r.pool.Query(ctx, setQuery, modID)
	if err != nil {
		return nil, fmt.Errorf("failed to query setting sets: %w", err)
	}
	defer sRows.Close()

	setIDs := make([]int, 0)
	for sRows.Next() {
		var s model.ModificationSettingSet
		s.Settings = make([]model.ModificationSetting, 0)
		if err := sRows.Scan(
			&s.ID, &s.ModificationID, &s.Name, &s.RecordedDate,
			&s.Mileage, &s.Note, &s.IsCurrent, &s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan setting set: %w", err)
		}
		res.SettingSets = append(res.SettingSets, s)
		setIDs = append(setIDs, s.ID)
	}

	// 4. 取得所有細項通用參數並映射至對應設定組
	if len(setIDs) > 0 {
		settingsQuery := `
			SELECT id, setting_set_id, setting_name, setting_value, unit, created_at, updated_at
			FROM "ModificationSettings"
			WHERE setting_set_id = ANY($1)
			ORDER BY id ASC;
		`
		setItemsRows, err := r.pool.Query(ctx, settingsQuery, setIDs)
		if err != nil {
			return nil, fmt.Errorf("failed to query modification settings: %w", err)
		}
		defer setItemsRows.Close()

		settingsBySet := make(map[int][]model.ModificationSetting)
		for setItemsRows.Next() {
			var it model.ModificationSetting
			if err := setItemsRows.Scan(
				&it.ID, &it.SettingSetID, &it.SettingName, &it.SettingValue, &it.Unit,
				&it.CreatedAt, &it.UpdatedAt,
			); err != nil {
				return nil, fmt.Errorf("failed to scan setting item: %w", err)
			}
			settingsBySet[it.SettingSetID] = append(settingsBySet[it.SettingSetID], it)
		}

		for i := range res.SettingSets {
			sID := res.SettingSets[i].ID
			if items, ok := settingsBySet[sID]; ok {
				res.SettingSets[i].Settings = items
			}
		}
	}

	return res, nil
}

// CreateModification 新增改裝品紀錄並原子更新最高里程 (Transaction)
func (r *ModificationRepository) CreateModification(ctx context.Context, userID string, vehicleID int, req *model.CreateModificationRequest) (*model.Modification, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. 驗證車輛擁有權
	var vID int
	verifyQuery := `SELECT id FROM "Vehicles" WHERE id = $1 AND user_id = $2;`
	err = tx.QueryRow(ctx, verifyQuery, vehicleID, userID).Scan(&vID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to verify vehicle ownership: %w", err)
	}

	purchasePrice := 0.0
	if req.PurchasePrice != nil {
		purchasePrice = *req.PurchasePrice
	}
	installPrice := 0.0
	if req.InstallPrice != nil {
		installPrice = *req.InstallPrice
	}

	hasPurchDate := req.PurchaseDate != nil
	var purchDateVal *string
	if hasPurchDate {
		purchDateVal = req.PurchaseDate
	}

	hasInstallDate := req.InstallDate != nil
	var installDateVal *string
	if hasInstallDate {
		installDateVal = req.InstallDate
	}

	insertQuery := `
		INSERT INTO "Modifications" (
			vehicle_id, brand, item_name, model, category,
			purchase_date, install_date, install_mileage,
			purchase_price, install_price, shop_name, note,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5::modification_category,
			CASE WHEN $6::boolean THEN $7::date ELSE NULL END,
			CASE WHEN $8::boolean THEN $9::date ELSE NULL END,
			$10, $11, $12, $13, $14,
			now(), now()
		)
		RETURNING 
			id, vehicle_id, brand, item_name, model, category,
			to_char(purchase_date, 'YYYY-MM-DD'),
			to_char(install_date, 'YYYY-MM-DD'),
			install_mileage, purchase_price, install_price, shop_name, note,
			created_at, updated_at;
	`
	var m model.Modification
	err = tx.QueryRow(ctx, insertQuery,
		vehicleID, req.Brand, req.ItemName, req.Model, req.Category,
		hasPurchDate, purchDateVal,
		hasInstallDate, installDateVal,
		req.InstallMileage, purchasePrice, installPrice, req.ShopName, req.Note,
	).Scan(
		&m.ID, &m.VehicleID, &m.Brand, &m.ItemName, &m.Model, &m.Category,
		&m.PurchaseDate, &m.InstallDate, &m.InstallMileage,
		&m.PurchasePrice, &m.InstallPrice, &m.ShopName, &m.Note,
		&m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to insert modification: %w", err)
	}

	// 2. SQL GREATEST 原子同步最高里程
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
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return &m, nil
}

// UpdateModification 更新改裝品本體資訊並原子同步最高里程 (Transaction)
func (r *ModificationRepository) UpdateModification(ctx context.Context, userID string, modID int, req *model.UpdateModificationRequest) (*model.Modification, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. 驗證擁有權
	var vehicleID int
	verifyQuery := `
		SELECT m.vehicle_id 
		FROM "Modifications" m
		JOIN "Vehicles" v ON v.id = m.vehicle_id
		WHERE m.id = $1 AND v.user_id = $2;
	`
	err = tx.QueryRow(ctx, verifyQuery, modID, userID).Scan(&vehicleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to verify modification ownership: %w", err)
	}

	hasBrand := req.Brand != nil
	hasModel := req.Model != nil
	hasCategory := req.Category != nil
	hasPurchDate := req.PurchaseDate != nil
	hasInstallDate := req.InstallDate != nil
	hasMileage := req.InstallMileage != nil
	hasShop := req.ShopName != nil
	hasNote := req.Note != nil

	updateQuery := `
		UPDATE "Modifications"
		SET 
			brand = CASE WHEN $2::boolean THEN $3::varchar ELSE brand END,
			item_name = COALESCE($4, item_name),
			model = CASE WHEN $5::boolean THEN $6::varchar ELSE model END,
			category = CASE WHEN $7::boolean THEN $8::modification_category ELSE category END,
			purchase_date = CASE WHEN $9::boolean THEN $10::date ELSE purchase_date END,
			install_date = CASE WHEN $11::boolean THEN $12::date ELSE install_date END,
			install_mileage = CASE WHEN $13::boolean THEN $14::integer ELSE install_mileage END,
			purchase_price = COALESCE($15, purchase_price),
			install_price = COALESCE($16, install_price),
			shop_name = CASE WHEN $17::boolean THEN $18::varchar ELSE shop_name END,
			note = CASE WHEN $19::boolean THEN $20::text ELSE note END,
			updated_at = now()
		WHERE id = $1
		RETURNING 
			id, vehicle_id, brand, item_name, model, category,
			to_char(purchase_date, 'YYYY-MM-DD'),
			to_char(install_date, 'YYYY-MM-DD'),
			install_mileage, purchase_price, install_price, shop_name, note,
			created_at, updated_at;
	`

	var m model.Modification
	err = tx.QueryRow(ctx, updateQuery,
		modID,
		hasBrand, req.Brand,
		req.ItemName,
		hasModel, req.Model,
		hasCategory, req.Category,
		hasPurchDate, req.PurchaseDate,
		hasInstallDate, req.InstallDate,
		hasMileage, req.InstallMileage,
		req.PurchasePrice,
		req.InstallPrice,
		hasShop, req.ShopName,
		hasNote, req.Note,
	).Scan(
		&m.ID, &m.VehicleID, &m.Brand, &m.ItemName, &m.Model, &m.Category,
		&m.PurchaseDate, &m.InstallDate, &m.InstallMileage,
		&m.PurchasePrice, &m.InstallPrice, &m.ShopName, &m.Note,
		&m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update modification: %w", err)
	}

	// 2. SQL GREATEST 原子同步最高里程
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
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return &m, nil
}

// DeleteModification 刪除改裝品 (CASCADE 清除照片與設定組) 並原子安全回滾最高里程 (Transaction)
func (r *ModificationRepository) DeleteModification(ctx context.Context, userID string, modID int) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. 驗證擁有權
	var vehicleID int
	verifyQuery := `
		SELECT m.vehicle_id 
		FROM "Modifications" m
		JOIN "Vehicles" v ON v.id = m.vehicle_id
		WHERE m.id = $1 AND v.user_id = $2;
	`
	err = tx.QueryRow(ctx, verifyQuery, modID, userID).Scan(&vehicleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("failed to verify modification ownership: %w", err)
	}

	deleteQuery := `DELETE FROM "Modifications" WHERE id = $1;`
	tag, err := tx.Exec(ctx, deleteQuery, modID)
	if err != nil {
		return fmt.Errorf("failed to delete modification: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}

	// 2. SQL GREATEST 原子回滾最高里程
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

// AddPhotos 追加改裝相片
func (r *ModificationRepository) AddPhotos(ctx context.Context, userID string, modID int, photos []model.PhotoItemRequest) ([]model.ModificationPhoto, error) {
	// 驗證擁有權
	var vehicleID int
	verifyQuery := `
		SELECT m.vehicle_id 
		FROM "Modifications" m
		JOIN "Vehicles" v ON v.id = m.vehicle_id
		WHERE m.id = $1 AND v.user_id = $2;
	`
	err := r.pool.QueryRow(ctx, verifyQuery, modID, userID).Scan(&vehicleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to verify modification ownership: %w", err)
	}

	if len(photos) == 0 {
		return []model.ModificationPhoto{}, nil
	}

	insertQuery := `
		INSERT INTO "ModificationPhotos" (modification_id, url, sort_order, photo_type, created_at)
		VALUES ($1, $2, $3, $4, now())
		RETURNING id, modification_id, url, sort_order, photo_type, created_at;
	`
	res := make([]model.ModificationPhoto, 0, len(photos))
	for i, p := range photos {
		var photo model.ModificationPhoto
		err = r.pool.QueryRow(ctx, insertQuery, modID, p.URL, i, p.PhotoType).Scan(
			&photo.ID, &photo.ModificationID, &photo.URL, &photo.SortOrder, &photo.PhotoType, &photo.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to insert modification photo: %w", err)
		}
		res = append(res, photo)
	}

	return res, nil
}

// DeletePhoto 刪除單張改裝照片並回傳其 URL
func (r *ModificationRepository) DeletePhoto(ctx context.Context, userID string, photoID int) (string, error) {
	var photoURL string
	verifyQuery := `
		SELECT p.url 
		FROM "ModificationPhotos" p
		JOIN "Modifications" m ON m.id = p.modification_id
		JOIN "Vehicles" v ON v.id = m.vehicle_id
		WHERE p.id = $1 AND v.user_id = $2;
	`
	err := r.pool.QueryRow(ctx, verifyQuery, photoID, userID).Scan(&photoURL)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", fmt.Errorf("failed to verify modification photo ownership: %w", err)
	}

	deleteQuery := `DELETE FROM "ModificationPhotos" WHERE id = $1;`
	_, err = r.pool.Exec(ctx, deleteQuery, photoID)
	if err != nil {
		return "", fmt.Errorf("failed to delete modification photo: %w", err)
	}

	return photoURL, nil
}

// CreateSettingSet 建立新調校設定組與細項參數 (若 is_current 為 true 則原子事務清除其他 is_current)
func (r *ModificationRepository) CreateSettingSet(ctx context.Context, userID string, modID int, req *model.CreateSettingSetRequest) (*model.ModificationSettingSet, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. 驗證改裝品擁有權
	var vehicleID int
	verifyQuery := `
		SELECT m.vehicle_id 
		FROM "Modifications" m
		JOIN "Vehicles" v ON v.id = m.vehicle_id
		WHERE m.id = $1 AND v.user_id = $2;
	`
	err = tx.QueryRow(ctx, verifyQuery, modID, userID).Scan(&vehicleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to verify modification ownership: %w", err)
	}

	// 2. 若設為使用中 (is_current = true)，互斥關閉同改裝品下其他使用中設定組
	if req.IsCurrent {
		clearQuery := `
			UPDATE "ModificationSettingSets"
			SET is_current = false, updated_at = now()
			WHERE modification_id = $1 AND is_current = true;
		`
		_, err = tx.Exec(ctx, clearQuery, modID)
		if err != nil {
			return nil, fmt.Errorf("failed to clear previous current setting set: %w", err)
		}
	}

	// 3. 建立設定組主表
	insertSetQuery := `
		INSERT INTO "ModificationSettingSets" (
			modification_id, name, recorded_date, mileage, note, is_current,
			created_at, updated_at
		) VALUES (
			$1, $2, $3::date, $4, $5, $6,
			now(), now()
		)
		RETURNING 
			id, modification_id, name, to_char(recorded_date, 'YYYY-MM-DD'),
			mileage, note, is_current, created_at, updated_at;
	`
	var s model.ModificationSettingSet
	err = tx.QueryRow(ctx, insertSetQuery,
		modID, req.Name, req.RecordedDate, req.Mileage, req.Note, req.IsCurrent,
	).Scan(
		&s.ID, &s.ModificationID, &s.Name, &s.RecordedDate,
		&s.Mileage, &s.Note, &s.IsCurrent, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to insert setting set: %w", err)
	}

	s.Settings = make([]model.ModificationSetting, 0, len(req.Settings))

	// 4. 寫入細項通用參數
	if len(req.Settings) > 0 {
		insertSettingItemQuery := `
			INSERT INTO "ModificationSettings" (setting_set_id, setting_name, setting_value, unit, created_at, updated_at)
			VALUES ($1, $2, $3, $4, now(), now())
			RETURNING id, setting_set_id, setting_name, setting_value, unit, created_at, updated_at;
		`
		for _, item := range req.Settings {
			var setting model.ModificationSetting
			err = tx.QueryRow(ctx, insertSettingItemQuery, s.ID, item.SettingName, item.SettingValue, item.Unit).Scan(
				&setting.ID, &setting.SettingSetID, &setting.SettingName, &setting.SettingValue, &setting.Unit,
				&setting.CreatedAt, &setting.UpdatedAt,
			)
			if err != nil {
				return nil, fmt.Errorf("failed to insert setting item: %w", err)
			}
			s.Settings = append(s.Settings, setting)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit setting set transaction: %w", err)
	}

	return &s, nil
}

// SetCurrentSettingSet 切換當前使用中的調校設定組 (互斥事務處理)
func (r *ModificationRepository) SetCurrentSettingSet(ctx context.Context, userID string, modID int, setID int) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. 驗證擁有權並確認該設定組屬於該改裝品
	var dummy int
	verifyQuery := `
		SELECT s.id 
		FROM "ModificationSettingSets" s
		JOIN "Modifications" m ON m.id = s.modification_id
		JOIN "Vehicles" v ON v.id = m.vehicle_id
		WHERE s.id = $1 AND s.modification_id = $2 AND v.user_id = $3;
	`
	err = tx.QueryRow(ctx, verifyQuery, setID, modID, userID).Scan(&dummy)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("failed to verify setting set ownership: %w", err)
	}

	// 2. 互斥切換：先將該改裝品所有設定組的 is_current 設為 false
	clearQuery := `
		UPDATE "ModificationSettingSets"
		SET is_current = false, updated_at = now()
		WHERE modification_id = $1 AND is_current = true;
	`
	_, err = tx.Exec(ctx, clearQuery, modID)
	if err != nil {
		return fmt.Errorf("failed to clear previous current setting set: %w", err)
	}

	// 3. 將目標設定組的 is_current 設為 true
	setQuery := `
		UPDATE "ModificationSettingSets"
		SET is_current = true, updated_at = now()
		WHERE id = $1 AND modification_id = $2;
	`
	_, err = tx.Exec(ctx, setQuery, setID, modID)
	if err != nil {
		return fmt.Errorf("failed to set target current setting set: %w", err)
	}

	return tx.Commit(ctx)
}
