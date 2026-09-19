import './types';
import i18n, { type TOptions } from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhTW from './locales/zh-TW.json';
import enUS from './locales/en-US.json';
import type { TranslationKey, SupportedLanguage } from './types';

export const resources = {
  'zh-TW': {
    translation: zhTW,
  },
  'en-US': {
    translation: enUS,
  },
} as const;

i18n.use(initReactI18next).init({
  resources,
  lng: 'zh-TW',
  fallbackLng: 'zh-TW',
  interpolation: {
    escapeValue: false, // React 已自帶 XSS 逃逸保護
  },
  react: {
    useSuspense: false,
  },
});

/**
 * 取得英文固定語系翻譯 Helper
 * 嚴格查詢 en-US，若無有效非空字串則回傳空字串，絕不 fallback 至繁中
 */
export function getEnglishText(
  key: TranslationKey,
  options?: TOptions
): string {
  if (!key) return '';

  const translate = i18n.t as unknown as (
    k: string,
    opts?: Record<string, unknown>
  ) => string;

  const result = translate(key, {
    lng: 'en-US',
    fallbackLng: [], // 嚴格不 fallback 回目前語系或預設語系
    ...options,
  });

  if (typeof result !== 'string' || result === key || !result.trim()) {
    return '';
  }

  return result;
}

export default i18n;
export type { TranslationKey, SupportedLanguage };
