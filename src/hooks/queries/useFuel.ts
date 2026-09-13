import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fuelService } from '../../services/fuelService';
import { RefuelInsert, RefuelUpdate } from '../../types/database';
import { queryKeys } from './queryKeys';

/**
 * 加油紀錄清單 Query Hook
 */
export function useRefuels(vehicleId: number) {
  return useQuery({
    queryKey: queryKeys.refuels(vehicleId),
    queryFn: () => fuelService.getRefuels(vehicleId),
    enabled: typeof vehicleId === 'number' && vehicleId > 0,
  });
}

/**
 * 新增加油紀錄 Mutation Hook
 */
export function useAddRefuel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RefuelInsert) => fuelService.addRefuel(data),
    onSuccess: (newRefuel) => {
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
      fuelService.deleteRefuel(id),
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
    },
  });
}

