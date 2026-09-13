import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { maintenanceService, MaintenanceRecordWithPhotos } from '../../services/maintenanceService';
import { MaintenanceRecordInsert, MaintenanceRecordUpdate } from '../../types/database';
import { queryKeys } from './queryKeys';

/**
 * 保養維修紀錄清單 Query Hook
 */
export function useMaintenanceRecords(vehicleId: number) {
  return useQuery({
    queryKey: queryKeys.maintenance(vehicleId),
    queryFn: () => maintenanceService.getMaintenanceRecords(vehicleId),
    enabled: typeof vehicleId === 'number' && vehicleId > 0,
  });
}

/**
 * 新增保養維修紀錄 Mutation Hook (包含照片連結寫入)
 */
export function useCreateMaintenanceRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recordData,
      photoUrls,
    }: {
      recordData: MaintenanceRecordInsert;
      photoUrls?: string[];
    }) => maintenanceService.createRecordWithPhotos(recordData, photoUrls),
    onSuccess: (newRecord) => {
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
