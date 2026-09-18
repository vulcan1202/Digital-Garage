import {
  errorReporter,
  isSensitiveKey,
  scrubSensitiveData,
} from '../errorReporter';
import { AppError } from '../errors/AppError';

describe('errorReporter QA & Reliability', () => {
  let originalConsoleError: any;
  let consoleErrorMock: jest.Mock;

  beforeEach(() => {
    errorReporter.init({ environment: 'test', release: '1.0.0+test' });
    errorReporter._clearCache();
    originalConsoleError = console.error;
    consoleErrorMock = jest.fn();
    console.error = consoleErrorMock;
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe('isSensitiveKey 邊界比對', () => {
    it('大小寫無關完全比對：敏感鍵名必須回傳 true', () => {
      expect(isSensitiveKey('authorization')).toBe(true);
      expect(isSensitiveKey('AUTHORIZATION')).toBe(true);
      expect(isSensitiveKey('password')).toBe(true);
      expect(isSensitiveKey('PASSWORD')).toBe(true);
      expect(isSensitiveKey('Token')).toBe(true);
      expect(isSensitiveKey('access_token')).toBe(true);
      expect(isSensitiveKey('refresh_token')).toBe(true);
      expect(isSensitiveKey('cookie')).toBe(true);
    });

    it('業務欄位不誤判：包含敏感子字串但非機敏鍵名者不得誤殺', () => {
      expect(isSensitiveKey('token_type')).toBe(false);
      expect(isSensitiveKey('token_count')).toBe(false);
      expect(isSensitiveKey('token_status')).toBe(false);
      expect(isSensitiveKey('vehicle_id')).toBe(false);
    });
  });

  describe('scrubSensitiveData 脫敏防護', () => {
    it('字串中的 Bearer Token 與車牌號碼必須被安全遮蔽', () => {
      const rawText = 'API Auth failed for Bearer eyJhbGciOiJIUzI1Ni.secret and plate ABC-5678';
      const scrubbed = scrubSensitiveData(rawText);

      expect(scrubbed).not.toContain('eyJhbGciOiJIUzI1Ni.secret');
      expect(scrubbed).toContain('Bearer [REDACTED]');
      expect(scrubbed).not.toContain('ABC-5678');
      expect(scrubbed).toContain('***-5678');
    });

    it('巢狀物件與切片中的機敏鍵值必須替換為 [REDACTED]', () => {
      const input = {
        user_id: 'usr-1',
        password: 'plainPassword123',
        nested: {
          api_key: 'sk-9999',
          token_type: 'Bearer', // 應保留
          tokens: ['plain-item', { refresh_token: 'secret-refresh' }],
        },
      };

      const scrubbed = scrubSensitiveData(input);

      expect(scrubbed.password).toBe('[REDACTED]');
      expect(scrubbed.nested.api_key).toBe('[REDACTED]');
      expect(scrubbed.nested.token_type).toBe('Bearer');
      expect(scrubbed.nested.tokens[1].refresh_token).toBe('[REDACTED]');
      expect(scrubbed.user_id).toBe('usr-1');
    });
  });

  describe('錯誤分級與抑制 (Non-Crash Suppression)', () => {
    it('離線與網路逾時不得作為系統 Crash 上報', () => {
      const netErr = AppError.network('連線超時');
      const eventId = errorReporter.captureException(netErr);

      expect(eventId).toBeUndefined();
      expect(consoleErrorMock).not.toHaveBeenCalled();
    });

    it('401 (未認證) 與 422/400 (驗證不符) 不得上報為 Crash', () => {
      const authErr = AppError.authRequired('請先登入');
      const valErr = AppError.validation('里程不可為負');

      expect(errorReporter.captureException(authErr)).toBeUndefined();
      expect(errorReporter.captureException(valErr)).toBeUndefined();
      expect(consoleErrorMock).not.toHaveBeenCalled();
    });

    it('500 (內部資料庫錯誤) 與未捕獲 JS Runtime 例外必須立即上報', () => {
      const serverErr = AppError.database('DB connection failed', {}, 'req-db-fail-123');
      const eventId = errorReporter.captureException(serverErr, {
        endpoint: '/api/v1/vehicles',
        statusCode: 500,
        requestId: 'req-db-fail-123',
      });

      expect(eventId).toBeDefined();
      expect(consoleErrorMock).toHaveBeenCalledTimes(1);
      const logCall = consoleErrorMock.mock.calls[0][1];
      expect(logCall).toContain('req-db-fail-123');
      expect(logCall).toContain('DB connection failed');
    });
  });

  describe('複合鍵 30 秒滑動窗口去重 (Composite Key Deduplication)', () => {
    it('相同特徵錯誤在 30 秒窗口內僅記錄 1 次，防止重試或迴圈洗版', () => {
      const errA = new Error('Database deadlock on transaction');
      const ctx = { endpoint: '/api/v1/refuels', statusCode: 500, requestId: 'req-retry-1' };

      // 第 1 次觸發：應正常上報
      const id1 = errorReporter.captureException(errA, ctx);
      expect(id1).toBeDefined();
      expect(consoleErrorMock).toHaveBeenCalledTimes(1);

      // 第 2 次觸發 (重試，帶不同 Request ID，但特徵相同)：應被去重抑制
      const id2 = errorReporter.captureException(errA, {
        ...ctx,
        requestId: 'req-retry-2',
      });
      expect(id2).toBeUndefined();
      expect(consoleErrorMock).toHaveBeenCalledTimes(1); // 次數未增加
    });

    it('不同 Endpoint 或不同狀態碼之錯誤不得被錯誤去重', () => {
      const err = new Error('Database timeout');

      const id1 = errorReporter.captureException(err, { endpoint: '/api/v1/refuels', statusCode: 500 });
      const id2 = errorReporter.captureException(err, { endpoint: '/api/v1/maintenance', statusCode: 500 });

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(consoleErrorMock).toHaveBeenCalledTimes(2);
    });
  });
});
