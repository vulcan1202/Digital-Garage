import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reminderService } from '../../services/reminderService';
import { ReminderInsert } from '../../types/database';
import { queryKeys } from './queryKeys';

/**
 * 保養提醒清單 Query Hook
 */
export function useReminders(vehicleId: number) {
  return useQuery({
    queryKey: queryKeys.reminders(vehicleId),
    queryFn: () => reminderService.getReminders(vehicleId),
    enabled: typeof vehicleId === 'number' && vehicleId > 0,
  });
}

/**
 * 新增保養提醒 Mutation Hook
 */
export function useAddReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ReminderInsert) => reminderService.addReminder(data),
    onSuccess: (newReminder) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.reminders(newReminder.vehicle_id),
      });
    },
  });
}

/**
 * 完成保養提醒 Mutation Hook (基準前移)
 */
export function useCompleteReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      completedMileage,
      completedDate,
      maintenanceRecordId,
    }: {
      id: number;
      vehicleId: number;
      completedMileage: number;
      completedDate: string;
      maintenanceRecordId?: number;
    }) =>
      reminderService.completeReminder(id, completedMileage, completedDate, maintenanceRecordId),
    onSuccess: (updatedReminder) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.reminders(updatedReminder.vehicle_id),
      });
    },
  });
}

/**
 * 刪除保養提醒 Mutation Hook
 */
export function useDeleteReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, vehicleId }: { id: number; vehicleId: number }) =>
      reminderService.deleteReminder(id),
    onSuccess: (_, { vehicleId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.reminders(vehicleId),
      });
    },
  });
}

