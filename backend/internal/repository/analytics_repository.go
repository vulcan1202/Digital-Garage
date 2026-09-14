package repository

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"digital-garage-backend/internal/model"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AnalyticsRepository struct {
	pool *pgxpool.Pool
}

func NewAnalyticsRepository(pool *pgxpool.Pool) *AnalyticsRepository {
	return &AnalyticsRepository{pool: pool}
}

// round2 四捨五入至小數點後兩位
func round2(val float64) float64 {
	return math.Round(val*100) / 100
}

// GetVehicleCostAnalytics 計算指定車輛的持有與營運成本多維度分析 (包含連續 N 個月補零序列)
func (r *AnalyticsRepository) GetVehicleCostAnalytics(ctx context.Context, userID string, vehicleID int, months int) (*model.VehicleCostAnalyticsResponse, error) {
	// 1. 查詢車輛基準資訊並嚴格校驗所有權
	vehicleQuery := `
		SELECT id, initial_mileage, current_mileage, purchase_price
		FROM "Vehicles"
		WHERE id = $1 AND user_id = $2;
	`
	var (
		vID            int
		initialMileage int
		currentMileage int
		purchasePrice  *float64
	)

	err := r.pool.QueryRow(ctx, vehicleQuery, vehicleID, userID).Scan(
		&vID, &initialMileage, &currentMileage, &purchasePrice,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to query vehicle for analytics: %w", err)
	}

	// 2. 透過條件聚合一次性取得四大維度之歷史總花費 (避免 N+1 查詢)
	// 嚴格拆分 Maintenance 與 Repair
	totalsQuery := `
		SELECT 
			COALESCE((SELECT SUM(total_cost) FROM "Refuels" WHERE vehicle_id = $1), 0) AS fuel_total,
			COALESCE((SELECT SUM(CASE WHEN record_type = 'maintenance' THEN cost ELSE 0 END) FROM "MaintenanceRecords" WHERE vehicle_id = $1), 0) AS maintenance_total,
			COALESCE((SELECT SUM(CASE WHEN record_type = 'repair' THEN cost ELSE 0 END) FROM "MaintenanceRecords" WHERE vehicle_id = $1), 0) AS repair_total,
			COALESCE((SELECT SUM(COALESCE(purchase_price, 0) + COALESCE(install_price, 0)) FROM "Modifications" WHERE vehicle_id = $1), 0) AS modification_total;
	`
	var fuelTotal, maintTotal, repairTotal, modTotal float64
	err = r.pool.QueryRow(ctx, totalsQuery, vehicleID).Scan(
		&fuelTotal, &maintTotal, &repairTotal, &modTotal,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query cost totals: %w", err)
	}

	// 3. 生成連續 N 個月的 YYYY-MM 序列 (包含當前月份，依時間升冪排序)
	now := time.Now()
	// 定義時間窗起始：以當月 1 號向前推 (months - 1) 個月
	startMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local).AddDate(0, -(months - 1), 0)
	startDateStr := startMonth.Format("2006-01-02")

	monthList := make([]string, months)
	for i := 0; i < months; i++ {
		mTime := startMonth.AddDate(0, i, 0)
		monthList[i] = mTime.Format("2006-01")
	}

	// 4. 單一 SQL 聚合查詢近 N 個月各月份之支出 (加油、保養、維修、改裝購買、改裝安裝)
	// 鐵律：
	// - purchase_price 依 purchase_date 歸屬月份
	// - install_price 依 install_date 歸屬月份
	// - 日期為 NULL 時絕不假造 created_at，不歸入任何月份
	monthlyQuery := `
		WITH monthly_expenses AS (
			-- 加油月度匯總
			SELECT 
				to_char(date_trunc('month', refuel_date), 'YYYY-MM') AS ym,
				total_cost AS amount,
				'fuel' AS category
			FROM "Refuels"
			WHERE vehicle_id = $1 AND refuel_date >= $2::date

			UNION ALL

			-- 保養與維修月度匯總 (以 record_type 嚴格拆分)
			SELECT 
				to_char(date_trunc('month', service_date), 'YYYY-MM') AS ym,
				cost AS amount,
				record_type::text AS category
			FROM "MaintenanceRecords"
			WHERE vehicle_id = $1 AND service_date >= $2::date

			UNION ALL

			-- 改裝品購買成本月度匯總 (依 purchase_date)
			SELECT 
				to_char(date_trunc('month', purchase_date), 'YYYY-MM') AS ym,
				purchase_price AS amount,
				'modification' AS category
			FROM "Modifications"
			WHERE vehicle_id = $1 
			  AND purchase_date IS NOT NULL 
			  AND purchase_date >= $2::date
			  AND purchase_price > 0

			UNION ALL

			-- 改裝品安裝工資月度匯總 (依 install_date)
			SELECT 
				to_char(date_trunc('month', install_date), 'YYYY-MM') AS ym,
				install_price AS amount,
				'modification' AS category
			FROM "Modifications"
			WHERE vehicle_id = $1 
			  AND install_date IS NOT NULL 
			  AND install_date >= $2::date
			  AND install_price > 0
		)
		SELECT 
			ym,
			COALESCE(SUM(CASE WHEN category = 'fuel' THEN amount ELSE 0 END), 0) AS fuel,
			COALESCE(SUM(CASE WHEN category = 'maintenance' THEN amount ELSE 0 END), 0) AS maintenance,
			COALESCE(SUM(CASE WHEN category = 'repair' THEN amount ELSE 0 END), 0) AS repair,
			COALESCE(SUM(CASE WHEN category = 'modification' THEN amount ELSE 0 END), 0) AS modification
		FROM monthly_expenses
		GROUP BY ym;
	`

	rows, err := r.pool.Query(ctx, monthlyQuery, vehicleID, startDateStr)
	if err != nil {
		return nil, fmt.Errorf("failed to query monthly cost trend: %w", err)
	}
	defer rows.Close()

	type monthAgg struct {
		fuel         float64
		maintenance  float64
		repair       float64
		modification float64
	}
	dbMonths := make(map[string]monthAgg)
	for rows.Next() {
		var ym string
		var agg monthAgg
		if err := rows.Scan(&ym, &agg.fuel, &agg.maintenance, &agg.repair, &agg.modification); err != nil {
			return nil, fmt.Errorf("failed to scan monthly row: %w", err)
		}
		dbMonths[ym] = agg
	}

	// 5. 補零對齊 (Zero-fill) 構建長度恰為 N 的連續月度序列
	monthlyTrend := make([]model.MonthlyCostPoint, months)
	for i, ym := range monthList {
		agg := dbMonths[ym]
		f := round2(agg.fuel)
		m := round2(agg.maintenance)
		rep := round2(agg.repair)
		mod := round2(agg.modification)
		tot := round2(f + m + rep + mod)

		monthlyTrend[i] = model.MonthlyCostPoint{
			YearMonth:    ym,
			Fuel:         f,
			Maintenance:  m,
			Repair:       rep,
			Modification: mod,
			Total:        tot,
		}
	}

	// 6. 指標計算與邊界防護 (Zero-Division Guard & Null TCO)
	fuelTotal = round2(fuelTotal)
	maintTotal = round2(maintTotal)
	repairTotal = round2(repairTotal)
	modTotal = round2(modTotal)
	operationalTotal := round2(fuelTotal + maintTotal + repairTotal + modTotal)

	categoryBreakdown := model.CostCategoryBreakdown{
		Fuel:         fuelTotal,
		Maintenance:  maintTotal,
		Repair:       repairTotal,
		Modification: modTotal,
		Total:        operationalTotal,
	}

	var totalOwnershipCost *float64
	if purchasePrice != nil && *purchasePrice >= 0 {
		tco := round2(*purchasePrice + operationalTotal)
		totalOwnershipCost = &tco
	}

	deltaMileage := currentMileage - initialMileage
	var costPerKM *float64
	var fuelCostPerKM *float64
	if deltaMileage > 0 {
		cpk := round2(operationalTotal / float64(deltaMileage))
		costPerKM = &cpk
		fcpk := round2(fuelTotal / float64(deltaMileage))
		fuelCostPerKM = &fcpk
	}

	return &model.VehicleCostAnalyticsResponse{
		VehicleID:            vehicleID,
		TotalOperationalCost: operationalTotal,
		TotalOwnershipCost:   totalOwnershipCost,
		CostPerKM:            costPerKM,
		FuelCostPerKM:        fuelCostPerKM,
		TotalDistanceKM:      deltaMileage,
		CategoryBreakdown:    categoryBreakdown,
		MonthlyTrend:         monthlyTrend,
	}, nil
}
