import { onlineManager } from '@tanstack/react-query';

export interface ServerStatusInfo {
  isOnline: boolean;
  region: string; // 靜態常數: 'us-central1 (北美愛荷華)'
  latencyMs: number | null;
  lastUpdated: Date | null;
}

export const SERVER_REGION = 'us-central1 (北美愛荷華)';
export const SERVER_REGION_CODE = 'us-central1';

type NetworkListener = (isOnline: boolean, serverStatus?: ServerStatusInfo) => void;

class NetworkMonitor {
  private isOnline: boolean = true;
  private latencyMs: number | null = null;
  private lastUpdated: Date | null = null;
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
    listener(this.isOnline, this.getServerStatus());
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
   * 取得當前伺服器狀態與延遲資訊
   */
  public getServerStatus(): ServerStatusInfo {
    return {
      isOnline: this.isOnline,
      region: SERVER_REGION,
      latencyMs: this.latencyMs,
      lastUpdated: this.lastUpdated,
    };
  }

  /**
   * 取得最新的往返延遲 (毫秒)
   */
  public getLatencyMs(): number | null {
    return this.latencyMs;
  }

  /**
   * 記錄由真實業務 API 請求所附帶測量出的往返耗時 (Piggyback Strategy)
   */
  public recordLatency(durationMs: number) {
    // 僅在合法正整數範圍內更新
    if (typeof durationMs === 'number' && durationMs >= 0) {
      this.latencyMs = Math.round(durationMs);
      this.lastUpdated = new Date();
      if (!this.isOnline) {
        this.isOnline = true;
        onlineManager.setOnline(true);
      }
      this.notifyListeners();
    }
  }

  /**
   * 設定連線狀態並發佈事件
   */
  public setOnline(status: boolean) {
    const statusChanged = this.isOnline !== status;
    if (statusChanged) {
      this.isOnline = status;
      onlineManager.setOnline(status);
      if (!status) {
        this.latencyMs = null;
      }
      this.lastUpdated = new Date();
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
   * 手動極簡探活 (Zero-Cost Strategy)：
   * 僅在使用者手動觸發連線重試時呼叫。
   * 透過 HEAD /health 執行零傳輸 Body 探活，更新延遲與在線狀態，不消耗雲端運算與頻寬。
   */
  public async checkHealthZeroCost(): Promise<ServerStatusInfo> {
    const startTime = Date.now();
    let timeoutId: any;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 4000);
      if (timeoutId && typeof timeoutId.unref === 'function') {
        timeoutId.unref();
      }

      const res = await fetch(`${this.checkUrl}/health`, {
        method: 'HEAD',
        signal: controller.signal,
      });

      const latency = Date.now() - startTime;
      if (res.status > 0) {
        this.isOnline = true;
        onlineManager.setOnline(true);
        this.recordLatency(latency);
      } else {
        this.setOnline(false);
      }
    } catch {
      this.setOnline(false);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }

    return this.getServerStatus();
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

      // 發送 HEAD /health 請求至後端伺服器 (若失敗則標記離線)
      const res = await fetch(`${this.checkUrl}/health`, {
        method: 'HEAD',
        signal: controller.signal,
      });

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
    const serverStatus = this.getServerStatus();
    this.listeners.forEach((listener) => {
      try {
        listener(this.isOnline, serverStatus);
      } catch (err) {
        console.warn('[networkMonitor] listener execution error:', err);
      }
    });
  }
}

export const networkMonitor = new NetworkMonitor();

