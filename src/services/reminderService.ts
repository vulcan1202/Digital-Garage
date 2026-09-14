import { requestApi } from './apiClient';
import { ReminderRow, ReminderInsert, ReminderUpdate } from '../types/database';
import { handleServiceCall, AppError } from './errors/AppError';

export const reminderService = {
  /**
   * 獲取指定車輛的所有保養提醒
   */
  async getReminders(vehicleId: number): Promise<ReminderRow[]> {
    return handleServiceCall(async () => {
      return await requestApi<ReminderRow[]>(`/vehicles/${vehicleId}/reminders`);
    });
  },

  /**
   * 新增保養提醒
   * 依 SQL 約束：interval_km 與 interval_months 至少一者必須為正整數 (> 0)
   */
  async addReminder(reminderData: ReminderInsert): Promise<ReminderRow> {
    return handleServiceCall(async () => {
      const hasValidKm = typeof reminderData.interval_km === 'number' && reminderData.interval_km > 0;
      const hasValidMonths = typeof reminderData.interval_months === 'number' && reminderData.interval_months > 0;

      if (!hasValidKm && !hasValidMonths) {
        throw AppError.validation('保養週期必須至少指定「公里數」或「月份」其中一項為正整數');
      }

      return await requestApi<ReminderRow>(`/vehicles/${reminderData.vehicle_id}/reminders`, {
        method: 'POST',
        body: JSON.stringify(reminderData),
      });
    });
  },

  /**
   * 更新保養提醒
   */
  async updateReminder(id: number, reminderData: ReminderUpdate): Promise<ReminderRow> {
    return handleServiceCall(async () => {
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

      return await requestApi<ReminderRow>(`/reminders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(reminderData),
      });
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
      return await requestApi<ReminderRow>(`/reminders/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          completed_mileage: completedMileage,
          completed_date: completedDate,
          maintenance_record_id: maintenanceRecordId ?? null,
        }),
      });
    });
  },

  /**
   * 刪除保養提醒
   */
  async deleteReminder(id: number): Promise<void> {
    return handleServiceCall(async () => {
      await requestApi<void>(`/reminders/${id}`, {
        method: 'DELETE',
      });
    });
  },

  /**
   * 建立與保養紀錄關聯之保養提醒
   */
  async createMaintenanceReminder({
    vehicleId,
    itemName,
    baseMileage,
    baseDate,
    intervalKm,
    intervalMonths,
    maintenanceRecordId,
  }: {
    vehicleId: number;
    itemName: string;
    baseMileage: number;
    baseDate: string;
    intervalKm?: number | null;
    intervalMonths?: number | null;
    maintenanceRecordId?: number;
  }): Promise<ReminderRow> {
    return this.addReminder({
      vehicle_id: vehicleId,
      item_name: itemName,
      base_mileage: baseMileage,
      base_date: baseDate,
      interval_km: intervalKm && intervalKm > 0 ? intervalKm : null,
      interval_months: intervalMonths && intervalMonths > 0 ? intervalMonths : null,
      last_maintenance_record_id: maintenanceRecordId ?? null,
      status: 'active',
    });
  },

  /**
   * 當保養紀錄被編輯修改里程或日期時，同步更新關聯提醒之基準 (base_mileage / base_date)
   */
  async syncReminderBaseFromMaintenance(
    maintenanceRecordId: number,
    mileage?: number,
    date?: string
  ): Promise<void> {
    return handleServiceCall(async () => {
      await requestApi<void>('/reminders/sync-base', {
        method: 'POST',
        body: JSON.stringify({
          maintenance_record_id: maintenanceRecordId,
          mileage: mileage ?? null,
          date: date ?? null,
        }),
      });
    });
  },
};

