import React, { createContext, useState, useEffect, useRef, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import i18n from '../i18n';
import type { SupportedLanguage } from '../i18n/types';
import { CACHE_KEYS } from '../lib/cacheStorage';

export interface LanguageContextType {
  currentLanguage: SupportedLanguage;
  isBilingual: boolean;
  isHydrated: boolean;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  toggleLanguage: () => Promise<void>;
  setBilingualMode: (enabled: boolean) => Promise<void>;
}

export const LanguageContext = createContext<LanguageContextType | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLanguage, setCurrentLanguageState] = useState<SupportedLanguage>('zh-TW');
  const [isBilingual, setIsBilingualState] = useState<boolean>(true);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // 競態條件保護：維護遞增版本號
  const langChangeVersionRef = useRef(0);
  const bilingualChangeVersionRef = useRef(0);

  // 開機水合 (Hydration)
  useEffect(() => {
    let isMounted = true;

    async function hydratePreferences() {
      let resolvedLang: SupportedLanguage = 'zh-TW';
      let resolvedBilingual = true;

      try {
        const storedLang = await SecureStore.getItemAsync(CACHE_KEYS.USER_LANGUAGE);
        if (storedLang === 'zh-TW' || storedLang === 'en-US') {
          resolvedLang = storedLang;
        }
      } catch (err) {
        console.warn('[LanguageProvider] Failed to read stored language, fallback to zh-TW', err);
      }

      try {
        const storedBilingual = await SecureStore.getItemAsync(CACHE_KEYS.USER_BILINGUAL);
        if (storedBilingual === 'false') {
          resolvedBilingual = false;
        } else {
          resolvedBilingual = true;
        }
      } catch (err) {
        console.warn('[LanguageProvider] Failed to read stored bilingual mode, fallback to true', err);
      }

      if (isMounted) {
        // 設定 i18next 語系
        await i18n.changeLanguage(resolvedLang);
        setCurrentLanguageState(resolvedLang);
        setIsBilingualState(resolvedBilingual);
        setIsHydrated(true);
      }
    }

    hydratePreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  const setLanguage = async (lang: SupportedLanguage) => {
    if (lang !== 'zh-TW' && lang !== 'en-US') return;

    const version = ++langChangeVersionRef.current;
    // 樂觀更新狀態
    setCurrentLanguageState(lang);
    await i18n.changeLanguage(lang);

    try {
      await SecureStore.setItemAsync(CACHE_KEYS.USER_LANGUAGE, lang);
    } catch (err) {
      console.warn('[LanguageProvider] Failed to persist user language preference', err);
      // 依 Guardrail: 寫入失敗維持 UI 狀態，不回滾
    }
  };

  const toggleLanguage = async () => {
    const nextLang: SupportedLanguage = currentLanguage === 'zh-TW' ? 'en-US' : 'zh-TW';
    await setLanguage(nextLang);
  };

  const setBilingualMode = async (enabled: boolean) => {
    const version = ++bilingualChangeVersionRef.current;
    // 樂觀更新狀態
    setIsBilingualState(enabled);

    try {
      await SecureStore.setItemAsync(CACHE_KEYS.USER_BILINGUAL, String(enabled));
    } catch (err) {
      console.warn('[LanguageProvider] Failed to persist bilingual mode preference', err);
      // 依 Guardrail: 寫入失敗維持 UI 狀態，不回滾
    }
  };

  const contextValue = useMemo<LanguageContextType>(
    () => ({
      currentLanguage,
      isBilingual,
      isHydrated,
      setLanguage,
      toggleLanguage,
      setBilingualMode,
    }),
    [currentLanguage, isBilingual, isHydrated]
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};
