import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { maintenanceService, MaintenanceRecordWithPhotos } from '../../services/maintenanceService';
import { MaintenanceRecordInsert, MaintenanceRecordUpdate, VehicleWithCover } from '../../types/database';
import { queryKeys } from './queryKeys';
import { cacheStorage, CACHE_KEYS } from '../../lib/cacheStorage';
import { networkMonitor } from '../../services/networkMonitor';
import { syncQueue } from '../../services/syncQueue';
import { AppError } from '../../services/errors/AppError';

/**
 * 保養維修紀錄清單 Query Hook (支援離線讀取快照)
 */
export function useMaintenanceRecords(vehicleId: number) {
  return useQuery({
    queryKey: queryKeys.maintenance(vehicleId),
    queryFn: async () => {
      const cacheKey = `${CACHE_KEYS.MAINTENANCE_PREFIX}${vehicleId}`;
      try {
        const data = await maintenanceService.getMaintenanceRecords(vehicleId);
        await cacheStorage.setItem(cacheKey, cacheStorage.sliceSnapshot(data, 20));
        return data;
      } catch (err) {
        const cached = await cacheStorage.getItem<MaintenanceRecordWithPhotos[]>(cacheKey);
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
 * 新增保養維修紀錄 Mutation Hook (支援離線文字工單寫入排隊與里程樂觀推昇)
 */
export function useCreateMaintenanceRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recordData,
      photoUrls,
    }: {
      recordData: MaintenanceRecordInsert;
      photoUrls?: string[];
    }) => {
      const handleOfflineCreate = async (): Promise<MaintenanceRecordWithPhotos> => {
        const tempRecord: MaintenanceRecordWithPhotos = {
          id: -Date.now(),
          vehicle_id: recordData.vehicle_id,
          record_type: recordData.record_type,
          service_date: recordData.service_date,
          mileage: recordData.mileage,
          item_name: recordData.item_name,
          cost: recordData.cost ?? 0,
          shop_name: recordData.shop_name ?? null,
          note: recordData.note ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          photos: [],
        };

        // 入列離線持久化佇列 (純文字工單)
        await syncQueue.enqueue('ADD_MAINTENANCE', recordData, recordData.vehicle_id);

        // 樂觀更新工單快取
        queryClient.setQueryData<MaintenanceRecordWithPhotos[]>(
          queryKeys.maintenance(recordData.vehicle_id),
          (old = []) => [tempRecord, ...old]
        );

        // 若有填寫里程，樂觀推昇車輛當前里程
        if (typeof recordData.mileage === 'number') {
          const recMileage = recordData.mileage;
          queryClient.setQueryData<VehicleWithCover[]>(queryKeys.vehicles, (oldVehicles = []) =>
            oldVehicles.map((v) =>
              v.id === recordData.vehicle_id
                ? { ...v, current_mileage: Math.max(v.current_mileage, recMileage) }
                : v
            )
          );
        }

        return tempRecord;
      };

      if (!networkMonitor.getIsOnline()) {
        return await handleOfflineCreate();
      }

      try {
        return await maintenanceService.createRecordWithPhotos(recordData, photoUrls);
      } catch (err: unknown) {
        const appErr = AppError.from(err);
        if (appErr.code === 'NETWORK_ERROR') {
          return await handleOfflineCreate();
        }
        throw err;
      }
    },
    onSuccess: (newRecord) => {
      if (newRecord.id > 0) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.maintenance(newRecord.vehicle_id),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.vehicles,
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.reminders(newRecord.vehicle_id),
        });
        // 同步刷新時間軸與車輛費用
        queryClient.invalidateQueries({
          queryKey: queryKeys.timeline(newRecord.vehicle_id),
        });
        queryClient.invalidateQueries({
          queryKey: ['costAnalytics', newRecord.vehicle_id],
        });
      }
    },
  });
}

/**
 * 更新保養維修紀錄 Mutation Hook
 */
export function useUpdateMaintenanceRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: MaintenanceRecordUpdate }) =>
      maintenanceService.updateMaintenanceRecord(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.maintenance(updated.vehicle_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.vehicles,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reminders(updated.vehicle_id),
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
 * 刪除保養維修紀錄 Mutation Hook
 */
export function useDeleteMaintenanceRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, vehicleId }: { id: number; vehicleId: number }) =>
      maintenanceService.deleteMaintenanceRecord(id, vehicleId),
    onSuccess: (_, { vehicleId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.maintenance(vehicleId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.vehicles,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reminders(vehicleId),
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

/**
 * 追加保養照片 Mutation Hook
 */
export function useAddMaintenancePhotos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      maintenanceRecordId,
      photoUrls,
      vehicleId,
    }: {
      maintenanceRecordId: number;
      photoUrls: string[];
      vehicleId?: number;
    }) => maintenanceService.addMaintenancePhotos(maintenanceRecordId, photoUrls),
    onSuccess: (_, { vehicleId }) => {
      if (vehicleId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.maintenance(vehicleId) });
      }
    },
  });
}

/**
 * 刪除單張保養照片 Mutation Hook
 */
export function useDeleteMaintenancePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      photoId,
      vehicleId,
    }: {
      photoId: number;
      vehicleId?: number;
    }) => maintenanceService.deleteMaintenancePhoto(photoId),
    onSuccess: (_, { vehicleId }) => {
      if (vehicleId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.maintenance(vehicleId) });
      }
    },
  });
}
