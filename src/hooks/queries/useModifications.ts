import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { modificationService } from '../../services/modificationService';
import {
  ModificationInsert,
  ModificationUpdate,
  ModificationSettingSetInsert,
  ModificationSettingInsert,
} from '../../types/database';
import { queryKeys } from './queryKeys';

/**
 * 改裝品清單 Query Hook
 */
export function useModifications(vehicleId: number) {
  return useQuery({
    queryKey: queryKeys.modifications(vehicleId),
    queryFn: () => modificationService.getModifications(vehicleId),
    enabled: typeof vehicleId === 'number' && vehicleId > 0,
  });
}

/**
 * 改裝品完整詳細資訊 Query Hook (含照片、設定組與細項通用參數)
 */
export function useModificationDetail(modId: number) {
  return useQuery({
    queryKey: queryKeys.modificationDetail(modId),
    queryFn: () => modificationService.getModificationDetails(modId),
    enabled: typeof modId === 'number' && modId > 0,
  });
}

/**
 * 新增改裝品 Mutation Hook
 */
export function useAddModification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ModificationInsert) => modificationService.addModification(data),
    onSuccess: (newMod) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.modifications(newMod.vehicle_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.vehicles,
      });
      // 新增改裝品也會在時間軸產生事件，同步 invalidate 時間軸
      queryClient.invalidateQueries({
        queryKey: queryKeys.timeline(newMod.vehicle_id),
      });
      queryClient.invalidateQueries({
        queryKey: ['costAnalytics', newMod.vehicle_id],
      });
    },
  });
}

/**
 * 切換當前使用中的調校設定組 Mutation Hook
 */
export function useSetCurrentSettingSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ modificationId, setId }: { modificationId: number; setId: number }) =>
      modificationService.setCurrentSettingSet(modificationId, setId),
    onSuccess: (_, { modificationId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.modificationDetail(modificationId),
      });
    },
  });
}

/**
 * 建立新調校設定組與通用參數 Mutation Hook
 */
export function useCreateSettingSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      modificationId,
      setData,
      settings,
    }: {
      modificationId: number;
      setData: Omit<ModificationSettingSetInsert, 'modification_id'>;
      settings?: Omit<ModificationSettingInsert, 'setting_set_id'>[];
    }) => modificationService.createSettingSet(modificationId, setData, settings),
    onSuccess: (_, { modificationId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.modificationDetail(modificationId),
      });
    },
  });
}

/**
 * 刪除改裝品 Mutation Hook
 */
export function useDeleteModification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, vehicleId }: { id: number; vehicleId: number }) =>
      modificationService.deleteModification(id, vehicleId),
    onSuccess: (_, { vehicleId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.modifications(vehicleId),
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

/**
 * 更新改裝品本體資訊 Mutation Hook
 */
export function useUpdateModification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ModificationUpdate }) =>
      modificationService.updateModification(id, data),
    onSuccess: (updatedMod) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.modifications(updatedMod.vehicle_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.vehicles,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.modificationDetail(updatedMod.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.timeline(updatedMod.vehicle_id),
      });
      queryClient.invalidateQueries({
        queryKey: ['costAnalytics', updatedMod.vehicle_id],
      });
    },
  });
}

/**
 * 追加改裝照片 Mutation Hook
 */
export function useAddModificationPhotos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      modificationId,
      photos,
    }: {
      modificationId: number;
      photos: Array<{ url: string; photo_type?: string }>;
    }) => modificationService.addModificationPhotos(modificationId, photos),
    onSuccess: (_, { modificationId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.modificationDetail(modificationId),
      });
    },
  });
}

/**
 * 刪除改裝照片 Mutation Hook
 */
export function useDeleteModificationPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      photoId,
      modificationId,
    }: {
      photoId: number;
      modificationId: number;
    }) => modificationService.deleteModificationPhoto(photoId),
    onSuccess: (_, { modificationId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.modificationDetail(modificationId),
      });
    },
  });
}

