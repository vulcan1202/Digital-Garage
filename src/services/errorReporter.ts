import { AppError } from './errors/AppError';

export interface ErrorReportContext {
  endpoint?: string;
  statusCode?: number;
  requestId?: string;
  componentStack?: string;
  [key: string]: any;
}

export interface ErrorReporterOptions {
  dsn?: string;
  environment?: string;
  release?: string;
}

// 敏感鍵名黑名單 (Case-Insensitive Exact Match)
const SENSITIVE_EXACT_KEYS = new Set([
  'authorization',
  'password',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'jwt',
  'api_key',
  'cookie',
]);

const REDACTED_VALUE = '[REDACTED]';

// 判斷是否為機敏鍵名，避免 token_type, token_count 遭誤判
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_EXACT_KEYS.has(key.trim().toLowerCase());
}

/**
 * 遞迴脫敏物件中的機敏資訊
 */
export function scrubSensitiveData(data: any): any {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    // 脫敏 Bearer Token
    let scrubbed = data.replace(/Bearer\s+[A-Za-z0-9-_=.]+/gi, `Bearer ${REDACTED_VALUE}`);
    // 脫敏車牌號碼 (如 ABC-1234 -> ***-1234)
    scrubbed = scrubbed.replace(/\b([A-Z0-9]{2,4})-([A-Z0-9]{2,4})\b/g, '***-$2');
    return scrubbed;
  }

  if (Array.isArray(data)) {
    return data.map((item) => scrubSensitiveData(item));
  }

  if (typeof data === 'object') {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (isSensitiveKey(k)) {
        result[k] = REDACTED_VALUE;
      } else {
        result[k] = scrubSensitiveData(v);
      }
    }
    return result;
  }

  return data;
}

interface DedupRecord {
  firstSeen: number;
  lastSeen: number;
  count: number;
  firstRequestId?: string;
  lastRequestId?: string;
}

class ErrorReporterService {
  private environment: string = 'production';
  private release: string = '1.0.0+1';
  private currentUser: { id?: string; email?: string } | null = null;
  private dedupCache = new Map<string, DedupRecord>();
  private readonly dedupWindowMs = 30 * 1000; // 30 秒滑動去重窗口

  public init(options: ErrorReporterOptions = {}): void {
    this.environment = options.environment || process.env.EXPO_PUBLIC_APP_ENV || 'production';
    this.release = options.release || '1.0.0+1';
    this.dedupCache.clear();
  }

  public setUser(user: { id?: string; email?: string } | null): void {
    this.currentUser = user ? { id: user.id } : null;
  }

  /**
   * 判定錯誤是否應被抑制 (不作為系統 Crash 上報)
   * - 離線網路逾時/中斷 (由 syncQueue 與離線狀態機正常處理)
   * - 401 認證失效 (引導登入流程)
   * - 400 / 422 業務資料驗證失敗 (呈現表單提示)
   */
  public isSuppressedError(error: unknown): boolean {
    if (!error) return true;

    if (error instanceof AppError) {
      // 伺服器端 5xx (DATABASE_ERROR / UNKNOWN) 必須正常上報
      if (error.code === 'DATABASE_ERROR' || error.code === 'UNKNOWN') {
        return false;
      }
      if (error.code === 'NETWORK_ERROR' || error.code === 'AUTH_REQUIRED' || error.code === 'VALIDATION_ERROR') {
        return true;
      }
    }

    const err = error as { name?: string; message?: string; status?: number; code?: string };
    const msg = (err.message || '').toLowerCase();

    // 僅過濾客戶端純離線/斷網相關例外
    if (
      err.name === 'FetchError' ||
      (err.name === 'TypeError' && msg.includes('fetch')) ||
      msg.includes('network request failed') ||
      msg.includes('network unavailable')
    ) {
      return true;
    }

    // 401 認證過期與 400/422 業務驗證不屬於系統 Crash
    if (err.status === 401 || err.status === 400 || err.status === 422) {
      return true;
    }

    return false;
  }

  /**
   * 計算複合去重鍵：
   * dedupKey = hash(errorType + endpoint + status + normalizedMessage)
   * 嚴格禁止單純使用每次重試皆不同的 Request ID 作為唯一去重鍵
   */
  private generateDedupKey(error: unknown, context: ErrorReportContext): string {
    const errorType = (error as any)?.name || (error instanceof AppError ? error.code : 'Error');
    const endpoint = context.endpoint || 'unknown_endpoint';
    const statusCode = context.statusCode || (error as any)?.status || '0';
    const rawMsg = (error as any)?.message || String(error);
    // 正規化訊息：移除動態 UUID 與數字
    const normalizedMessage = rawMsg
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
      .replace(/\d+/g, '<NUM>')
      .trim();

    return `${errorType}::${endpoint}::${statusCode}::${normalizedMessage}`;
  }

  /**
   * 捕捉例外並進行分級上報與去重
   * @returns 成功記錄時傳回 eventId，若被去重或抑制則傳回 undefined
   */
  public captureException(error: unknown, context: ErrorReportContext = {}): string | undefined {
    try {
      if (this.isSuppressedError(error)) {
        return undefined;
      }

      const now = Date.now();
      const dedupKey = this.generateDedupKey(error, context);
      const existing = this.dedupCache.get(dedupKey);

      // 滑動時間窗口去重檢查 (30 秒內不重複上報相同特徵錯誤)
      if (existing && now - existing.firstSeen < this.dedupWindowMs) {
        existing.count += 1;
        existing.lastSeen = now;
        if (context.requestId) {
          existing.lastRequestId = context.requestId;
        }
        return undefined; // 窗口內重複，抑制上報
      }

      // 建立全新或更新窗口記錄
      const record: DedupRecord = {
        firstSeen: now,
        lastSeen: now,
        count: 1,
        firstRequestId: context.requestId,
        lastRequestId: context.requestId,
      };
      this.dedupCache.set(dedupKey, record);

      // 執行機敏資料脫敏
      const sanitizedContext = scrubSensitiveData(context);
      const errorMsg = (error as any)?.message || String(error);
      const sanitizedMessage = scrubSensitiveData(errorMsg);

      const eventPayload = {
        level: 'error',
        release: this.release,
        environment: this.environment,
        user: this.currentUser,
        message: sanitizedMessage,
        requestId: context.requestId,
        context: sanitizedContext,
        stack: (error as any)?.stack,
        timestamp: new Date().toISOString(),
      };

      // 本地結構化降級輸出 (未配置 Sentry SDK 時安全輸出，絕不拋錯)
      console.error('[errorReporter] CAPTURED_CRASH:', JSON.stringify(eventPayload));

      return `event_${now}_${Math.random().toString(36).substring(2, 7)}`;
    } catch (selfErr) {
      // 鐵律：errorReporter 自身執行故障時絕對不得導致 App 拋出未捕捉例外
      console.warn('[errorReporter] self-failure ignored:', selfErr);
      return undefined;
    }
  }

  /**
   * 供測試使用：清除內部快取
   */
  public _clearCache(): void {
    this.dedupCache.clear();
  }
}

export const errorReporter = new ErrorReporterService();
