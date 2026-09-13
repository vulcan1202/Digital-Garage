import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  useVehiclePhotos,
  useSetCoverPhoto,
  useDeleteVehiclePhoto,
} from '../../hooks/queries/useVehicles';
import { queryKeys } from '../../hooks/queries/queryKeys';
import { storageService } from '../../services/storageService';
import { vehicleService } from '../../services/vehicleService';
import {
  pickImagesFromLibrary,
  takePhotoWithCamera,
} from '../../utils/imageOptimizer';
import { ImageViewerModal } from './ImageViewerModal';

interface VehiclePhotoGalleryModalProps {
  visible: boolean;
  onClose: () => void;
  vehicleId: number;
  vehicleName?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = (SCREEN_WIDTH - 48) / 3;

export const VehiclePhotoGalleryModal: React.FC<VehiclePhotoGalleryModalProps> = ({
  visible,
  onClose,
  vehicleId,
  vehicleName = '車輛相簿',
}) => {
  const { data: photos = [], isLoading, refetch } = useVehiclePhotos(vehicleId);
  const queryClient = useQueryClient();
  const setCoverMutation = useSetCoverPhoto();
  const deletePhotoMutation = useDeleteVehiclePhoto();

  const [isUploading, setIsUploading] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // 處理上傳新照片
  const handleUploadPhotos = async (source: 'camera' | 'library') => {
    try {
      let localUris: string[] = [];

      if (source === 'camera') {
        const photo = await takePhotoWithCamera();
        if (photo) localUris.push(photo.uri);
      } else {
        const list = await pickImagesFromLibrary({ allowsMultipleSelection: true, selectionLimit: 10 });
        localUris = list.map((item) => item.uri);
      }

      if (localUris.length === 0) return;

      setIsUploading(true);
      for (const uri of localUris) {
        // 1. 上傳至 Supabase Storage
        const uploadResult = await storageService.uploadLocalUri(vehicleId, 'covers', uri);
        // 2. 寫入 VehiclePhotos (若目前無任何照片，自動設為封面)
        const isFirstPhoto = photos.length === 0 && localUris.indexOf(uri) === 0;
        await vehicleService.addVehiclePhoto(vehicleId, uploadResult.publicUrl, isFirstPhoto);
      }

      await refetch();
      // 同步刷新車輛列表與該車輛快取，確保車庫主畫面封面圖即時更新
      await queryClient.invalidateQueries({ queryKey: queryKeys.vehicles });
      await queryClient.invalidateQueries({ queryKey: queryKeys.vehicle(vehicleId) });
    } catch (err: any) {
      Alert.alert('上傳失敗', err?.message || '相片上傳發生錯誤');
    } finally {
      setIsUploading(false);
    }
  };

  // 處理設定封面
  const handleSetCover = (photoId: number) => {
    setCoverMutation.mutate(
      { vehicleId, photoId },
      {
        onSuccess: () => {
          refetch();
          Alert.alert('成功', '已更新為愛車封面照');
        },
        onError: (err) => {
          Alert.alert('設定失敗', err.message);
        },
      }
    );
  };

  // 處理刪除照片 (含確認提示與自動轉移封面)
  const handleDeletePhoto = (photoId: number, isCover: boolean) => {
    Alert.alert(
      '刪除相片',
      isCover
        ? '此張為當前封面照。刪除後系統將自動將下一張照片設定為新封面，確定要刪除嗎？'
        : '確定要刪除這張相片嗎？此操作無法復原。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '確認刪除',
          style: 'destructive',
          onPress: () => {
            deletePhotoMutation.mutate(
              { photoId, vehicleId },
              {
                onSuccess: () => {
                  refetch();
                  if (viewerIndex !== null) setViewerIndex(null);
                },
                onError: (err) => {
                  Alert.alert('刪除失敗', err.message);
                },
              }
            );
          },
        },
      ]
    );
  };

  const viewerImages = photos.map((p) => ({
    uri: p.url,
    isCover: p.is_cover,
    title: p.is_cover ? '★ 目前愛車封面' : undefined,
  }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/80 justify-end">
        <View className="bg-garage-card rounded-t-3xl border-t border-white/10 max-h-[85%] pb-8">
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 pt-5 pb-3 border-b border-white/10">
            <View>
              <Text className="text-white text-lg font-bold font-sans">{vehicleName}</Text>
              <Text className="text-gray-400 text-xs mt-0.5">
                共 {photos.length} 張照片，點選可檢視大圖或設為封面
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="w-9 h-9 rounded-full bg-white/10 items-center justify-center active:bg-white/20"
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* 新增操作按鈕列 */}
          <View className="flex-row items-center px-5 py-3 border-b border-white/5 space-x-3">
            <TouchableOpacity
              onPress={() => handleUploadPhotos('camera')}
              disabled={isUploading}
              className="flex-1 py-2.5 px-3 rounded-xl bg-racing-orange/15 border border-racing-orange/40 flex-row items-center justify-center active:bg-racing-orange/25"
            >
              <Ionicons name="camera" size={16} color="#FF6B00" />
              <Text className="text-racing-orange font-bold text-xs ml-1.5">拍照上傳</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleUploadPhotos('library')}
              disabled={isUploading}
              className="flex-1 py-2.5 px-3 rounded-xl bg-white/10 border border-white/15 flex-row items-center justify-center active:bg-white/15"
            >
              <Ionicons name="images" size={16} color="#FFFFFF" />
              <Text className="text-white font-bold text-xs ml-1.5">從相簿選取</Text>
            </TouchableOpacity>
          </View>

          {/* 上傳進度指示器 */}
          {isUploading && (
            <View className="flex-row items-center justify-center py-2 bg-racing-orange/10 border-b border-racing-orange/20">
              <ActivityIndicator size="small" color="#FF6B00" />
              <Text className="text-racing-orange text-xs font-bold ml-2 font-mono">
                壓縮與上傳相片中...
              </Text>
            </View>
          )}

          {/* 照片網格列表 */}
          {isLoading ? (
            <View className="py-20 items-center justify-center">
              <ActivityIndicator size="large" color="#FF6B00" />
              <Text className="text-gray-400 text-xs mt-3">載入照片中...</Text>
            </View>
          ) : photos.length === 0 ? (
            <View className="py-16 items-center justify-center px-6">
              <Ionicons name="images-outline" size={48} color="#4B5563" />
              <Text className="text-gray-400 text-sm font-bold mt-3">尚無愛車照片</Text>
              <Text className="text-gray-500 text-xs text-center mt-1">
                立即拍照或上傳相簿照片，為您的愛車建立第一張帥氣封面！
              </Text>
            </View>
          ) : (
            <FlatList
              data={photos}
              keyExtractor={(item) => item.id.toString()}
              numColumns={3}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item, index }) => (
                <View
                  style={{ width: COLUMN_WIDTH, height: COLUMN_WIDTH }}
                  className="p-1 relative"
                >
                  <TouchableOpacity
                    onPress={() => setViewerIndex(index)}
                    activeOpacity={0.85}
                    className="w-full h-full rounded-xl overflow-hidden border border-white/10 bg-black/40 relative"
                  >
                    <Image
                      source={{ uri: item.url }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />

                    {/* 封面 Badge 標記 */}
                    {item.is_cover ? (
                      <View className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-racing-orange border border-racing-orange/80 flex-row items-center shadow-lg">
                        <Ionicons name="star" size={10} color="#FFFFFF" />
                        <Text className="text-white text-[9px] font-bold ml-0.5">封面</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleSetCover(item.id)}
                        className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 border border-white/20 active:bg-racing-orange/80"
                      >
                        <Text className="text-gray-300 text-[9px]">設封面</Text>
                      </TouchableOpacity>
                    )}

                    {/* 刪除按鈕 */}
                    <TouchableOpacity
                      onPress={() => handleDeletePhoto(item.id, item.is_cover)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 border border-racing-red/50 items-center justify-center active:bg-racing-red"
                    >
                      <Ionicons name="trash-outline" size={12} color="#FF4D4D" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      </View>

      {/* 全螢幕大圖輪播預覽 */}
      {viewerIndex !== null && (
        <ImageViewerModal
          visible={viewerIndex !== null}
          onClose={() => setViewerIndex(null)}
          images={viewerImages}
          initialIndex={viewerIndex}
          onSetCover={(idx) => handleSetCover(photos[idx].id)}
          onDeletePhoto={(idx) => handleDeletePhoto(photos[idx].id, photos[idx].is_cover)}
        />
      )}
    </Modal>
  );
};
