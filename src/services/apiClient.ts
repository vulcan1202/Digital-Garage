import { supabase } from '../lib/supabase';
import { AppError, AppErrorCode } from './errors/AppError';
import { networkMonitor } from './networkMonitor';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  'https://digital-garage-api-997244262524.us-central1.run.app/api/v1';

/**
 * 產生合規之 UUID v4 作為客戶端請求關聯識別碼
 */
export function generateClientRequestId(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 數位車庫共用 API 請求客戶端
 * 自動獲取當前 Supabase Auth JWT Session 並掛載 Authorization Header
 * 每次請求注入安全隨機 X-Request-ID，非 2xx 回應統一解構並保留權威 Request ID 拋出
 */
export async function requestApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  // 產生用戶端請求關聯識別碼 (UUID v4)
  const clientRequestId = generateClientRequestId();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-ID': clientRequestId,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  let response: Response;
  const startTime = Date.now();
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
    // 附帶測速 (Piggyback Strategy)：記錄真實業務 API 請求耗時
    const latency = Date.now() - startTime;
    networkMonitor.recordLatency(latency);
  } catch (netErr: unknown) {
    // 網路連線中斷或伺服器不可達
    networkMonitor.notifyOffline();
    throw AppError.network('無法連線至車庫後端伺服器，請檢查網路連線或伺服器狀態', netErr, clientRequestId);
  }

  // 讀取後端回傳之權威 Request ID (若後端未回傳則以用戶端請求 ID 備用)
  const serverRequestId =
    (response.headers?.get ? response.headers.get('x-request-id') || response.headers.get('X-Request-ID') : null) ||
    clientRequestId;

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let code: AppErrorCode = 'UNKNOWN';

    if (errorData.error) {
      code = errorData.error as AppErrorCode;
    } else if (response.status === 401) {
      code = 'AUTH_REQUIRED';
    } else if (response.status === 403) {
      code = 'PERMISSION_DENIED';
    } else if (response.status === 404) {
      code = 'NOT_FOUND';
    } else if (response.status === 409) {
      code = 'CONFLICT';
    } else if (response.status >= 500) {
      code = 'DATABASE_ERROR';
    }

    const message = errorData.message || `API 請求失敗 (HTTP ${response.status})`;
    throw new AppError(code, message, errorData, serverRequestId);
  }

  // 若為 204 No Content，直接回傳 null/undefined
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const result = await response.json();
  return result.data !== undefined ? result.data : result;
}
