import { recurringExpenseService } from '../recurringExpenseService';
import { requestApi } from '../apiClient';

jest.mock('../apiClient', () => ({
  requestApi: jest.fn(),
}));

describe('recurringExpenseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRecurringExpenses', () => {
    it('呼叫 GET /vehicles/:id/recurring-expenses', async () => {
      const mockData = [{ id: 1, title: '牌照稅', amount: 7120 }];
      (requestApi as jest.Mock).mockResolvedValue(mockData);

      const result = await recurringExpenseService.getRecurringExpenses(10);

      expect(requestApi).toHaveBeenCalledWith('/vehicles/10/recurring-expenses');
      expect(result).toEqual(mockData);
    });

    it('支援 category query 篩選', async () => {
      (requestApi as jest.Mock).mockResolvedValue([]);

      await recurringExpenseService.getRecurringExpenses(10, 'insurance');

      expect(requestApi).toHaveBeenCalledWith('/vehicles/10/recurring-expenses?category=insurance');
    });
  });

  describe('getRecurringStatus', () => {
    it('呼叫 GET /vehicles/:id/recurring-expenses/status', async () => {
      const mockStatus = [{ category: 'license_tax', status: 'good' }];
      (requestApi as jest.Mock).mockResolvedValue(mockStatus);

      const result = await recurringExpenseService.getRecurringStatus(10);

      expect(requestApi).toHaveBeenCalledWith('/vehicles/10/recurring-expenses/status');
      expect(result).toEqual(mockStatus);
    });
  });

  describe('getRecurringExpenseById', () => {
    it('呼叫 GET /recurring-expenses/:id 取得單筆紀錄', async () => {
      const mockRecord = {
        id: 42,
        vehicle_id: 10,
        category: 'license_tax',
        title: '2026 牌照稅',
        amount: 7120,
        paid_date: '2026-04-15',
        coverage_start_date: '2026-01-01',
        coverage_end_date: '2026-12-31',
      };
      (requestApi as jest.Mock).mockResolvedValue(mockRecord);

      const result = await recurringExpenseService.getRecurringExpenseById(42);

      expect(requestApi).toHaveBeenCalledWith('/recurring-expenses/42');
      expect(result).toEqual(mockRecord);
    });
  });

  describe('createRecurringExpense', () => {
    it('成功驗證並呼叫 POST /vehicles/:vehicleId/recurring-expenses', async () => {
      const payload = {
        vehicle_id: 10,
        category: 'compulsory_insurance' as const,
        title: '強制險',
        amount: 1200,
        paid_date: '2026-03-01',
        coverage_start_date: '2026-03-01',
        coverage_end_date: '2027-02-28',
      };
      (requestApi as jest.Mock).mockResolvedValue({ id: 100, ...payload });

      const result = await recurringExpenseService.createRecurringExpense(10, payload);

      expect(requestApi).toHaveBeenCalledWith('/vehicles/10/recurring-expenses', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      expect(result.id).toBe(100);
    });

    it('防呆：標題為空時應拋出 validation 錯誤', async () => {
      await expect(
        recurringExpenseService.createRecurringExpense(10, {
          vehicle_id: 10,
          category: 'other',
          title: '   ',
          amount: 500,
          paid_date: '2026-01-01',
          coverage_start_date: '2026-01-01',
          coverage_end_date: '2026-12-31',
        })
      ).rejects.toThrow('標題不可為空');
    });

    it('防呆：金額為負數時應拋出 validation 錯誤', async () => {
      await expect(
        recurringExpenseService.createRecurringExpense(10, {
          vehicle_id: 10,
          category: 'other',
          title: '過路費',
          amount: -100,
          paid_date: '2026-01-01',
          coverage_start_date: '2026-01-01',
          coverage_end_date: '2026-12-31',
        })
      ).rejects.toThrow('金額不可為負數');
    });

    it('防呆：到期截止日早於起始日應拋出 validation 錯誤', async () => {
      await expect(
        recurringExpenseService.createRecurringExpense(10, {
          vehicle_id: 10,
          category: 'other',
          title: '第三人責任險',
          amount: 3000,
          paid_date: '2026-01-01',
          coverage_start_date: '2026-12-31',
          coverage_end_date: '2026-01-01',
        })
      ).rejects.toThrow('到期截止日不得早於生效起始日');
    });
  });

  describe('updateRecurringExpense', () => {
    it('成功呼叫 PATCH /recurring-expenses/:id 更新紀錄', async () => {
      const updateData = {
        title: '更新後的保險',
        amount: 1500,
      };
      (requestApi as jest.Mock).mockResolvedValue({ id: 5, ...updateData });

      const result = await recurringExpenseService.updateRecurringExpense(5, updateData);

      expect(requestApi).toHaveBeenCalledWith('/recurring-expenses/5', {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });
      expect(result.id).toBe(5);
    });

    it('防呆：金額為負數時拋出錯誤', async () => {
      await expect(
        recurringExpenseService.updateRecurringExpense(5, { amount: -50 })
      ).rejects.toThrow('金額不可為負數');
    });

    it('防呆：日期邏輯錯誤時拋出錯誤', async () => {
      await expect(
        recurringExpenseService.updateRecurringExpense(5, {
          coverage_start_date: '2026-12-31',
          coverage_end_date: '2026-01-01',
        })
      ).rejects.toThrow('到期截止日不得早於生效起始日');
    });
  });

  describe('deleteRecurringExpense', () => {
    it('呼叫 DELETE /recurring-expenses/:id 刪除紀錄', async () => {
      (requestApi as jest.Mock).mockResolvedValue({ success: true });

      await recurringExpenseService.deleteRecurringExpense(88);

      expect(requestApi).toHaveBeenCalledWith('/recurring-expenses/88', {
        method: 'DELETE',
      });
    });
  });
});
