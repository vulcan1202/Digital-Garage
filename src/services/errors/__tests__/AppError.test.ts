import { AppError } from '../AppError';

describe('AppError mapping', () => {
  it('maps PostgreSQL 23505 to CONFLICT', () => {
    const rawPgError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "idx_modification_single_current"',
    };
    const appErr = AppError.fromSupabaseError(rawPgError);
    expect(appErr.code).toBe('CONFLICT');
    expect(appErr.message).toContain('唯一索引限制');
  });

  it('maps PostgREST PGRST116 and 404 to NOT_FOUND', () => {
    const notFoundPgrst = { code: 'PGRST116', message: 'The result contains 0 rows' };
    expect(AppError.fromSupabaseError(notFoundPgrst).code).toBe('NOT_FOUND');

    const notFoundHttp = { status: 404, message: 'Not Found' };
    expect(AppError.fromSupabaseError(notFoundHttp).code).toBe('NOT_FOUND');
  });

  it('maps 42501 and 403 to PERMISSION_DENIED', () => {
    const rlsDenied = { code: '42501', message: 'new row violates row-level security policy' };
    expect(AppError.fromSupabaseError(rlsDenied).code).toBe('PERMISSION_DENIED');

    const forbidden = { status: 403, message: 'Forbidden' };
    expect(AppError.fromSupabaseError(forbidden).code).toBe('PERMISSION_DENIED');
  });

  it('maps 401 to AUTH_REQUIRED', () => {
    const unauth = { status: 401, message: 'Invalid JWT' };
    expect(AppError.fromSupabaseError(unauth).code).toBe('AUTH_REQUIRED');
  });

  it('maps network errors to NETWORK_ERROR', () => {
    const networkErr = { name: 'FetchError', message: 'Failed to fetch' };
    expect(AppError.fromSupabaseError(networkErr).code).toBe('NETWORK_ERROR');
  });

  it('maps storage errors to STORAGE_UPLOAD_FAILED', () => {
    const storageErr = { name: 'StorageError', message: 'Bucket not found' };
    expect(AppError.fromSupabaseError(storageErr).code).toBe('STORAGE_UPLOAD_FAILED');
  });

  it('preserves already instantiated AppError', () => {
    const custom = AppError.validation('Custom validation failed');
    expect(AppError.fromSupabaseError(custom)).toBe(custom);
  });
});
