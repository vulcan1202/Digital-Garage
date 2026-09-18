import { networkMonitor } from '../networkMonitor';

describe('networkMonitor service', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    networkMonitor.setOnline(true);
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('初始狀態應預設為連線狀態 (isOnline = true)', () => {
    expect(networkMonitor.getIsOnline()).toBe(true);
  });

  it('notifyOffline 與 notifyOnline 應正確切換連線狀態並通知監聽器', () => {
    const listener = jest.fn();
    const unsub = networkMonitor.addListener(listener);

    // 註冊時應立即收到當前狀態 (true, serverStatus)
    expect(listener).toHaveBeenCalledWith(true, expect.objectContaining({ isOnline: true }));

    // 通知離線
    networkMonitor.notifyOffline();
    expect(networkMonitor.getIsOnline()).toBe(false);
    expect(listener).toHaveBeenCalledWith(false, expect.objectContaining({ isOnline: false }));

    // 再次通知離線 (重複狀態不應重複通知)
    listener.mockClear();
    networkMonitor.notifyOffline();
    expect(listener).not.toHaveBeenCalled();

    // 通知上線
    networkMonitor.notifyOnline();
    expect(networkMonitor.getIsOnline()).toBe(true);
    expect(listener).toHaveBeenCalledWith(true, expect.objectContaining({ isOnline: true }));

    unsub();
  });

  it('退訂監聽器後不應再收到狀態異動', () => {
    const listener = jest.fn();
    const unsub = networkMonitor.addListener(listener);
    listener.mockClear();

    unsub();
    networkMonitor.notifyOffline();
    expect(listener).not.toHaveBeenCalled();
  });

  it('recordLatency 應正確更新延遲數值、時間戳與在線狀態', () => {
    networkMonitor.setOnline(false);
    expect(networkMonitor.getLatencyMs()).toBeNull();

    networkMonitor.recordLatency(168);
    expect(networkMonitor.getIsOnline()).toBe(true);
    expect(networkMonitor.getLatencyMs()).toBe(168);

    const status = networkMonitor.getServerStatus();
    expect(status.latencyMs).toBe(168);
    expect(status.region).toContain('us-central1');
    expect(status.lastUpdated).toBeInstanceOf(Date);
  });

  it('checkHealthZeroCost 應透過 HEAD 方法發送零 Body 探活並更新延遲', async () => {
    (globalThis as any).fetch = jest.fn().mockResolvedValue({
      status: 204,
      ok: true,
    });

    const status = await networkMonitor.checkHealthZeroCost();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/health'),
      expect.objectContaining({ method: 'HEAD' })
    );
    expect(status.isOnline).toBe(true);
    expect(typeof status.latencyMs).toBe('number');
  });

  it('checkConnectivity 當 fetch 成功時應確認為連線狀態', async () => {
    (globalThis as any).fetch = jest.fn().mockResolvedValue({
      status: 200,
    });

    const isConnected = await networkMonitor.checkConnectivity();
    expect(isConnected).toBe(true);
    expect(networkMonitor.getIsOnline()).toBe(true);
  });

  it('checkConnectivity 當 fetch 拋出例外時應標記為離線狀態', async () => {
    (globalThis as any).fetch = jest.fn().mockRejectedValue(new Error('Network request failed'));

    const isConnected = await networkMonitor.checkConnectivity();
    expect(isConnected).toBe(false);
    expect(networkMonitor.getIsOnline()).toBe(false);
  });
});
