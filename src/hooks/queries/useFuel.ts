import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fuelService } from '../../services/fuelService';
import { RefuelInsert, RefuelUpdate, RefuelRow, VehicleWithCover } from '../../types/database';
import { queryKeys } from './queryKeys';
import { cacheStorage, CACHE_KEYS } from '../../lib/cacheStorage';
import { networkMonitor } from '../../services/networkMonitor';
import { syncQueue } from '../../services/syncQueue';
import { AppError } from '../../services/errors/AppError';

/**
 * 加油紀錄清單 Query Hook (支援離線讀取快照)
 */
export function useRefuels(vehicleId: number) {
  return useQuery({
    queryKey: queryKeys.refuels(vehicleId),
    queryFn: async () => {
      const cacheKey = `${CACHE_KEYS.REFUELS_PREFIX}${vehicleId}`;
      try {
        const data = await fuelService.getRefuels(vehicleId);
        await cacheStorage.setItem(cacheKey, cacheStorage.sliceSnapshot(data, 20));
        return data;
      } catch (err) {
        const cached = await cacheStorage.getItem<RefuelRow[]>(cacheKey);
        if (cached) {
          return cached;
        }
        throw err;
      }
    },
    enabled: typeof vehicleId === 'number' && vehicleId > 0,
  });
}

/**
 * 新增加油紀錄 Mutation Hook (支援離線寫入排隊與里程樂觀推昇)
 */
export function useAddRefuel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RefuelInsert) => {
      // 輔助函式：建立本地暫態紀錄並進入離線佇列
      const handleOfflineAdd = async (): Promise<RefuelRow> => {
        const tempRefuel: RefuelRow = {
          id: -Date.now(),
          vehicle_id: data.vehicle_id,
          refuel_date: data.refuel_date,
          mileage: data.mileage,
          volume: data.volume,
          price_per_unit: data.price_per_unit ?? null,
          total_cost: data.total_cost,
          fuel_type: data.fuel_type,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // 入列離線持久化佇列
        await syncQueue.enqueue('ADD_REFUEL', data, data.vehicle_id);

        // 樂觀更新加油快取
        queryClient.setQueryData<RefuelRow[]>(queryKeys.refuels(data.vehicle_id), (old = []) => [
          tempRefuel,
          ...old,
        ]);

        // 樂觀推昇車輛當前里程 (Math.max)
        queryClient.setQueryData<VehicleWithCover[]>(queryKeys.vehicles, (oldVehicles = []) =>
          oldVehicles.map((v) =>
            v.id === data.vehicle_id
              ? { ...v, current_mileage: Math.max(v.current_mileage, data.mileage) }
              : v
          )
        );

        return tempRefuel;
      };

      if (!networkMonitor.getIsOnline()) {
        return await handleOfflineAdd();
      }

      try {
        return await fuelService.addRefuel(data);
      } catch (err: unknown) {
        const appErr = AppError.from(err);
        if (appErr.code === 'NETWORK_ERROR') {
          return await handleOfflineAdd();
        }
        throw err;
      }
    },
    onSuccess: (newRefuel) => {
      // 若非離線暫態 ID (正整數)，才觸發伺服器無效化
      if (newRefuel.id > 0) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.refuels(newRefuel.vehicle_id),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.vehicles,
        });
        // 加油也會在時間軸產生事件，同步 invalidate 時間軸
        queryClient.invalidateQueries({
          queryKey: queryKeys.timeline(newRefuel.vehicle_id),
        });
        queryClient.invalidateQueries({
          queryKey: ['costAnalytics', newRefuel.vehicle_id],
        });
      }
    },
  });
}

/**
 * 更新加油紀錄 Mutation Hook
 */
export function useUpdateRefuel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: RefuelUpdate }) =>
      fuelService.updateRefuel(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.refuels(updated.vehicle_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.vehicles,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.timeline(updated.vehicle_id),
      });
      queryClient.invalidateQueries({
        queryKey: ['costAnalytics', updated.vehicle_id],
      });
    },
  });
}

/**
 * 刪除加油紀錄 Mutation Hook
 */
export function useDeleteRefuel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, vehicleId }: { id: number; vehicleId: number }) =>
      fuelService.deleteRefuel(id, vehicleId),
    onSuccess: (_, { vehicleId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.refuels(vehicleId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.vehicles,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.timeline(vehicleId),
      });
      queryClient.invalidateQueries({
        queryKey: ['costAnalytics', vehicleId],
      });
    },
  });
}

