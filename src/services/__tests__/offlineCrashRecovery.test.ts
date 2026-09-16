jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(null),
}));

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
      _setRaw: (key: string, val: any) => store.set(key, val),
      _clear: () => store.clear(),
    },
  };
});

jest.mock('../networkMonitor', () => {
  let online = false;
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

describe('Offline Crash Recovery & Hydration QA', () => {
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

  it('閃退/強制終止復原：若存在狀態為 SYNCING 的未竟任務，水合時必須自動重置為 PENDING 避免永久死結', async () => {
    // 模擬先前進程在發送網路請求時被系統殺死 (殘留 SYNCING 狀態於 SecureStore)
    const zombieItem: SyncQueueItem = {
      id: 'sync_zombie_crash_1',
      type: 'ADD_REFUEL',
      payload: { vehicle_id: 1, mileage: 12000, volume: 40, total_cost: 1200 },
      vehicleId: 1,
      createdAt: '2026-09-16T12:00:00.000Z',
      retryCount: 1,
      status: 'SYNCING', // 殘留死結狀態
    };

    (cacheStorage as any)._setRaw(CACHE_KEYS.MUTATION_QUEUE, [zombieItem]);

    // 重新水合
    (syncQueue as any).isHydrated = false;
    await syncQueue.hydrate();

    const queue = syncQueue.getQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].id).toBe('sync_zombie_crash_1');
    expect(queue[0].status).toBe('PENDING'); // 成功救援修復為 PENDING
  });

  it('連線恢復自動消化：水合完成時若網路連線中，應自動觸發 processQueue 消化待辦項目', async () => {
    const pendingItem: SyncQueueItem = {
      id: 'sync_auto_reconnect_1',
      type: 'ADD_REFUEL',
      payload: { vehicle_id: 1, mileage: 13000, volume: 45, total_cost: 1350 },
      vehicleId: 1,
      createdAt: '2026-09-16T12:00:00.000Z',
      retryCount: 0,
      status: 'PENDING',
    };

    (cacheStorage as any)._setRaw(CACHE_KEYS.MUTATION_QUEUE, [pendingItem]);
    (fuelService.addRefuel as jest.Mock).mockResolvedValue({ id: 888, vehicle_id: 1 });
    (networkMonitor.getIsOnline as jest.Mock).mockReturnValue(true);

    (syncQueue as any).isHydrated = false;
    await syncQueue.hydrate();

    // 等待 hydrate 觸發之非同步背景 processQueue 完成
    await new Promise((r) => setTimeout(r, 20));

    // 驗證是否自動執行 API 與清除佇列
    expect(fuelService.addRefuel).toHaveBeenCalledWith(pendingItem.payload);
    expect(syncQueue.getQueue().length).toBe(0);
    expect(mockQueryClient.invalidateQueries).toHaveBeenCalled();
  });

  it('損毀與空資料容錯：當本地快取為 null 或非陣列時，水合不得拋出例外且能正常運作', async () => {
    (cacheStorage as any)._setRaw(CACHE_KEYS.MUTATION_QUEUE, null);
    (cacheStorage as any)._setRaw(CACHE_KEYS.FAILED_MUTATIONS, null);

    (syncQueue as any).isHydrated = false;
    await expect(syncQueue.hydrate()).resolves.not.toThrow();

    expect(syncQueue.getQueue()).toEqual([]);
    expect(syncQueue.getFailedMutations()).toEqual([]);
  });

  it('4xx 隔離防禦：當崩潰復原後的資料包含無效 Payload，應立即移至 failedMutations 不阻礙後續健康項目', async () => {
    const invalidItem: SyncQueueItem = {
      id: 'sync_bad_item',
      type: 'ADD_REFUEL',
      payload: { vehicle_id: 1, mileage: -50 },
      vehicleId: 1,
      createdAt: '2026-09-16T12:00:00.000Z',
      retryCount: 0,
      status: 'PENDING',
    };
    const validItem: SyncQueueItem = {
      id: 'sync_good_item',
      type: 'ADD_REFUEL',
      payload: { vehicle_id: 1, mileage: 15000, volume: 30, total_cost: 900 },
      vehicleId: 1,
      createdAt: '2026-09-16T12:01:00.000Z',
      retryCount: 0,
      status: 'PENDING',
    };

    (cacheStorage as any)._setRaw(CACHE_KEYS.MUTATION_QUEUE, [invalidItem, validItem]);
    (fuelService.addRefuel as jest.Mock)
      .mockRejectedValueOnce(new AppError('VALIDATION_ERROR', '里程不可為負數'))
      .mockResolvedValueOnce({ id: 999, vehicle_id: 1 });

    (networkMonitor.getIsOnline as jest.Mock).mockReturnValue(true);

    (syncQueue as any).isHydrated = false;
    await syncQueue.hydrate();

    // 等待背景消化完成
    await new Promise((r) => setTimeout(r, 20));

    expect(syncQueue.getQueue().length).toBe(0);
    expect(syncQueue.getFailedMutations().length).toBe(1);
    expect(syncQueue.getFailedMutations()[0].id).toBe('sync_bad_item');
    expect(syncQueue.getFailedMutations()[0].errorMessage).toBe('里程不可為負數');
    expect(fuelService.addRefuel).toHaveBeenCalledTimes(2);
  });
});
