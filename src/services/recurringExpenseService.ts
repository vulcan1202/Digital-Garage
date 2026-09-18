import { requestApi } from './apiClient';
import { RecurringExpenseRow, RecurringExpenseInsert, RecurringExpenseUpdate } from '../types/database';
import { RecurringStatusSummary } from '../types/recurringExpense';
import { handleServiceCall, AppError } from './errors/AppError';

export const recurringExpenseService = {
  /**
   * 取得指定車輛之週期性規費紀錄列表（可依 category 篩選）
   */
  async getRecurringExpenses(vehicleId: number, category?: string): Promise<RecurringExpenseRow[]> {
    return handleServiceCall(async () => {
      const url = category
        ? `/vehicles/${vehicleId}/recurring-expenses?category=${encodeURIComponent(category)}`
        : `/vehicles/${vehicleId}/recurring-expenses`;
      return await requestApi<RecurringExpenseRow[]>(url);
    });
  },

  /**
   * 取得指定車輛當前所有週期類別（牌照稅、公路養管費、定期檢驗、保險等）之最新到期與警報狀態
   */
  async getRecurringStatus(vehicleId: number): Promise<RecurringStatusSummary[]> {
    return handleServiceCall(async () => {
      return await requestApi<RecurringStatusSummary[]>(`/vehicles/${vehicleId}/recurring-expenses/status`);
    });
  },

  /**
   * 取得單筆規費紀錄
   */
  async getRecurringExpenseById(id: number): Promise<RecurringExpenseRow> {
    return handleServiceCall(async () => {
      return await requestApi<RecurringExpenseRow>(`/recurring-expenses/${id}`);
    });
  },

  /**
   * 新增規費紀錄（支援於同一交易內同步將檢驗基準日儲存為車輛出廠日）
   */
  async createRecurringExpense(vehicleId: number, data: RecurringExpenseInsert): Promise<RecurringExpenseRow> {
    return handleServiceCall(async () => {
      if (!data.title || data.title.trim() === '') {
        throw AppError.validation('標題不可為空');
      }
      if (typeof data.amount !== 'number' || data.amount < 0) {
        throw AppError.validation('金額不可為負數');
      }
      if (!data.paid_date || !data.coverage_start_date || !data.coverage_end_date) {
        throw AppError.validation('付款日期與生效涵蓋起訖日為必填');
      }
      if (data.coverage_end_date < data.coverage_start_date) {
        throw AppError.validation('到期截止日不得早於生效起始日');
      }

      return await requestApi<RecurringExpenseRow>(`/vehicles/${vehicleId}/recurring-expenses`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });
  },

  /**
   * 更新規費紀錄
   */
  async updateRecurringExpense(id: number, data: RecurringExpenseUpdate): Promise<RecurringExpenseRow> {
    return handleServiceCall(async () => {
      if (data.amount !== undefined && data.amount < 0) {
        throw AppError.validation('金額不可為負數');
      }
      if (
        data.coverage_start_date &&
        data.coverage_end_date &&
        data.coverage_end_date < data.coverage_start_date
      ) {
        throw AppError.validation('到期截止日不得早於生效起始日');
      }

      return await requestApi<RecurringExpenseRow>(`/recurring-expenses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    });
  },

  /**
   * 刪除規費紀錄
   */
  async deleteRecurringExpense(id: number): Promise<void> {
    return handleServiceCall(async () => {
      await requestApi(`/recurring-expenses/${id}`, {
        method: 'DELETE',
      });
    });
  },
};
