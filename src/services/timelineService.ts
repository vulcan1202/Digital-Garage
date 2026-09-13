import { supabase, requireUser } from '../lib/supabase';
import { localStore } from '../lib/localStore';
import { VehicleTimelineRow } from '../types/database';
import { handleServiceCall } from './errors/AppError';

export interface TimelinePaginationParams {
  vehicleId: number;
  limit?: number;
  offset?: number;
}

export const timelineService = {
  /**
   * 專職向 SQL View「vehicle_timeline」查詢車輛時間軸動態
   */
  async getVehicleTimeline({
    vehicleId,
    limit = 20,
    offset = 0,
  }: TimelinePaginationParams): Promise<VehicleTimelineRow[]> {
    return handleServiceCall(async () => {
      await requireUser();

      try {
        const { data, error } = await supabase
          .from('vehicle_timeline')
          .select('*')
          .eq('vehicle_id', vehicleId)
          .order('event_date', { ascending: false })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (!error && data && data.length > 0) {
          return data as VehicleTimelineRow[];
        }
      } catch {
        // Fallback
      }

      const localTimeline = await localStore.getTimeline(vehicleId);
      return localTimeline.slice(offset, offset + limit);
    });
  },
};
