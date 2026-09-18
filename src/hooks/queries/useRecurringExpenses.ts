import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recurringExpenseService } from '../../services/recurringExpenseService';
import { RecurringExpenseInsert, RecurringExpenseUpdate } from '../../types/database';
import { queryKeys } from './queryKeys';

/**
 * 取得指定車輛的週期性規費紀錄列表
 */
export function useRecurringExpenses(vehicleId: number, category?: string) {
  return useQuery({
    queryKey: queryKeys.recurringExpenses(vehicleId, category),
    queryFn: () => recurringExpenseService.getRecurringExpenses(vehicleId, category),
    enabled: vehicleId > 0,
    staleTime: 1000 * 60 * 5, // 5 分鐘
  });
}

/**
 * 取得指定車輛各類別（牌照稅、公路養管費、定檢、保險）之最新到期與警報狀態摘要
 */
export function useRecurringStatus(vehicleId: number) {
  return useQuery({
    queryKey: queryKeys.recurringStatus(vehicleId),
    queryFn: () => recurringExpenseService.getRecurringStatus(vehicleId),
    enabled: vehicleId > 0,
    staleTime: 1000 * 60 * 2, // 2 分鐘
  });
}

/**
 * 新增週期性規費紀錄 Mutation
 * 遵循安全防護要點：若涉及 sync_as_manufacture_date，需連動使車輛快取失效
 */
export function useCreateRecurringExpenseMutation(vehicleId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RecurringExpenseInsert) =>
      recurringExpenseService.createRecurringExpense(vehicleId, data),
    onSuccess: () => {
      // 依規範同時觸發連動失效
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicle(vehicleId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles });
      queryClient.invalidateQueries({ queryKey: ['recurringExpenses', vehicleId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.recurringStatus(vehicleId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeline(vehicleId) });
      queryClient.invalidateQueries({ queryKey: ['costAnalytics', vehicleId] });
    },
  });
}

/**
 * 更新週期性規費紀錄 Mutation
 */
export function useUpdateRecurringExpenseMutation(vehicleId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: RecurringExpenseUpdate }) =>
      recurringExpenseService.updateRecurringExpense(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringExpenses', vehicleId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.recurringStatus(vehicleId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeline(vehicleId) });
      queryClient.invalidateQueries({ queryKey: ['costAnalytics', vehicleId] });
    },
  });
}

/**
 * 刪除週期性規費紀錄 Mutation
 */
export function useDeleteRecurringExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: number; vehicleId: number }) =>
      recurringExpenseService.deleteRecurringExpense(id),
    onSuccess: (_, { vehicleId }) => {
      queryClient.invalidateQueries({ queryKey: ['recurringExpenses', vehicleId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.recurringStatus(vehicleId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeline(vehicleId) });
      queryClient.invalidateQueries({ queryKey: ['costAnalytics', vehicleId] });
    },
  });
}

export const useDeleteRecurringExpenseMutation = useDeleteRecurringExpense;
export const useAddRecurringExpense = useCreateRecurringExpenseMutation;
