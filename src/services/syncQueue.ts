import { cacheStorage, CACHE_KEYS } from '../lib/cacheStorage';
import { networkMonitor } from './networkMonitor';
import { AppError } from './errors/AppError';
import { fuelService } from './fuelService';
import { maintenanceService } from './maintenanceService';
import { reminderService } from './reminderService';
import { modificationService } from './modificationService';
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../hooks/queries/queryKeys';

export type SyncMutationType =
  | 'ADD_REFUEL'
  | 'ADD_MAINTENANCE'
  | 'COMPLETE_REMINDER'
  | 'SWITCH_SETTING_SET';

export type SyncMutationStatus = 'PENDING' | 'SYNCING' | 'SUCCESS' | 'FAILED';

export interface SyncQueueItem {
  id: string;
  type: SyncMutationType;
  payload: any;
  vehicleId?: number;
  createdAt: string;
  retryCount: number;
  status: SyncMutationStatus;
  errorMessage?: string;
  errorCode?: string;
}

type SyncQueueListener = () => void;

class SyncQueue {
  private queue: SyncQueueItem[] = [];
  private failedMutations: SyncQueueItem[] = [];
  private isProcessing: boolean = false;
  private isHydrated: boolean = false;
  private listeners: Set<SyncQueueListener> = new Set();
  private queryClientInstance: QueryClient | null = null;

  constructor() {
    // 監聽網路狀態：一旦恢復連線即觸發佇列同步
    networkMonitor.addListener((isOnline) => {
      if (isOnline) {
        this.processQueue();
      }
    });
  }

  /**
   * 設定全域 QueryClient 實例以在同步成功時觸發權威快取無效化
   */
  public setQueryClient(client: QueryClient) {
    this.queryClientInstance = client;
  }

  /**
   * 水合持久化佇列至記憶體
   */
  public async hydrate(): Promise<void> {
    if (this.isHydrated) return;
    const storedQueue = await cacheStorage.getItem<SyncQueueItem[]>(CACHE_KEYS.MUTATION_QUEUE);
    if (Array.isArray(storedQueue)) {
      // 確保重開機時所有先前的 SYNCING 狀態重置為 PENDING
      this.queue = storedQueue.map((item) => ({
        ...item,
        status: item.status === 'SYNCING' ? 'PENDING' : item.status,
      }));
    }

    const storedFailed = await cacheStorage.getItem<SyncQueueItem[]>(CACHE_KEYS.FAILED_MUTATIONS);
    if (Array.isArray(storedFailed)) {
      this.failedMutations = storedFailed;
    }

    this.isHydrated = true;
    this.notifyListeners();

    // 水合完成後若連線中則嘗試消化佇列
    if (networkMonitor.getIsOnline() && this.queue.length > 0) {
      this.processQueue();
    }
  }

  public subscribe(listener: SyncQueueListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.warn('[syncQueue] listener error:', err);
      }
    });
  }

  private async persist(): Promise<void> {
    // 裁切上限為 20 筆，確保符合儲存邊界
    await cacheStorage.setItem(
      CACHE_KEYS.MUTATION_QUEUE,
      cacheStorage.sliceSnapshot(this.queue, 20)
    );
    await cacheStorage.setItem(
      CACHE_KEYS.FAILED_MUTATIONS,
      cacheStorage.sliceSnapshot(this.failedMutations, 20)
    );
  }

  /**
   * 取得進行中/待處理之佇列
   */
  public getQueue(): SyncQueueItem[] {
    return [...this.queue];
  }

  /**
   * 取得永久同步失敗之項目
   */
  public getFailedMutations(): SyncQueueItem[] {
    return [...this.failedMutations];
  }

  /**
   * 捨棄失敗的同步項目
   */
  public async dismissFailedMutation(id: string): Promise<void> {
    this.failedMutations = this.failedMutations.filter((item) => item.id !== id);
    await this.persist();
    this.notifyListeners();
  }

  /**
   * 重試失敗的同步項目 (重設狀態並移回活動佇列)
   */
  public async retryFailedMutation(id: string): Promise<void> {
    const item = this.failedMutations.find((m) => m.id === id);
    if (!item) return;

    this.failedMutations = this.failedMutations.filter((m) => m.id !== id);
    item.status = 'PENDING';
    item.retryCount = 0;
    item.errorMessage = undefined;
    item.errorCode = undefined;

    this.queue.push(item);
    await this.persist();
    this.notifyListeners();

    if (networkMonitor.getIsOnline()) {
      this.processQueue();
    }
  }

  /**
   * 清除所有失敗項目
   */
  public async clearFailedMutations(): Promise<void> {
    this.failedMutations = [];
    await this.persist();
    this.notifyListeners();
  }

  /**
   * 清空所有佇列與失敗項目 (用於登出或測試重置)
   */
  public async clearQueue(): Promise<void> {
    this.queue = [];
    this.failedMutations = [];
    this.isProcessing = false;
    await this.persist();
    this.notifyListeners();
  }

  /**
   * 新增離線寫入請求至佇列
   */
  public async enqueue(
    type: SyncMutationType,
    payload: any,
    vehicleId?: number
  ): Promise<SyncQueueItem> {
    await this.hydrate();

    const newItem: SyncQueueItem = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      payload,
      vehicleId,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      status: 'PENDING',
    };

    this.queue.push(newItem);
    await this.persist();
    this.notifyListeners();

    // 若當前連線中，立即嘗試執行
    if (networkMonitor.getIsOnline()) {
      await this.processQueue();
    }

    return newItem;
  }

  /**
   * FIFO 佇列排空處理程序
   */
  public async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    if (!networkMonitor.getIsOnline()) return;

    await this.hydrate();
    if (this.queue.length === 0) return;

    this.isProcessing = true;
    this.notifyListeners();

    try {
      while (this.queue.length > 0) {
        // 若中途斷線則終止處理
        if (!networkMonitor.getIsOnline()) break;

        const currentItem = this.queue[0];
        currentItem.status = 'SYNCING';
        this.notifyListeners();

        try {
          // 執行對應的權威 API 呼叫
          await this.executeMutation(currentItem);

          // 成功後自佇列移除 (FIFO)
          this.queue.shift();
          await this.persist();
          this.notifyListeners();

          // Invalidate 相關查詢快取以拉取伺服器權威資料
          this.invalidateQueriesFor(currentItem);
        } catch (err: unknown) {
          const appError = AppError.from(err);

          // 分類判斷：暫態錯誤 vs 永久錯誤
          const isTransient =
            appError.code === 'NETWORK_ERROR' ||
            appError.code === 'DATABASE_ERROR' ||
            appError.message.includes('timeout') ||
            appError.message.includes('fetch');

          if (isTransient) {
            currentItem.retryCount += 1;
            if (currentItem.retryCount < 3) {
              // 標回 PENDING 並退避暫停，保留待下次網路就緒
              currentItem.status = 'PENDING';
              await this.persist();
              this.notifyListeners();
              break; // 暫停後續佇列，等待網路重連
            } else {
              // 超過 3 次暫態失敗，隔離移至 failedMutations，避免永遠卡住
              currentItem.status = 'FAILED';
              currentItem.errorMessage = appError.message;
              currentItem.errorCode = appError.code;
              this.queue.shift();
              this.failedMutations.push(currentItem);
              await this.persist();
              this.notifyListeners();
            }
          } else {
            // 4xx / 業務驗證 / 衝突等永久錯誤：立即移出活動佇列避免 HOL 阻塞
            currentItem.status = 'FAILED';
            currentItem.errorMessage = appError.message;
            currentItem.errorCode = appError.code;

            this.queue.shift();
            this.failedMutations.push(currentItem);
            await this.persist();
            this.notifyListeners();
          }
        }
      }
    } finally {
      this.isProcessing = false;
      this.notifyListeners();
    }
  }

  private async executeMutation(item: SyncQueueItem): Promise<any> {
    switch (item.type) {
      case 'ADD_REFUEL':
        return await fuelService.addRefuel(item.payload);

      case 'ADD_MAINTENANCE':
        return await maintenanceService.createRecordWithPhotos(item.payload, []);

      case 'COMPLETE_REMINDER':
        return await reminderService.completeReminder(
          item.payload.id,
          item.payload.completedMileage,
          item.payload.completedDate,
          item.payload.maintenanceRecordId
        );

      case 'SWITCH_SETTING_SET':
        return await modificationService.setCurrentSettingSet(
          item.payload.modificationId,
          item.payload.setId
        );

      default:
        throw new AppError('UNKNOWN', `未知的同步操作類型: ${(item as any).type}`);
    }
  }

  private invalidateQueriesFor(item: SyncQueueItem) {
    if (!this.queryClientInstance) return;
    const client = this.queryClientInstance;
    const vId = item.vehicleId;

    switch (item.type) {
      case 'ADD_REFUEL':
        if (vId) {
          client.invalidateQueries({ queryKey: queryKeys.refuels(vId) });
          client.invalidateQueries({ queryKey: queryKeys.timeline(vId) });
          client.invalidateQueries({ queryKey: ['costAnalytics', vId] });
        }
        client.invalidateQueries({ queryKey: queryKeys.vehicles });
        break;

      case 'ADD_MAINTENANCE':
        if (vId) {
          client.invalidateQueries({ queryKey: queryKeys.maintenance(vId) });
          client.invalidateQueries({ queryKey: queryKeys.reminders(vId) });
          client.invalidateQueries({ queryKey: queryKeys.timeline(vId) });
          client.invalidateQueries({ queryKey: ['costAnalytics', vId] });
        }
        client.invalidateQueries({ queryKey: queryKeys.vehicles });
        break;

      case 'COMPLETE_REMINDER':
        if (vId) {
          client.invalidateQueries({ queryKey: queryKeys.reminders(vId) });
        }
        break;

      case 'SWITCH_SETTING_SET':
        if (item.payload?.modificationId) {
          client.invalidateQueries({
            queryKey: queryKeys.modificationDetail(item.payload.modificationId),
          });
        }
        break;
    }
  }
}

export const syncQueue = new SyncQueue();
