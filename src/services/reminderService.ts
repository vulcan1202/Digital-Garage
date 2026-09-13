import { supabase, requireUser } from '../lib/supabase';
import { localStore } from '../lib/localStore';
import { ReminderRow, ReminderInsert, ReminderUpdate } from '../types/database';
import { handleServiceCall, AppError } from './errors/AppError';

export const reminderService = {
  /**
   * 獲取指定車輛的所有保養提醒
   */
  async getReminders(vehicleId: number): Promise<ReminderRow[]> {
    return handleServiceCall(async () => {
      await requireUser();

      try {
        const { data, error } = await supabase
          .from('Reminders')
          .select('*')
          .eq('vehicle_id', vehicleId)
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) return data;
      } catch {
        // Fallback
      }

      return await localStore.getReminders(vehicleId);
    });
  },

  /**
   * 新增保養提醒
   * 依 SQL 約束：interval_km 與 interval_months 至少一者必須為正整數 (> 0)
   */
  async addReminder(reminderData: ReminderInsert): Promise<ReminderRow> {
    return handleServiceCall(async () => {
      await requireUser();

      const hasValidKm = typeof reminderData.interval_km === 'number' && reminderData.interval_km > 0;
      const hasValidMonths = typeof reminderData.interval_months === 'number' && reminderData.interval_months > 0;

      if (!hasValidKm && !hasValidMonths) {
        throw AppError.validation('保養週期必須至少指定「公里數」或「月份」其中一項為正整數');
      }

      const now = new Date().toISOString();
      try {
        const { data, error } = await supabase
          .from('Reminders')
          .insert({
            ...reminderData,
            created_at: reminderData.created_at ?? now,
            updated_at: reminderData.updated_at ?? now,
          })
          .select()
          .single();

        if (!error && data) return data;
      } catch {
        // Fallback
      }

      return await localStore.addReminder(reminderData);
    });
  },

  /**
   * 建立與保養工單關聯之保養提醒
   */
  async createMaintenanceReminder(data: {
    vehicleId: number;
    itemName: string;
    intervalKm?: number | null;
    intervalMonths?: number | null;
    baseMileage: number;
    baseDate: string;
    maintenanceRecordId: number;
  }): Promise<ReminderRow> {
    return await this.addReminder({
      vehicle_id: data.vehicleId,
      item_name: data.itemName,
      interval_km: data.intervalKm ?? null,
      interval_months: data.intervalMonths ?? null,
      base_mileage: data.baseMileage,
      base_date: data.baseDate,
      last_maintenance_record_id: data.maintenanceRecordId,
      status: 'active',
    });
  },

  /**
   * 根據保養紀錄變更，同步更新關聯提醒之基準里程與基準日期
   */
  async syncReminderFromMaintenance(
    maintenanceRecordId: number,
    newMileage?: number,
    newDate?: string
  ): Promise<void> {
    return handleServiceCall(async () => {
      await requireUser();

      try {
        const updatePayload: Partial<ReminderUpdate> = {
          updated_at: new Date().toISOString(),
        };
        if (typeof newMileage === 'number' && !isNaN(newMileage)) {
          updatePayload.base_mileage = newMileage;
        }
        if (newDate) {
          updatePayload.base_date = newDate;
        }

        await supabase
          .from('Reminders')
          .update(updatePayload)
          .eq('last_maintenance_record_id', maintenanceRecordId);
      } catch {
        // Fallback
      }

      await localStore.syncReminderFromMaintenance(maintenanceRecordId, newMileage, newDate);
    });
  },

  /**
   * 更新保養提醒
   */
  async updateReminder(id: number, reminderData: ReminderUpdate): Promise<ReminderRow> {
    return handleServiceCall(async () => {
      await requireUser();

      if (
        (reminderData.interval_km !== undefined || reminderData.interval_months !== undefined) &&
        reminderData.interval_km !== undefined &&
        reminderData.interval_months !== undefined
      ) {
        const hasValidKm = typeof reminderData.interval_km === 'number' && reminderData.interval_km > 0;
        const hasValidMonths = typeof reminderData.interval_months === 'number' && reminderData.interval_months > 0;
        if (!hasValidKm && !hasValidMonths) {
          throw AppError.validation('保養週期必須至少指定「公里數」或「月份」其中一項為正整數');
        }
      }

      try {
        const { data, error } = await supabase
          .from('Reminders')
          .update({
            ...reminderData,
            updated_at: reminderData.updated_at ?? new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();

        if (!error && data) return data;
      } catch {
        // Fallback
      }

      return await localStore.updateReminder(id, reminderData);
    });
  },

  /**
   * 完成保養提醒 (更新基準前移)
   * 業務鐵律：完成後，下一個週期以 last_completed_* 作為新基準，而非重新使用 base_*
   */
  async completeReminder(
    id: number,
    completedMileage: number,
    completedDate: string,
    maintenanceRecordId?: number
  ): Promise<ReminderRow> {
    return handleServiceCall(async () => {
      await requireUser();

      const updatePayload: ReminderUpdate = {
        last_completed_mileage: completedMileage,
        last_completed_date: completedDate,
        last_maintenance_record_id: maintenanceRecordId ?? null,
        updated_at: new Date().toISOString(),
      };

      try {
        const { data, error } = await supabase
          .from('Reminders')
          .update(updatePayload)
          .eq('id', id)
          .select()
          .single();

        if (!error && data) return data;
      } catch {
        // Fallback
      }

      return await localStore.updateReminder(id, updatePayload);
    });
  },

  /**
   * 刪除保養提醒
   */
  async deleteReminder(id: number): Promise<void> {
    return handleServiceCall(async () => {
      await requireUser();

      try {
        await supabase
          .from('Reminders')
          .delete()
          .eq('id', id);
      } catch {
        // Fallback
      }

      await localStore.deleteReminder(id);
    });
  },
};
