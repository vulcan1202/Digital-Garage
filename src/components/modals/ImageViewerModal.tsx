import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ImageViewerModalProps {
  visible: boolean;
  onClose: () => void;
  images: Array<{ uri: string; title?: string; isCover?: boolean }>;
  initialIndex?: number;
  onDeletePhoto?: (index: number) => void;
  onSetCover?: (index: number) => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  visible,
  onClose,
  images,
  initialIndex = 0,
  onDeletePhoto,
  onSetCover,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // 當 modal 彈出時重置 index
  React.useEffect(() => {
    if (visible) {
      setCurrentIndex(Math.min(initialIndex, Math.max(0, images.length - 1)));
    }
  }, [visible, initialIndex, images.length]);

  if (!visible || images.length === 0) return null;

  const currentItem = images[currentIndex] || images[0];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View className="flex-1 bg-black">
        <SafeAreaView className="flex-1">
          {/* Header 導覽列 */}
          <View className="flex-row items-center justify-between px-4 py-3 bg-black/80 z-10 border-b border-white/10">
            <TouchableOpacity
              onPress={onClose}
              className="w-10 h-10 rounded-full bg-white/10 items-center justify-center active:bg-white/20"
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <View className="items-center">
              <Text className="text-white font-mono font-bold text-sm tracking-widest">
                {currentIndex + 1} / {images.length}
              </Text>
              {currentItem.isCover && (
                <View className="flex-row items-center mt-0.5 px-2 py-0.5 rounded bg-racing-orange/20 border border-racing-orange/40">
                  <Ionicons name="star" size={10} color="#FF6B00" />
                  <Text className="text-[10px] text-racing-orange font-bold ml-1">封面照</Text>
                </View>
              )}
            </View>

            {/* 功能選單 (設封面 / 刪除) */}
            <View className="flex-row items-center space-x-2">
              {onSetCover && !currentItem.isCover && (
                <TouchableOpacity
                  onPress={() => onSetCover(currentIndex)}
                  className="px-2.5 py-1.5 rounded-lg bg-racing-orange/20 border border-racing-orange/40 flex-row items-center active:bg-racing-orange/30"
                >
                  <Ionicons name="star-outline" size={14} color="#FF6B00" />
                  <Text className="text-racing-orange text-xs font-bold ml-1">設為封面</Text>
                </TouchableOpacity>
              )}
              {onDeletePhoto && (
                <TouchableOpacity
                  onPress={() => onDeletePhoto(currentIndex)}
                  className="w-10 h-10 rounded-full bg-racing-red/20 border border-racing-red/40 items-center justify-center active:bg-racing-red/30 ml-2"
                >
                  <Ionicons name="trash-outline" size={18} color="#FF4D4D" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 大圖輪播列表 */}
          <FlatList
            data={images}
            keyExtractor={(_, idx) => idx.toString()}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={Math.min(initialIndex, Math.max(0, images.length - 1))}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            onMomentumScrollEnd={(e) => {
              const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              if (newIndex >= 0 && newIndex < images.length) {
                setCurrentIndex(newIndex);
              }
            }}
            renderItem={({ item }) => (
              <View
                style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.75 }}
                className="items-center justify-center"
              >
                <Image
                  source={{ uri: item.uri }}
                  style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.75 }}
                  resizeMode="contain"
                />
              </View>
            )}
          />

          {/* 底部說明文字 (若有) */}
          {currentItem.title && (
            <View className="px-6 py-4 bg-black/80 border-t border-white/10">
              <Text className="text-gray-300 text-sm font-sans text-center">
                {currentItem.title}
              </Text>
            </View>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
};
