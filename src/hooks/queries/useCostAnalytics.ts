import { useQuery } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { analyticsService, VehicleCostAnalyticsResponse } from '../../services/analyticsService';

/**
 * 查詢指定車輛的持有與營運成本多維度分析
 * @param vehicleId 車輛 ID
 * @param months 查詢月份數量 (預設 12)
 */
export function useCostAnalytics(vehicleId?: number, months = 12) {
  return useQuery<VehicleCostAnalyticsResponse>({
    queryKey: vehicleId ? queryKeys.costAnalytics(vehicleId, months) : ['costAnalytics', 0, months],
    queryFn: () => {
      if (!vehicleId) throw new Error('Vehicle ID is required');
      return analyticsService.getVehicleCostAnalytics(vehicleId, months);
    },
    enabled: typeof vehicleId === 'number' && vehicleId > 0,
    staleTime: 1000 * 60 * 5, // 5 分鐘快取
  });
}
