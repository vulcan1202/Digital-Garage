import { isEmailAlreadyRegistered } from '../authHelpers';

describe('isEmailAlreadyRegistered', () => {
  describe('顯式錯誤情境 (Explicit Error)', () => {
    it('當 error.code 為 user_already_exists 時應回傳 true', () => {
      const error = { code: 'user_already_exists', message: 'User already exists' };
      expect(isEmailAlreadyRegistered(error, null)).toBe(true);
    });

    it('當 error.message 包含 User already registered 時應回傳 true', () => {
      const error = { message: 'User already registered' };
      expect(isEmailAlreadyRegistered(error, null)).toBe(true);
    });

    it('當 error.message 包含 A user with this email already exists 時應回傳 true', () => {
      const error = { message: 'A user with this email already exists' };
      expect(isEmailAlreadyRegistered(error, null)).toBe(true);
    });

    it('當 error 為其他錯誤（如密碼過弱或發信頻率過高）時應回傳 false', () => {
      const rateLimitErr = { code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' };
      expect(isEmailAlreadyRegistered(rateLimitErr, null)).toBe(false);

      const weakPwdErr = { code: 'weak_password', message: 'Password should be at least 6 characters.' };
      expect(isEmailAlreadyRegistered(weakPwdErr, null)).toBe(false);
    });
  });

  describe('防使用者列舉保護情境 (User Enumeration Protection - Empty identities)', () => {
    it('當 error 為 null 但 user.identities 為空陣列 [] 時應回傳 true (代表信箱已存在)', () => {
      const data = {
        user: {
          id: 'existing-user-uuid',
          email: 'test@example.com',
          identities: [],
        },
      };
      expect(isEmailAlreadyRegistered(null, data)).toBe(true);
    });

    it('當 error 為 null 且 user.identities 包含身份資料時應回傳 false (代表全新註冊)', () => {
      const data = {
        user: {
          id: 'new-user-uuid',
          email: 'newbie@example.com',
          identities: [
            {
              id: 'identity-uuid',
              user_id: 'new-user-uuid',
              identity_data: { email: 'newbie@example.com' },
              provider: 'email',
            },
          ],
        },
      };
      expect(isEmailAlreadyRegistered(null, data)).toBe(false);
    });

    it('當 data 或 user 為 null 時應回傳 false', () => {
      expect(isEmailAlreadyRegistered(null, null)).toBe(false);
      expect(isEmailAlreadyRegistered(null, { user: null })).toBe(false);
    });
  });
});
