import { createClient, User } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Database } from '../types/database';
import { AppError } from '../services/errors/AppError';

// Expo SecureStore Storage Adapter for Supabase Auth
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Ignore secure store write failure in restricted environments
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Ignore secure store delete failure
    }
  },
};

// Supabase Client 連結方法：
// 優先採用新版 Publishable Key (sb_pub_...)，並向下相容舊版 Anon Key (JWT anon key)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'placeholder-anon-key';

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});


/**
 * 獲取當前登入之使用者
 * 若未登入或 Session 已過期，安全拋出 AppError.authRequired
 */
export async function requireUser(): Promise<User> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw AppError.authRequired('請先登入數位車庫帳號');
  }
  return user;
}
