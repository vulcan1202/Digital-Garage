import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../hooks/useLanguage';

interface LanguageSwitcherProps {
  className?: string;
}

const TAB_WIDTH = 34;
const TAB_HEIGHT = 22;
const TRACK_PADDING = 2;

/**
 * 數位車庫 Dark-Metal 雙態語系切換器 [ 繁中 | EN ]
 * 具備流暢平移膠囊動畫、防溢位圓角設計與 TalkBack / A11y 語音報讀支援
 */
export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { currentLanguage, toggleLanguage } = useLanguage();

  const isEn = currentLanguage === 'en-US';

  // 滑動膠囊平移動畫 (0: 繁中, 1: EN)
  const slideAnim = useRef(new Animated.Value(isEn ? 1 : 0)).current;
  // 點擊微反饋動畫
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isEn ? 1 : 0,
      useNativeDriver: true,
      friction: 9,
      tension: 65,
    }).start();
  }, [isEn, slideAnim]);

  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.94,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
      tension: 100,
    }).start();
  };

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TAB_WIDTH],
  });

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={toggleLanguage}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        android_ripple={null}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={t('common.a11y.languageSwitcher')}
        accessibilityHint={t('common.a11y.languageSwitcherHint', {
          lang: isEn ? '繁體中文' : 'English',
        })}
        accessibilityState={{ selected: isEn }}
        style={[styles.track, styles.trackShadow]}
        className={className}
      >
        {/* 滑動選擇膠囊 (Smooth Sliding Pill Indicator) */}
        <Animated.View
          style={[
            styles.slider,
            {
              transform: [{ translateX }],
            },
          ]}
        />

        {/* 標籤文字 (繁中 | EN) */}
        <View style={styles.labelsContainer}>
          <View style={styles.tab}>
            <Text
              style={[
                styles.tabText,
                !isEn ? styles.activeTabText : styles.inactiveTabText,
              ]}
            >
              繁中
            </Text>
          </View>
          <View style={styles.tab}>
            <Text
              style={[
                styles.tabText,
                isEn ? styles.activeTabText : styles.inactiveTabText,
              ]}
            >
              EN
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  track: {
    width: TAB_WIDTH * 2 + TRACK_PADDING * 2 + 2, // 74px
    height: 28,
    borderRadius: 14,
    backgroundColor: '#121215',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: TRACK_PADDING,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trackShadow: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  slider: {
    position: 'absolute',
    left: TRACK_PADDING,
    top: TRACK_PADDING,
    width: TAB_WIDTH,
    height: TAB_HEIGHT,
    borderRadius: TAB_HEIGHT / 2,
    backgroundColor: 'rgba(255, 107, 0, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 0, 0.65)',
  },
  labelsContainer: {
    flexDirection: 'row',
    width: '100%',
    height: TAB_HEIGHT,
    alignItems: 'center',
    zIndex: 1,
  },
  tab: {
    width: TAB_WIDTH,
    height: TAB_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
  },
  activeTabText: {
    color: '#ff6b00',
  },
  inactiveTabText: {
    color: '#71717a',
  },
});
