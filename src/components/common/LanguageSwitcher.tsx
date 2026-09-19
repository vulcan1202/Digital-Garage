import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../hooks/useLanguage';

interface LanguageSwitcherProps {
  className?: string;
}

/**
 * 數位車庫 Dark-Metal 雙態語系切換器 [ 繁中 | EN ]
 * 具備原生 hitSlop 觸控擴展與 TalkBack / A11y 語音報讀支援
 */
export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { currentLanguage, toggleLanguage } = useLanguage();

  const isEn = currentLanguage === 'en-US';

  return (
    <Pressable
      onPress={toggleLanguage}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={t('common.a11y.languageSwitcher')}
      accessibilityHint={t('common.a11y.languageSwitcherHint', {
        lang: isEn ? '繁體中文' : 'English',
      })}
      accessibilityState={{ selected: isEn }}
      className={`flex-row items-center bg-black/40 rounded-full border border-white/10 p-0.5 ${className}`}
    >
      <View
        className={`px-2 py-0.5 rounded-full ${
          !isEn ? 'bg-racing-orange/20 border border-racing-orange/40' : 'bg-transparent'
        }`}
      >
        <Text
          className={`text-[10px] font-mono font-bold ${
            !isEn ? 'text-racing-orange' : 'text-metal-400'
          }`}
        >
          繁中
        </Text>
      </View>
      <View
        className={`px-2 py-0.5 rounded-full ${
          isEn ? 'bg-racing-orange/20 border border-racing-orange/40' : 'bg-transparent'
        }`}
      >
        <Text
          className={`text-[10px] font-mono font-bold ${
            isEn ? 'text-racing-orange' : 'text-metal-400'
          }`}
        >
          EN
        </Text>
      </View>
    </Pressable>
  );
};
