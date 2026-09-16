import * as SecureStore from 'expo-secure-store';

/**
 * 數位車庫 Partitioned Lightweight Cache Storage
 * 採用 expo-secure-store 作為本地持久化介質，以 QueryKey 進行分項鍵值隔離
 * 嚴格防範單一巨型字串超出 iOS Keychain 限制 (限制各項目上限 20 筆)，具備完備例外防禦
 */

export const CACHE_KEYS = {
  VEHICLES: 'DG_CACHE_VEHICLES',
  REFUELS_PREFIX: 'DG_CACHE_REFUELS_',
  MAINTENANCE_PREFIX: 'DG_CACHE_MAINT_',
  REMINDERS_PREFIX: 'DG_CACHE_REMINDERS_',
  MODIFICATIONS_PREFIX: 'DG_CACHE_MODS_',
  MOD_DETAIL_PREFIX: 'DG_CACHE_MOD_DETAIL_',
  MUTATION_QUEUE: 'DG_MUTATION_QUEUE',
  FAILED_MUTATIONS: 'DG_FAILED_MUTATIONS',
} as const;

export const cacheStorage = {
  /**
   * 讀取快取資料並自動反序列化
   */
  async getItem<T>(key: string): Promise<T | null> {
    try {
      const raw = await SecureStore.getItemAsync(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      console.warn(`[cacheStorage] getItem failed for key: ${key}`, err);
      return null;
    }
  },

  /**
   * 寫入快取資料並自動序列化
   */
  async setItem<T>(key: string, value: T): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      await SecureStore.setItemAsync(key, serialized);
      return true;
    } catch (err) {
      console.warn(`[cacheStorage] setItem failed for key: ${key}`, err);
      return false;
    }
  },

  /**
   * 刪除指定快取鍵
   */
  async removeItem(key: string): Promise<boolean> {
    try {
      await SecureStore.deleteItemAsync(key);
      return true;
    } catch (err) {
      console.warn(`[cacheStorage] removeItem failed for key: ${key}`, err);
      return false;
    }
  },

  /**
   * 輔助函式：針對列表型資料進行上限裁切 (如最多保留最新 20 筆)
   */
  sliceSnapshot<T>(items: T[], maxItems: number = 20): T[] {
    if (!Array.isArray(items)) return [];
    return items.slice(0, maxItems);
  },
};
