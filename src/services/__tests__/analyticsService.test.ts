import { analyticsService } from '../analyticsService';
import { requestApi } from '../apiClient';

jest.mock('../apiClient', () => ({
  requestApi: jest.fn(),
}));

describe('analyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getVehicleCostAnalytics 預設查詢 12 個月', async () => {
    const mockData = {
      vehicle_id: 1,
      total_operational_cost: 15000,
      total_ownership_cost: 115000,
      cost_per_km: 15,
      fuel_cost_per_km: 5,
      total_distance_km: 1000,
      category_breakdown: {
        fuel: 5000,
        maintenance: 4000,
        repair: 2000,
        modification: 4000,
        total: 15000,
      },
      monthly_trend: [],
    };
    (requestApi as jest.Mock).mockResolvedValue(mockData);

    const result = await analyticsService.getVehicleCostAnalytics(1);

    expect(requestApi).toHaveBeenCalledWith('/vehicles/1/analytics/cost?months=12');
    expect(result).toEqual(mockData);
  });

  it('getVehicleCostAnalytics 支援指定 months 參數', async () => {
    const mockData = {
      vehicle_id: 2,
      total_operational_cost: 0,
      total_ownership_cost: null,
      cost_per_km: null,
      fuel_cost_per_km: null,
      total_distance_km: 0,
      category_breakdown: {
        fuel: 0,
        maintenance: 0,
        repair: 0,
        modification: 0,
        total: 0,
      },
      monthly_trend: [],
    };
    (requestApi as jest.Mock).mockResolvedValue(mockData);

    const result = await analyticsService.getVehicleCostAnalytics(2, 6);

    expect(requestApi).toHaveBeenCalledWith('/vehicles/2/analytics/cost?months=6');
    expect(result).toEqual(mockData);
  });
});
