import { reminderService } from '../reminderService';
import { requestApi } from '../apiClient';

jest.mock('../apiClient', () => ({
  requestApi: jest.fn(),
}));

describe('reminderService (Go REST API decoupled)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getReminders 呼叫 GET /vehicles/:vehicleId/reminders', async () => {
    const mockReminders = [
      {
        id: 1,
        vehicle_id: 10,
        item_name: '定期機油保養',
        interval_km: 5000,
        interval_months: 6,
        base_mileage: 10000,
        base_date: '2026-03-01',
        status: 'active',
      },
    ];
    (requestApi as jest.Mock).mockResolvedValue(mockReminders);

    const result = await reminderService.getReminders(10);

    expect(requestApi).toHaveBeenCalledWith('/vehicles/10/reminders');
    expect(result).toEqual(mockReminders);
  });

  it('addReminder 成功驗證並呼叫 POST /vehicles/:vehicleId/reminders', async () => {
    const inputData = {
      vehicle_id: 10,
      item_name: '定期機油保養',
      interval_km: 5000,
      interval_months: 6,
      base_mileage: 10000,
      base_date: '2026-03-01',
      status: 'active' as const,
    };
    const createdData = { id: 2, ...inputData };
    (requestApi as jest.Mock).mockResolvedValue(createdData);

    const result = await reminderService.addReminder(inputData);

    expect(requestApi).toHaveBeenCalledWith('/vehicles/10/reminders', {
      method: 'POST',
      body: JSON.stringify(inputData),
    });
    expect(result).toEqual(createdData);
  });

  it('addReminder 若未提供有效週期應拋出 validation 錯誤', async () => {
    await expect(
      reminderService.addReminder({
        vehicle_id: 10,
        item_name: '無效週期提醒',
        interval_km: 0,
        interval_months: 0,
      })
    ).rejects.toThrow('保養週期必須至少指定「公里數」或「月份」其中一項為正整數');
  });

  it('updateReminder 呼叫 PATCH /reminders/:id', async () => {
    const updateInput = {
      interval_km: 10000,
      item_name: '長效機油保養',
    };
    (requestApi as jest.Mock).mockResolvedValue({ id: 2, ...updateInput });

    const result = await reminderService.updateReminder(2, updateInput);

    expect(requestApi).toHaveBeenCalledWith('/reminders/2', {
      method: 'PATCH',
      body: JSON.stringify(updateInput),
    });
    expect(result.interval_km).toBe(10000);
  });

  it('completeReminder 呼叫 POST /reminders/:id/complete (基準前移)', async () => {
    const completedResult = {
      id: 2,
      vehicle_id: 10,
      last_completed_mileage: 15000,
      last_completed_date: '2026-09-14',
      last_maintenance_record_id: 99,
    };
    (requestApi as jest.Mock).mockResolvedValue(completedResult);

    const result = await reminderService.completeReminder(2, 15000, '2026-09-14', 99);

    expect(requestApi).toHaveBeenCalledWith('/reminders/2/complete', {
      method: 'POST',
      body: JSON.stringify({
        completed_mileage: 15000,
        completed_date: '2026-09-14',
        maintenance_record_id: 99,
      }),
    });
    expect(result).toEqual(completedResult);
  });

  it('deleteReminder 呼叫 DELETE /reminders/:id', async () => {
    (requestApi as jest.Mock).mockResolvedValue(undefined);

    await reminderService.deleteReminder(2);

    expect(requestApi).toHaveBeenCalledWith('/reminders/2', {
      method: 'DELETE',
    });
  });

  it('syncReminderBaseFromMaintenance 呼叫 POST /reminders/sync-base', async () => {
    (requestApi as jest.Mock).mockResolvedValue(undefined);

    await reminderService.syncReminderBaseFromMaintenance(99, 15500, '2026-09-15');

    expect(requestApi).toHaveBeenCalledWith('/reminders/sync-base', {
      method: 'POST',
      body: JSON.stringify({
        maintenance_record_id: 99,
        mileage: 15500,
        date: '2026-09-15',
      }),
    });
  });
});
