import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vehicleService } from '../../services/vehicleService';
import { VehicleInsert, VehicleUpdate } from '../../types/database';
import { queryKeys } from './queryKeys';

/**
 * 車輛清單 Query Hook (預設包含封面照片，單一查詢免手動 merge)
 */
export function useVehicles() {
  return useQuery({
    queryKey: queryKeys.vehicles,
    queryFn: () => vehicleService.getVehicles(),
  });
}

/**
 * 單一車輛詳細 Query Hook (包含所有照片)
 */
export function useVehicle(id: number) {
  return useQuery({
    queryKey: queryKeys.vehicle(id),
    queryFn: () => vehicleService.getVehicleById(id),
    enabled: typeof id === 'number' && id > 0,
  });
}

/**
 * 車輛新增 Mutation Hook
 */
export function useCreateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<VehicleInsert, 'user_id'>) => vehicleService.createVehicle(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles });
    },
  });
}

/**
 * 車輛更新 Mutation Hook
 */
export function useUpdateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: VehicleUpdate }) =>
      vehicleService.updateVehicle(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles });
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicle(id) });
    },
  });
}

/**
 * 車輛刪除 Mutation Hook
 */
export function useDeleteVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => vehicleService.deleteVehicle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles });
    },
  });
}

/**
 * 設定封面照 Mutation Hook
 */
export function useSetCoverPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ vehicleId, photoId }: { vehicleId: number; photoId: number }) =>
      vehicleService.setCoverPhoto(vehicleId, photoId),
    onSuccess: (_, { vehicleId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles });
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicle(vehicleId) });
    },
  });
}
