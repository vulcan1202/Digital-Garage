import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  pickImagesFromLibrary,
  takePhotoWithCamera,
  OptimizedImageResult,
} from '../utils/imageOptimizer';

export interface SelectedPhoto {
  uri: string;
  width?: number;
  height?: number;
}

interface PhotoPickerSectionProps {
  photos: SelectedPhoto[];
  onChangePhotos: (photos: SelectedPhoto[]) => void;
  maxPhotos?: number;
  title?: string;
  subtitle?: string;
  allowCamera?: boolean;
  allowGallery?: boolean;
}

/**
 * 模組化相片選取器 (支援相機拍攝、相簿多選、本機壓縮、暫存預覽與刪除)
 */
export const PhotoPickerSection: React.FC<PhotoPickerSectionProps> = ({
  photos,
  onChangePhotos,
  maxPhotos = 5,
  title = '相片附件',
  subtitle = '上傳清晰工單或實物照片（自動等比壓縮最佳化）',
  allowCamera = true,
  allowGallery = true,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePickLibrary = async () => {
    if (photos.length >= maxPhotos) {
      Alert.alert('已達上限', `最多僅能上傳 ${maxPhotos} 張相片`);
      return;
    }

    try {
      setIsProcessing(true);
      const remainingSlots = maxPhotos - photos.length;
      const selected = await pickImagesFromLibrary({
        allowsMultipleSelection: remainingSlots > 1,
        selectionLimit: remainingSlots,
      });

      if (selected.length > 0) {
        onChangePhotos([...photos, ...selected]);
      }
    } catch (error: any) {
      Alert.alert('選取失敗', error?.message || '無法取得相片');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTakePhoto = async () => {
    if (photos.length >= maxPhotos) {
      Alert.alert('已達上限', `最多僅能上傳 ${maxPhotos} 張相片`);
      return;
    }

    try {
      setIsProcessing(true);
      const photo = await takePhotoWithCamera();
      if (photo) {
        onChangePhotos([...photos, photo]);
      }
    } catch (error: any) {
      Alert.alert('拍照失敗', error?.message || '無法拍攝相片');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    const updated = [...photos];
    updated.splice(index, 1);
    onChangePhotos(updated);
  };

  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-gray-300 text-xs font-bold tracking-wider uppercase">
          {title} ({photos.length}/{maxPhotos})
        </Text>
        {isProcessing && (
          <View className="flex-row items-center">
            <ActivityIndicator size="small" color="#FF6B00" />
            <Text className="text-racing-orange text-xs ml-1 font-mono">處理中...</Text>
          </View>
        )}
      </View>
      <Text className="text-gray-500 text-[11px] mb-2.5">{subtitle}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-1">
        {/* 操作按鈕 (拍照 / 相簿) */}
        {photos.length < maxPhotos && (
          <View className="flex-row space-x-2 mr-2">
            {allowCamera && (
              <TouchableOpacity
                onPress={handleTakePhoto}
                disabled={isProcessing}
                className="w-20 h-20 rounded-xl border border-dashed border-white/20 bg-white/[0.03] items-center justify-center active:bg-white/[0.08]"
              >
                <Ionicons name="camera-outline" size={22} color="#9CA3AF" />
                <Text className="text-gray-400 text-[10px] mt-1 font-bold">拍照</Text>
              </TouchableOpacity>
            )}

            {allowGallery && (
              <TouchableOpacity
                onPress={handlePickLibrary}
                disabled={isProcessing}
                className="w-20 h-20 rounded-xl border border-dashed border-white/20 bg-white/[0.03] items-center justify-center active:bg-white/[0.08]"
              >
                <Ionicons name="images-outline" size={22} color="#9CA3AF" />
                <Text className="text-gray-400 text-[10px] mt-1 font-bold">相簿</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 已選相片預覽列表 */}
        {photos.map((item, index) => (
          <View
            key={index}
            className="w-20 h-20 rounded-xl overflow-hidden mr-2.5 relative border border-white/10 bg-black/40"
          >
            <Image
              source={{ uri: item.uri }}
              className="w-full h-full"
              resizeMode="cover"
            />
            {/* 標記第 1 張 (若為封面用途) */}
            {index === 0 && (
              <View className="absolute bottom-0 inset-x-0 bg-black/70 py-0.5 items-center">
                <Text className="text-[9px] text-racing-orange font-bold">首張</Text>
              </View>
            )}
            {/* 移除按鈕 */}
            <TouchableOpacity
              onPress={() => handleRemovePhoto(index)}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/80 items-center justify-center border border-white/20"
            >
              <Ionicons name="close" size={12} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};
