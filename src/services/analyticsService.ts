import { requestApi } from './apiClient';

export interface CostCategoryBreakdown {
  fuel: number;
  maintenance: number;
  repair: number;
  modification: number;
  total: number;
}

export interface MonthlyCostPoint {
  year_month: string;
  fuel: number;
  maintenance: number;
  repair: number;
  modification: number;
  total: number;
}

export interface VehicleCostAnalyticsResponse {
  vehicle_id: number;
  total_operational_cost: number;
  total_ownership_cost: number | null;
  cost_per_km: number | null;
  fuel_cost_per_km: number | null;
  total_distance_km: number;
  category_breakdown: CostCategoryBreakdown;
  monthly_trend: MonthlyCostPoint[];
}

export const analyticsService = {
  /**
   * 取得車輛持有與營運成本多維度分析
   * @param vehicleId 車輛識別碼
   * @param months 查詢月份數 (1 ~ 24, 預設 12)
   */
  async getVehicleCostAnalytics(
    vehicleId: number,
    months = 12
  ): Promise<VehicleCostAnalyticsResponse> {
    return requestApi<VehicleCostAnalyticsResponse>(
      `/vehicles/${vehicleId}/analytics/cost?months=${months}`
    );
  },
};
