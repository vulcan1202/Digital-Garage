jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: 'fake-jwt-token' } },
      }),
    },
  },
}));

jest.mock('../networkMonitor', () => ({
  networkMonitor: {
    notifyOnline: jest.fn(),
    notifyOffline: jest.fn(),
  },
}));

import { requestApi, generateClientRequestId } from '../apiClient';
import { AppError } from '../errors/AppError';

describe('apiClient Request Correlation ID QA', () => {
  const originalFetch = (globalThis as any).fetch;
  const originalCrypto = (globalThis as any).crypto;

  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as any).crypto = {
      randomUUID: () => 'mock-client-uuid-1111-2222-3333-444444444444',
    };
  });

  afterAll(() => {
    (globalThis as any).fetch = originalFetch;
    (globalThis as any).crypto = originalCrypto;
  });

  it('generateClientRequestId 產生符合 RFC 4122 UUID v4 格式之字串', () => {
    (globalThis as any).crypto = undefined; // 測試 fallback 演算法
    const fallbackId = generateClientRequestId();
    expect(fallbackId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('發起請求時必須自動產生並帶入 X-Request-ID 標頭', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (h: string) => (h.toLowerCase() === 'x-request-id' ? 'mock-server-uuid-5555' : null),
      },
      json: jest.fn().mockResolvedValue({ data: { success: true } }),
    });
    (globalThis as any).fetch = mockFetch;

    const result = await requestApi<{ success: boolean }>('/vehicles');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, requestInit] = mockFetch.mock.calls[0];
    expect(requestInit.headers['X-Request-ID']).toBe('mock-client-uuid-1111-2222-3333-444444444444');
    expect(result).toEqual({ success: true });
  });

  it('當 API 回傳非 2xx 失敗時，AppError 必須正確攜帶後端回傳之權威 X-Request-ID', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: {
        get: (h: string) => (h.toLowerCase() === 'x-request-id' ? 'authoritative-backend-uuid-9999' : null),
      },
      json: jest.fn().mockResolvedValue({ error: 'VALIDATION_ERROR', message: '里程格式不正確' }),
    });
    (globalThis as any).fetch = mockFetch;

    try {
      await requestApi('/vehicles');
      throw new Error('預期拋出 AppError 但未拋出');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.code).toBe('VALIDATION_ERROR');
      expect(appErr.message).toBe('里程格式不正確');
      expect(appErr.requestId).toBe('authoritative-backend-uuid-9999');
    }
  });

  it('當後端未提供 Response Header 時，AppError 應安全降級保留 Client Request ID', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: {
        get: () => null,
      },
      json: jest.fn().mockResolvedValue({ error: 'DATABASE_ERROR', message: '內部錯誤' }),
    });
    (globalThis as any).fetch = mockFetch;

    try {
      await requestApi('/vehicles');
      throw new Error('預期拋出 AppError 但未拋出');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.requestId).toBe('mock-client-uuid-1111-2222-3333-444444444444');
    }
  });
});
