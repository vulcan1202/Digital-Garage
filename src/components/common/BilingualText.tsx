import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../hooks/useLanguage';
import { getEnglishText } from '../../i18n';
import type { TranslationKey } from '../../i18n/types';

export interface BilingualTextProps {
  translationKey: TranslationKey;
  englishKey?: TranslationKey;
  titleClassName?: string;
  subClassName?: string;
  containerClassName?: string;
  numberOfLines?: number;
}

/**
 * 數位車庫雙語並陳文字元件
 * 遵循 5 大情境規則表：
 * - zh-TW + isBilingual: 繁中主標題 + 英文副標題
 * - zh-TW + !isBilingual: 純繁中主標題
 * - en-US + isBilingual: 英文主標題，不重複顯示英文副標題
 * - en-US + !isBilingual: 純英文主標題
 * - 英文缺失/空白: 嚴格不顯示副標題，亦不顯示 undefined 或未替換 placeholder
 */
export const BilingualText: React.FC<BilingualTextProps> = ({
  translationKey,
  englishKey,
  titleClassName = 'text-base font-bold text-white',
  subClassName = 'text-[10px] font-mono tracking-wider text-metal-400 uppercase',
  containerClassName = '',
  numberOfLines,
}) => {
  const { t } = useTranslation();
  const { currentLanguage, isBilingual } = useLanguage();

  const mainText = t(translationKey);
  const targetEnKey = englishKey || translationKey;
  const enSubText = getEnglishText(targetEnKey);

  const shouldShowSubtitle =
    currentLanguage === 'zh-TW' &&
    isBilingual &&
    Boolean(enSubText && enSubText.trim().length > 0);

  return (
    <View className={containerClassName}>
      <Text className={titleClassName} numberOfLines={numberOfLines}>
        {mainText}
      </Text>
      {shouldShowSubtitle && (
        <Text className={`mt-0.5 ${subClassName}`} numberOfLines={1}>
          {enSubText}
        </Text>
      )}
    </View>
  );
};
