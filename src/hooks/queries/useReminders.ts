import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reminderService } from '../../services/reminderService';
import { ReminderInsert, ReminderRow } from '../../types/database';
import { queryKeys } from './queryKeys';
import { cacheStorage, CACHE_KEYS } from '../../lib/cacheStorage';
import { networkMonitor } from '../../services/networkMonitor';
import { syncQueue } from '../../services/syncQueue';
import { AppError } from '../../services/errors/AppError';

/**
 * 保養提醒清單 Query Hook (支援離線讀取快照)
 */
export function useReminders(vehicleId: number) {
  return useQuery({
    queryKey: queryKeys.reminders(vehicleId),
    queryFn: async () => {
      const cacheKey = `${CACHE_KEYS.REMINDERS_PREFIX}${vehicleId}`;
      try {
        const data = await reminderService.getReminders(vehicleId);
        await cacheStorage.setItem(cacheKey, data);
        return data;
      } catch (err) {
        const cached = await cacheStorage.getItem<ReminderRow[]>(cacheKey);
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
 * 完成保養提醒 Mutation Hook (支援離線前移與排隊同步)
 */
export function useCompleteReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      vehicleId,
      completedMileage,
      completedDate,
      maintenanceRecordId,
    }: {
      id: number;
      vehicleId: number;
      completedMileage: number;
      completedDate: string;
      maintenanceRecordId?: number;
    }) => {
      const handleOfflineComplete = async (): Promise<ReminderRow> => {
        await syncQueue.enqueue(
          'COMPLETE_REMINDER',
          { id, vehicleId, completedMileage, completedDate, maintenanceRecordId },
          vehicleId
        );

        let updatedItem: ReminderRow | null = null;
        // 樂觀前移提醒基準
        queryClient.setQueryData<ReminderRow[]>(queryKeys.reminders(vehicleId), (old = []) =>
          old.map((r) => {
            if (r.id === id) {
              updatedItem = {
                ...r,
                last_completed_mileage: completedMileage,
                last_completed_date: completedDate,
                updated_at: new Date().toISOString(),
              };
              return updatedItem;
            }
            return r;
          })
        );

        return (
          updatedItem || {
            id,
            vehicle_id: vehicleId,
            item_name: '已標記保養提醒',
            interval_km: 5000,
            interval_months: 6,
            base_mileage: null,
            base_date: null,
            last_completed_mileage: completedMileage,
            last_completed_date: completedDate,
            last_maintenance_record_id: maintenanceRecordId ?? null,
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        );
      };

      if (!networkMonitor.getIsOnline()) {
        return await handleOfflineComplete();
      }

      try {
        return await reminderService.completeReminder(
          id,
          completedMileage,
          completedDate,
          maintenanceRecordId
        );
      } catch (err: unknown) {
        const appErr = AppError.from(err);
        if (appErr.code === 'NETWORK_ERROR') {
          return await handleOfflineComplete();
        }
        throw err;
      }
    },
    onSuccess: (updatedReminder) => {
      if (updatedReminder.id > 0) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.reminders(updatedReminder.vehicle_id),
        });
      }
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

