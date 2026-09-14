import { requestApi } from './apiClient';
import { VehicleTimelineRow } from '../types/database';
import { handleServiceCall } from './errors/AppError';

export interface TimelinePaginationParams {
  vehicleId: number;
  limit?: number;
  offset?: number;
}

export const timelineService = {
  /**
   * 專職向 Go REST API (/vehicles/:vehicleId/timeline) 查詢 SQL View「vehicle_timeline」車輛時間軸動態
   */
  async getVehicleTimeline({
    vehicleId,
    limit = 20,
    offset = 0,
  }: TimelinePaginationParams): Promise<VehicleTimelineRow[]> {
    return handleServiceCall(async () => {
      return await requestApi<VehicleTimelineRow[]>(
        `/vehicles/${vehicleId}/timeline?limit=${limit}&offset=${offset}`
      );
    });
  },
};

