import { useEffect, useState } from 'react';
import { Keyboard, Platform, UIManager, LayoutAnimation } from 'react-native';

// Android 舊架構（Paper）開啟實驗性 LayoutAnimation 支援；新架構（Fabric）已原生支援，無須調用以避免警告
const isFabric = typeof globalThis !== 'undefined' && 'nativeFabricUIManager' in globalThis;
if (Platform.OS === 'android' && !isFabric && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Android 專屬鍵盤底部避讓 Inset Hook
 * 解決 React Native 原生 <Modal> 在 Android 上為獨立 Dialog Window，無法繼承主 Activity adjustResize 的問題
 */
export function useKeyboardBottomInset(): number {
  const [bottomInset, setBottomInset] = useState(0);

  useEffect(() => {
    // 依雙軌定案原則：iOS 維持 KeyboardAvoidingView('padding')，僅 Android 需此動態補償
    if (Platform.OS !== 'android') {
      return;
    }

    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      try {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      } catch {
        // Fallback safely if animation fails
      }
      setBottomInset(e.endCoordinates.height);
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      try {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      } catch {
        // Fallback safely
      }
      setBottomInset(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return bottomInset;
}
