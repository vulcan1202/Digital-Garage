import { supabase } from '../lib/supabase';
import { AppError, AppErrorCode } from './errors/AppError';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  'https://digital-garage-api-997244262524.asia-east1.run.app/api/v1';

/**
 * 數位車庫共用 API 請求客戶端
 * 自動獲取當前 Supabase Auth JWT Session 並掛載 Authorization Header
 * 非 2xx 回應統一解構並包裝為標準 AppError 拋出
 */
export async function requestApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (netErr: unknown) {
    throw AppError.network('無法連線至車庫後端伺服器，請檢查網路連線或伺服器狀態', netErr);
  }

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
    throw new AppError(code, message, errorData);
  }

  // 若為 204 No Content，直接回傳 null/undefined
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const result = await response.json();
  return result.data !== undefined ? result.data : result;
}
