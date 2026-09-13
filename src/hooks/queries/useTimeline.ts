import { useInfiniteQuery } from '@tanstack/react-query';
import { timelineService } from '../../services/timelineService';
import { queryKeys } from './queryKeys';

const PAGE_SIZE = 20;

/**
 * 車輛時間軸 Infinite Query Hook
 * 直接查詢 SQL View vehicle_timeline，支援無縫分頁加載
 */
export function useTimeline(vehicleId: number) {
  return useInfiniteQuery({
    queryKey: queryKeys.timeline(vehicleId),
    queryFn: ({ pageParam = 0 }) =>
      timelineService.getVehicleTimeline({
        vehicleId,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) {
        return undefined; // 沒有更多資料
      }
      return allPages.length * PAGE_SIZE;
    },
    enabled: typeof vehicleId === 'number' && vehicleId > 0,
  });
}
