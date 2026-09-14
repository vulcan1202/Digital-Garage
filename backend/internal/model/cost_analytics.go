package model

// CostCategoryBreakdown 四大支出維度總計 (嚴格拆分定期保養與故障維修)
type CostCategoryBreakdown struct {
	Fuel         float64 `json:"fuel"`
	Maintenance  float64 `json:"maintenance"`
	Repair       float64 `json:"repair"`
	Modification float64 `json:"modification"`
	Total        float64 `json:"total"`
}

// MonthlyCostPoint 月度連續統計點 (對齊 YYYY-MM)
type MonthlyCostPoint struct {
	YearMonth    string  `json:"year_month"` // "YYYY-MM"
	Fuel         float64 `json:"fuel"`
	Maintenance  float64 `json:"maintenance"`
	Repair       float64 `json:"repair"`
	Modification float64 `json:"modification"`
	Total        float64 `json:"total"`
}

// VehicleCostAnalyticsResponse 車輛持有與營運成本多維度分析回傳結構
type VehicleCostAnalyticsResponse struct {
	VehicleID            int                   `json:"vehicle_id"`
	TotalOperationalCost float64               `json:"total_operational_cost"`
	TotalOwnershipCost   *float64              `json:"total_ownership_cost"` // 未設定購車價時為 null
	CostPerKM            *float64              `json:"cost_per_km"`          // 里程差 <= 0 時為 null
	FuelCostPerKM        *float64              `json:"fuel_cost_per_km"`     // 里程差 <= 0 時為 null
	TotalDistanceKM      int                   `json:"total_distance_km"`
	CategoryBreakdown    CostCategoryBreakdown `json:"category_breakdown"`
	MonthlyTrend         []MonthlyCostPoint    `json:"monthly_trend"` // 補零後的連續 N 個月份陣列
}
