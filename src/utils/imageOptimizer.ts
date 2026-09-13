import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Alert, Linking } from 'react-native';

export interface OptimizedImageResult {
  uri: string;
  width: number;
  height: number;
}

export interface PickImageOptions {
  allowsMultipleSelection?: boolean;
  selectionLimit?: number;
}

/**
 * 檢查並要求相機權限，若遭拒絕則提示使用者前往系統設定
 */
export async function requestCameraPermission(): Promise<boolean> {
  const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
  if (status === ImagePicker.PermissionStatus.GRANTED) {
    return true;
  }

  if (!canAskAgain) {
    Alert.alert(
      '需要相機權限',
      '請至系統設定中開啟數位車庫的相機權限，以拍攝愛車或工單照片。',
      [
        { text: '取消', style: 'cancel' },
        { text: '前往設定', onPress: () => Linking.openSettings() },
      ]
    );
  } else {
    Alert.alert('權限不足', '無法開啟相機，請允許相機存取權限。');
  }
  return false;
}

/**
 * 檢查並要求相簿權限，若遭拒絕則提示使用者前往系統設定
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status === ImagePicker.PermissionStatus.GRANTED) {
    return true;
  }

  if (!canAskAgain) {
    Alert.alert(
      '需要相簿權限',
      '請至系統設定中開啟數位車庫的相簿權限，以選取愛車或工單照片。',
      [
        { text: '取消', style: 'cancel' },
        { text: '前往設定', onPress: () => Linking.openSettings() },
      ]
    );
  } else {
    Alert.alert('權限不足', '無法開啟相簿，請允許相簿存取權限。');
  }
  return false;
}

/**
 * 客戶端圖片尺寸與品質最佳化
 * 規範：
 * 1. 採用 Expo SDK 57 / 現代鏈式 API: ImageManipulator.manipulate(uri) -> context.resize() -> context.renderAsync() -> image.saveAsync()
 * 2. 嚴禁使用已標記為 Deprecated 之 manipulateAsync()
 * 3. 限制最大邊長 (寬或高) 不超過 1920px (等比例縮放)
 * 4. 輸出格式為 JPEG，壓縮品質 0.8
 */
export async function optimizeImage(
  uri: string,
  originalWidth?: number,
  originalHeight?: number
): Promise<OptimizedImageResult> {
  // 1. 建立操作 Context
  const context = ImageManipulator.manipulate(uri);

  // 2. 若長或寬超過 1920px，等比例縮小最長邊至 1920px
  const maxDimension = 1920;
  if (originalWidth && originalHeight) {
    if (originalWidth > maxDimension || originalHeight > maxDimension) {
      if (originalWidth >= originalHeight) {
        context.resize({ width: maxDimension });
      } else {
        context.resize({ height: maxDimension });
      }
    }
  } else {
    // 若無預先傳入長寬，統一指定寬度上限 1920 (auto 比例)
    context.resize({ width: maxDimension });
  }

  // 3. 渲染並儲存壓縮結果
  const renderedImage = await context.renderAsync();
  const result = await renderedImage.saveAsync({
    compress: 0.8,
    format: SaveFormat.JPEG,
  });

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
  };
}

/**
 * 啟動相簿選取照片 (支援單張 / 多張) 並自動執行壓縮最佳化
 */
export async function pickImagesFromLibrary(
  options: PickImageOptions = {}
): Promise<OptimizedImageResult[]> {
  const hasPermission = await requestMediaLibraryPermission();
  if (!hasPermission) return [];

  const pickerResult = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: options.allowsMultipleSelection ?? false,
    selectionLimit: options.selectionLimit ?? 5,
    quality: 1, // 先以最高品質取得，再由 ImageManipulator 精準縮放與 0.8 壓縮
  });

  if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
    return [];
  }

  const results: OptimizedImageResult[] = [];
  for (const asset of pickerResult.assets) {
    const optimized = await optimizeImage(asset.uri, asset.width, asset.height);
    results.push(optimized);
  }

  return results;
}

/**
 * 啟動相機拍攝照片並自動執行壓縮最佳化
 */
export async function takePhotoWithCamera(): Promise<OptimizedImageResult | null> {
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) return null;

  const pickerResult = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,
  });

  if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
    return null;
  }

  const asset = pickerResult.assets[0];
  return await optimizeImage(asset.uri, asset.width, asset.height);
}
