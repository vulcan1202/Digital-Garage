export type AppErrorCode =
  | 'AUTH_REQUIRED'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'PERMISSION_DENIED'
  | 'NETWORK_ERROR'
  | 'DATABASE_ERROR'
  | 'STORAGE_UPLOAD_FAILED'
  | 'UNKNOWN';

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly details?: unknown;

  constructor(code: AppErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static authRequired(message = '請先登入帳號', details?: unknown): AppError {
    return new AppError('AUTH_REQUIRED', message, details);
  }

  static notFound(message = '查無此資料', details?: unknown): AppError {
    return new AppError('NOT_FOUND', message, details);
  }

  static validation(message = '輸入參數驗證失敗', details?: unknown): AppError {
    return new AppError('VALIDATION_ERROR', message, details);
  }

  static conflict(message = '資料狀態衝突或違反唯一約束', details?: unknown): AppError {
    return new AppError('CONFLICT', message, details);
  }

  static permissionDenied(message = '權限不足，無法執行此操作', details?: unknown): AppError {
    return new AppError('PERMISSION_DENIED', message, details);
  }

  static network(message = '網路連線異常，請稍後再試', details?: unknown): AppError {
    return new AppError('NETWORK_ERROR', message, details);
  }

  static database(message = '資料庫操作異常', details?: unknown): AppError {
    return new AppError('DATABASE_ERROR', message, details);
  }

  static storage(message = '檔案儲存或上傳失敗', details?: unknown): AppError {
    return new AppError('STORAGE_UPLOAD_FAILED', message, details);
  }

  static unknown(message = '發生未預期的系統錯誤', details?: unknown): AppError {
    return new AppError('UNKNOWN', message, details);
  }

  /**
   * 統一將任意錯誤轉換為 AppError
   */
  static from(error: unknown): AppError {
    return AppError.fromSupabaseError(error);
  }

  /**
   * 統一將 Supabase / PostgREST / Storage / Network 錯誤轉換為 AppError
   * 保證 raw error 絕不直接暴露至 UI
   */
  static fromSupabaseError(error: unknown): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (!error || typeof error !== 'object') {
      return AppError.unknown('發生未知錯誤', error);
    }

    const err = error as {
      code?: string;
      message?: string;
      details?: unknown;
      status?: number;
      name?: string;
    };

    const message = err.message || '資料庫操作失敗';

    // 1. PostgreSQL 23505: Unique violation (唯一索引或部分唯一約束衝突)
    if (err.code === '23505') {
      return AppError.conflict('資料已存在或狀態已衝突（唯一索引限制）', err);
    }

    // 2. PostgREST NOT_FOUND (例如 .single() 查無記錄)
    if (err.code === 'PGRST116' || err.status === 404) {
      return AppError.notFound('查無相關資料', err);
    }

    // 3. PostgreSQL 42501 或 401/403: 權限不足 / RLS 拒絕
    if (err.code === '42501' || err.status === 403) {
      return AppError.permissionDenied('權限不足或存取已被拒絕', err);
    }

    if (err.status === 401) {
      return AppError.authRequired('認證無效或尚未登入', err);
    }

    // 4. 網路異常 (FetchError / NetworkError)
    if (
      err.name === 'FetchError' ||
      err.name === 'TypeError' && err.message?.includes('fetch') ||
      err.message?.toLowerCase().includes('network')
    ) {
      return AppError.network('無法連線至伺服器，請檢查網路狀態', err);
    }

    // 5. Storage 上傳失敗
    if (err.name === 'StorageError' || err.message?.toLowerCase().includes('storage')) {
      return AppError.storage(`檔案儲存失敗: ${message}`, err);
    }

    // 6. 其他 Database / PostgREST 錯誤：過濾資料庫原生技術性錯誤，提供統一友善訊息
    let friendlyMessage = message;
    if (
      message.includes('violates not-null constraint') ||
      message.includes('violates check constraint') ||
      message.includes('null value in column')
    ) {
      if (message.includes('vehicle_type')) {
        friendlyMessage = '請選擇車輛類型（汽車、機車或其他）';
      } else {
        friendlyMessage = '請確認必填欄位皆已完整填寫且符合格式要求';
      }
      return AppError.validation(friendlyMessage, err);
    }

    if (message.startsWith('failed to') || message.includes('SQLSTATE') || message.includes('syntax error')) {
      friendlyMessage = '系統處理資料時發生異常，請稍後再試';
    }

    return AppError.database(friendlyMessage, err);
  }
}

/**
 * Service 層專用之錯誤捕捉包裝器
 * 消除各 Service 方法重複撰寫之 try/catch 樣板代碼
 */
export async function handleServiceCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw AppError.fromSupabaseError(error);
  }
}
