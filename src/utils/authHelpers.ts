/**
 * 認證輔助函式庫 (Authentication Helpers)
 * 專為 Supabase Auth 在各種設定情境下的回傳值進行精準判斷
 */

/**
 * 判斷 Supabase signUp 回傳結果是否代表「該電子信箱已被註冊」
 * 
 * 涵蓋兩種 Supabase 行為機制：
 * 1. 顯式錯誤 (傳統/未開啟列舉防護)：
 *    - error.code 為 'user_already_exists'
 *    - error.message 包含 'already registered' 或 'already exists'
 * 2. 防止使用者列舉保護 (User Enumeration Protection，現代 Supabase 預設行為)：
 *    - 為防有心人士探測信箱是否存在，Supabase 不會回傳 error，
 *    - 而是回傳一個 identities 為空陣列 (`identities: []`) 的 user 物件。
 * 
 * @param error Supabase 回傳之錯誤物件 (AuthError 或類似物件)
 * @param data Supabase 回傳之 data 物件 (包含 user 資訊)
 * @returns boolean 若為已註冊信箱則回傳 true
 */
export function isEmailAlreadyRegistered(
  error: { code?: string; message?: string } | null | undefined,
  data?: { user?: { identities?: unknown[] } | null } | null
): boolean {
  if (error) {
    if (error.code === 'user_already_exists') {
      return true;
    }
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('already registered') || msg.includes('already exists')) {
      return true;
    }
  }

  // 當 error 為空且 user 存在時，檢查 identities 是否為空陣列
  if (!error && data?.user) {
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return true;
    }
  }

  return false;
}
