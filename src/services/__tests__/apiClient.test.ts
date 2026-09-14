import { requestApi } from '../apiClient';
import { supabase } from '../../lib/supabase';
import { AppError } from '../errors/AppError';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
  },
}));

describe('apiClient requestApi', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('自動掛載 Authorization Header 並成功解包 data', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: {
        session: { access_token: 'mock-jwt-token-xyz' },
      },
    });

    const mockData = [{ id: 1, brand: 'Honda', model: 'Civic' }];
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: mockData }),
    });
    (globalThis as any).fetch = fetchMock;

    const result = await requestApi('/vehicles');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/vehicles'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-jwt-token-xyz',
          'Content-Type': 'application/json',
        }),
      })
    );
    expect(result).toEqual(mockData);
  });

  it('當伺服器回傳 404 時正確拋出 NOT_FOUND 之 AppError', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
    });

    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'NOT_FOUND', message: '查無此車輛' }),
    });
    (globalThis as any).fetch = fetchMock;

    await expect(requestApi('/vehicles/999')).rejects.toThrow(AppError);
    await expect(requestApi('/vehicles/999')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: '查無此車輛',
    });
  });

  it('當伺服器回傳 409 時正確拋出 CONFLICT 之 AppError', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
    });

    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'CONFLICT', message: '已有生效中之設定組' }),
    });
    (globalThis as any).fetch = fetchMock;

    await expect(requestApi('/setting-sets/1')).rejects.toMatchObject({
      code: 'CONFLICT',
      message: '已有生效中之設定組',
    });
  });

  it('當網路連線中斷時拋出 NETWORK_ERROR 之 AppError', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
    });

    const fetchMock = jest.fn().mockRejectedValue(new Error('Network request failed'));
    (globalThis as any).fetch = fetchMock;

    await expect(requestApi('/vehicles')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });
});
