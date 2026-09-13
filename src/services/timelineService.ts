import { supabase, requireUser } from '../lib/supabase';
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
   * 鐵律宣告：此 View 已設定 WITH (security_invoker = true)，自動繼承底層 RLS。
   * 前端時間軸牆必須直接向此 View 查詢，嚴禁在前端發起三次 API 手動合併與排序！
   */
  async getVehicleTimeline({
    vehicleId,
    limit = 20,
    offset = 0,
  }: TimelinePaginationParams): Promise<VehicleTimelineRow[]> {
    return handleServiceCall(async () => {
      await requireUser();

      const { data, error } = await supabase
        .from('vehicle_timeline')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('event_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return (data || []) as VehicleTimelineRow[];
    });
  },
};
