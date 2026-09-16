import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vehicleService } from '../../services/vehicleService';
import { VehicleInsert, VehicleUpdate, VehicleWithCover, VehicleRow, VehiclePhotoRow } from '../../types/database';
import { queryKeys } from './queryKeys';
import { cacheStorage, CACHE_KEYS } from '../../lib/cacheStorage';

/**
 * 車輛清單 Query Hook (預設包含封面照片，單一查詢免手動 merge，支援離線快照還原)
 */
export function useVehicles() {
  return useQuery({
    queryKey: queryKeys.vehicles,
    queryFn: async () => {
      try {
        const vehicles = await vehicleService.getVehicles();
        await cacheStorage.setItem(CACHE_KEYS.VEHICLES, vehicles);
        return vehicles;
      } catch (err) {
        const cached = await cacheStorage.getItem<VehicleWithCover[]>(CACHE_KEYS.VEHICLES);
        if (cached && cached.length > 0) {
          return cached;
        }
        throw err;
      }
    },
  });
}

/**
 * 單一車輛詳細 Query Hook (包含所有照片，支援離線快照還原)
 */
export function useVehicle(id: number) {
  return useQuery({
    queryKey: queryKeys.vehicle(id),
    queryFn: async () => {
      const cacheKey = `${CACHE_KEYS.VEHICLES}_${id}`;
      try {
        const vehicle = await vehicleService.getVehicleById(id);
        await cacheStorage.setItem(cacheKey, vehicle);
        return vehicle;
      } catch (err) {
        const cached = await cacheStorage.getItem<VehicleRow & { photos: VehiclePhotoRow[] }>(cacheKey);
        if (cached) {
          return cached;
        }
        throw err;
      }
    },
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
 * 車輛相片清單 Query Hook
 */
export function useVehiclePhotos(vehicleId: number) {
  return useQuery({
    queryKey: queryKeys.vehiclePhotos(vehicleId),
    queryFn: () => vehicleService.getVehiclePhotos(vehicleId),
    enabled: typeof vehicleId === 'number' && vehicleId > 0,
  });
}

/**
 * 車輛新增相片 Mutation Hook
 */
export function useAddVehiclePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      vehicleId,
      url,
      isCover,
      sortOrder,
    }: {
      vehicleId: number;
      url: string;
      isCover?: boolean;
      sortOrder?: number;
    }) => vehicleService.addVehiclePhoto(vehicleId, url, isCover, sortOrder),
    onSuccess: (_, { vehicleId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles });
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicle(vehicleId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.vehiclePhotos(vehicleId) });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.vehiclePhotos(vehicleId) });
    },
  });
}

/**
 * 刪除車輛相片 Mutation Hook
 */
export function useDeleteVehiclePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ photoId, vehicleId }: { photoId: number; vehicleId: number }) =>
      vehicleService.deleteVehiclePhoto(photoId, vehicleId),
    onSuccess: (_, { vehicleId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles });
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicle(vehicleId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.vehiclePhotos(vehicleId) });
    },
  });
}
