import { onlineManager } from '@tanstack/react-query';

type NetworkListener = (isOnline: boolean) => void;

class NetworkMonitor {
  private isOnline: boolean = true;
  private listeners: Set<NetworkListener> = new Set();
  private isChecking: boolean = false;
  private checkUrl: string;

  constructor() {
    this.checkUrl =
      process.env.EXPO_PUBLIC_API_URL ||
      'https://digital-garage-api-997244262524.us-central1.run.app/api/v1';

    // 初始化 TanStack Query 內部狀態
    onlineManager.setOnline(this.isOnline);
  }

  /**
   * App 生命週期切換時呼叫 (如切換回前景)
   */
  public handleAppStateChange = (nextState: string) => {
    if (nextState === 'active') {
      this.checkConnectivity();
    }
  };

  /**
   * 註冊連線狀態監聽器
   */
  public addListener(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    // 立即通知當前狀態
    listener(this.isOnline);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 取得當前是否連線
   */
  public getIsOnline(): boolean {
    return this.isOnline;
  }

  /**
   * 設定連線狀態並發佈事件
   */
  public setOnline(status: boolean) {
    if (this.isOnline !== status) {
      this.isOnline = status;
      onlineManager.setOnline(status);
      this.notifyListeners();
    }
  }

  /**
   * apiClient 遇網路異常時呼叫
   */
  public notifyOffline() {
    if (this.isOnline) {
      this.setOnline(false);
    }
  }

  /**
   * apiClient 或測試請求成功時呼叫
   */
  public notifyOnline() {
    if (!this.isOnline) {
      this.setOnline(true);
    }
  }

  /**
   * 輕量連線檢查 (帶 3.5s 超時保護，避免掛起)
   */
  public async checkConnectivity(): Promise<boolean> {
    if (this.isChecking) return this.isOnline;
    this.isChecking = true;

    let timeoutId: any;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 3500);
      if (timeoutId && typeof timeoutId.unref === 'function') {
        timeoutId.unref();
      }

      // 發送 HEAD 或 GET 請求至後端伺服器 (若失敗則標記離線)
      const res = await fetch(`${this.checkUrl}/vehicles`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      // 只要伺服器有回應 (無論 200, 401, 403 均代表網路通暢)
      const reachable = res.status > 0;
      this.setOnline(reachable);
      return reachable;
    } catch {
      this.setOnline(false);
      return false;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      this.isChecking = false;
    }
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.isOnline);
      } catch (err) {
        console.warn('[networkMonitor] listener execution error:', err);
      }
    });
  }
}

export const networkMonitor = new NetworkMonitor();
