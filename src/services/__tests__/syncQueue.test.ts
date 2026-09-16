import { syncQueue, SyncQueueItem } from '../syncQueue';
import { cacheStorage, CACHE_KEYS } from '../../lib/cacheStorage';
import { networkMonitor } from '../networkMonitor';
import { fuelService } from '../fuelService';
import { maintenanceService } from '../maintenanceService';
import { reminderService } from '../reminderService';
import { modificationService } from '../modificationService';
import { AppError } from '../errors/AppError';

jest.mock('../../lib/cacheStorage', () => {
  const store = new Map<string, any>();
  return {
    CACHE_KEYS: {
      MUTATION_QUEUE: 'DG_MUTATION_QUEUE',
      FAILED_MUTATIONS: 'DG_FAILED_MUTATIONS',
    },
    cacheStorage: {
      getItem: jest.fn(async (key: string) => store.get(key) || null),
      setItem: jest.fn(async (key: string, val: any) => {
        store.set(key, val);
        return true;
      }),
      removeItem: jest.fn(async (key: string) => {
        store.delete(key);
        return true;
      }),
      sliceSnapshot: jest.fn((items: any[], max: number) => items.slice(0, max)),
      _clear: () => store.clear(),
    },
  };
});

jest.mock('../networkMonitor', () => {
  let online = true;
  const listeners: any[] = [];
  return {
    networkMonitor: {
      getIsOnline: jest.fn(() => online),
      setOnline: jest.fn((val: boolean) => {
        online = val;
        listeners.forEach((l) => l(val));
      }),
      addListener: jest.fn((l: any) => {
        listeners.push(l);
        return () => {};
      }),
    },
  };
});

jest.mock('../fuelService', () => ({
  fuelService: {
    addRefuel: jest.fn(),
  },
}));

jest.mock('../maintenanceService', () => ({
  maintenanceService: {
    createRecordWithPhotos: jest.fn(),
  },
}));

jest.mock('../reminderService', () => ({
  reminderService: {
    completeReminder: jest.fn(),
  },
}));

jest.mock('../modificationService', () => ({
  modificationService: {
    setCurrentSettingSet: jest.fn(),
  },
}));

describe('syncQueue service', () => {
  const mockQueryClient: any = {
    invalidateQueries: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (cacheStorage as any)._clear();
    syncQueue.setQueryClient(mockQueryClient);
    (networkMonitor.getIsOnline as jest.Mock).mockReturnValue(false);
    await syncQueue.clearQueue();
  });

  it('enqueue 新增項目至佇列並設定為 PENDING 狀態', async () => {
    (networkMonitor.getIsOnline as jest.Mock).mockReturnValue(false);

    const item = await syncQueue.enqueue(
      'ADD_REFUEL',
      {
        vehicle_id: 1,
        refuel_date: '2026-09-16',
        mileage: 12500,
        fuel_amount: 40,
        total_amount: 1200,
      },
      1
    );

    expect(item.id).toMatch(/^sync_/);
    expect(item.status).toBe('PENDING');
    expect(item.type).toBe('ADD_REFUEL');
    expect(syncQueue.getQueue().length).toBe(1);
    expect(cacheStorage.setItem).toHaveBeenCalledWith(
      CACHE_KEYS.MUTATION_QUEUE,
      expect.any(Array)
    );
  });

  it('processQueue 當成功同步時應依序消化佇列並呼叫 invalidateQueries', async () => {
    (networkMonitor.getIsOnline as jest.Mock).mockReturnValue(false);
    (fuelService.addRefuel as jest.Mock).mockResolvedValue({ id: 99, vehicle_id: 1 });

    await syncQueue.enqueue(
      'ADD_REFUEL',
      {
        vehicle_id: 1,
        refuel_date: '2026-09-16',
        mileage: 12500,
        fuel_amount: 40,
        total_amount: 1200,
      },
      1
    );

    // 恢復網路連線並消化佇列
    (networkMonitor.getIsOnline as jest.Mock).mockReturnValue(true);
    await syncQueue.processQueue();

    expect(fuelService.addRefuel).toHaveBeenCalled();
    expect(syncQueue.getQueue().length).toBe(0);
    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: expect.arrayContaining(['refuels', 1]) })
    );
  });

  it('processQueue 遇暫態網路錯誤時應增加重試計數並保留在活動佇列中', async () => {
    (networkMonitor.getIsOnline as jest.Mock).mockReturnValue(false);
    (fuelService.addRefuel as jest.Mock).mockRejectedValue(
      new AppError('NETWORK_ERROR', '網路逾時')
    );

    await syncQueue.enqueue(
      'ADD_REFUEL',
      { vehicle_id: 1, mileage: 12500, fuel_amount: 40, total_amount: 1200 },
      1
    );

    (networkMonitor.getIsOnline as jest.Mock).mockReturnValue(true);
    await syncQueue.processQueue();

    const queue = syncQueue.getQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].retryCount).toBe(1);
    expect(queue[0].status).toBe('PENDING');
    expect(syncQueue.getFailedMutations().length).toBe(0);
  });

  it('processQueue 遇 4xx 永久業務驗證錯誤時應立即隔離至 failedMutations 避免阻塞後續操作 (No Head-of-Line Blocking)', async () => {
    (networkMonitor.getIsOnline as jest.Mock).mockReturnValue(false);

    // 第 1 筆拋出 400 驗證錯誤 (例如里程小於購車里程)
    (fuelService.addRefuel as jest.Mock).mockRejectedValueOnce(
      new AppError('VALIDATION_ERROR', '加油里程不可小於車輛初始里程')
    );
    // 第 2 筆正常成功
    (maintenanceService.createRecordWithPhotos as jest.Mock).mockResolvedValueOnce({
      id: 88,
      vehicle_id: 1,
    });

    await syncQueue.enqueue(
      'ADD_REFUEL',
      { vehicle_id: 1, mileage: 50, fuel_amount: 40, total_amount: 1200 },
      1
    );
    await syncQueue.enqueue(
      'ADD_MAINTENANCE',
      { vehicle_id: 1, title: '換機油', total_cost: 2500, record_date: '2026-09-16' },
      1
    );

    (networkMonitor.getIsOnline as jest.Mock).mockReturnValue(true);
    await syncQueue.processQueue();

    // 活動佇列應已排空 (第 1 筆被隔離移出，第 2 筆成功執行)
    expect(syncQueue.getQueue().length).toBe(0);

    // 第 1 筆應移入 failedMutations，並保有明確錯誤資訊
    const failedList = syncQueue.getFailedMutations();
    expect(failedList.length).toBe(1);
    expect(failedList[0].type).toBe('ADD_REFUEL');
    expect(failedList[0].status).toBe('FAILED');
    expect(failedList[0].errorMessage).toBe('加油里程不可小於車輛初始里程');

    // 第 2 筆工單有正常執行
    expect(maintenanceService.createRecordWithPhotos).toHaveBeenCalled();
  });

  it('retryFailedMutation 應將失敗項目重設為 PENDING 並移回活動佇列', async () => {
    (networkMonitor.getIsOnline as jest.Mock).mockReturnValue(false);

    // 模擬一筆失敗項目
    (fuelService.addRefuel as jest.Mock).mockRejectedValueOnce(
      new AppError('NOT_FOUND', '車輛不存在')
    );

    await syncQueue.enqueue('ADD_REFUEL', { vehicle_id: 999 }, 999);
    (networkMonitor.getIsOnline as jest.Mock).mockReturnValue(true);
    await syncQueue.processQueue();

    expect(syncQueue.getFailedMutations().length).toBe(1);
    const failedItem = syncQueue.getFailedMutations()[0];

    // 車主點擊重試 (離線環境下移回佇列待命)
    (networkMonitor.getIsOnline as jest.Mock).mockReturnValue(false);
    await syncQueue.retryFailedMutation(failedItem.id);

    expect(syncQueue.getFailedMutations().length).toBe(0);
    const queue = syncQueue.getQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].id).toBe(failedItem.id);
    expect(queue[0].status).toBe('PENDING');
    expect(queue[0].retryCount).toBe(0);
  });

  it('dismissFailedMutation 應自失敗記錄中移除項目', async () => {
    (networkMonitor.getIsOnline as jest.Mock).mockReturnValue(false);
    (fuelService.addRefuel as jest.Mock).mockRejectedValueOnce(
      new AppError('PERMISSION_DENIED', '權限不足')
    );

    await syncQueue.enqueue('ADD_REFUEL', { vehicle_id: 1 }, 1);
    (networkMonitor.getIsOnline as jest.Mock).mockReturnValue(true);
    await syncQueue.processQueue();

    expect(syncQueue.getFailedMutations().length).toBe(1);
    const failedItem = syncQueue.getFailedMutations()[0];
    await syncQueue.dismissFailedMutation(failedItem.id);

    expect(syncQueue.getFailedMutations().length).toBe(0);
  });
});
