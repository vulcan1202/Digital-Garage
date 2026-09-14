import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { DoubleBezelCard } from '../DoubleBezelCard';
import { MaintenanceRecordRow, ModificationRow, VehiclePhotoRow } from '../../types/database';

interface PhotosHubTabProps {
  vehiclePhotos: VehiclePhotoRow[];
  maintenanceRecords: MaintenanceRecordRow[];
  modifications: ModificationRow[];
  onOpenVehicleGallery: () => void;
  onPreviewImages: (images: { uri: string; title: string }[]) => void;
  onNavigateToModDetail: (modId: number) => void;
}

export const PhotosHubTab: React.FC<PhotosHubTabProps> = ({
  vehiclePhotos,
  maintenanceRecords,
  modifications,
  onOpenVehicleGallery,
  onPreviewImages,
  onNavigateToModDetail,
}) => {
  // 從 maintenanceRecords 中取出所有嵌套 photos
  const maintenancePhotosFlat: { photo: any; record: MaintenanceRecordRow }[] = [];
  maintenanceRecords.forEach((record) => {
    const photos = (record as any).photos || [];
    photos.forEach((p: any) => {
      maintenancePhotosFlat.push({ photo: p, record });
    });
  });

  return (
    <View className="gap-6">
      {/* 區塊 1: 車輛相簿 (Vehicle Photos) */}
      <View>
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <Ionicons name="car-sport-outline" size={16} color="#ff4d00" />
            <Text className="text-xs font-mono tracking-wider text-white uppercase font-bold">
              車輛寫真與相簿 (VEHICLE ALBUM)
            </Text>
            <View className="bg-racing-orange/20 px-2 py-0.5 rounded-full border border-racing-orange/40">
              <Text className="text-[10px] font-mono text-racing-orange font-bold">
                {vehiclePhotos.length}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={onOpenVehicleGallery}
            className="flex-row items-center bg-racing-orange/15 px-2.5 py-1 rounded-full border border-racing-orange/30"
          >
            <Ionicons name="images-outline" size={12} color="#ff6b00" />
            <Text className="text-[11px] font-mono text-racing-orange font-bold ml-1">
              管理相簿
            </Text>
          </TouchableOpacity>
        </View>

        {vehiclePhotos.length === 0 ? (
          <DoubleBezelCard innerClassName="py-6 items-center">
            <Ionicons name="images-outline" size={32} color="#52525b" />
            <Text className="text-metal-400 text-xs mt-2 font-mono">
              尚未上傳任何車輛照片，點擊「管理相簿」新增寫真
            </Text>
          </DoubleBezelCard>
        ) : (
          <View className="flex-row flex-wrap gap-2">
            {vehiclePhotos.map((vp) => (
              <TouchableOpacity
                key={vp.id}
                onPress={() => {
                  const imgs = vehiclePhotos.map((item) => ({
                    uri: item.url,
                    title: item.is_cover ? '車輛封面照片' : '車輛寫真',
                  }));
                  onPreviewImages(imgs);
                }}
                className="w-[31%] h-24 rounded-xl overflow-hidden border border-white/15 relative bg-zinc-900"
              >
                <Image source={{ uri: vp.url }} className="w-full h-full" resizeMode="cover" />
                {vp.is_cover && (
                  <View className="absolute top-1 left-1 bg-racing-orange px-1.5 py-0.5 rounded shadow">
                    <Text className="text-[9px] font-mono font-bold text-black">COVER</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* 區塊 2: 保修工單實體相片 (Maintenance Photos) */}
      <View>
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <Ionicons name="construct-outline" size={16} color="#ff6b00" />
            <Text className="text-xs font-mono tracking-wider text-white uppercase font-bold">
              保修工單相片 (MAINTENANCE PHOTOS)
            </Text>
            <View className="bg-racing-orange/20 px-2 py-0.5 rounded-full border border-racing-orange/40">
              <Text className="text-[10px] font-mono text-racing-orange font-bold">
                {maintenancePhotosFlat.length}
              </Text>
            </View>
          </View>
        </View>

        {maintenancePhotosFlat.length === 0 ? (
          <DoubleBezelCard innerClassName="py-6 items-center">
            <Ionicons name="camera-outline" size={32} color="#52525b" />
            <Text className="text-metal-400 text-xs mt-2 font-mono">
              尚無任何保養或維修實拍照
            </Text>
          </DoubleBezelCard>
        ) : (
          <View className="flex-row flex-wrap gap-2">
            {maintenancePhotosFlat.map(({ photo, record }) => (
              <TouchableOpacity
                key={photo.id}
                onPress={() => {
                  const imgs = maintenancePhotosFlat.map((item) => ({
                    uri: item.photo.url,
                    title: `${item.record.item_name} · ${item.record.service_date}`,
                  }));
                  onPreviewImages(imgs);
                }}
                className="w-[31%] h-24 rounded-xl overflow-hidden border border-white/15 relative bg-zinc-900"
              >
                <Image source={{ uri: photo.url }} className="w-full h-full" resizeMode="cover" />
                <View className="absolute bottom-0 inset-x-0 bg-black/75 p-1">
                  <Text className="text-[9px] text-white font-mono truncate" numberOfLines={1}>
                    {record.item_name}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* 區塊 3: 改裝套件專屬相片與調校導覽 (Modifications Photos Navigation) */}
      <View>
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <MaterialCommunityIcons name="car-wrench" size={16} color="#c084fc" />
            <Text className="text-xs font-mono tracking-wider text-white uppercase font-bold">
              改裝套件實拍與調校 (MODIFICATION PARTS)
            </Text>
            <View className="bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/40">
              <Text className="text-[10px] font-mono text-purple-300 font-bold">
                {modifications.length}
              </Text>
            </View>
          </View>
        </View>

        {modifications.length === 0 ? (
          <DoubleBezelCard innerClassName="py-6 items-center">
            <MaterialCommunityIcons name="car-wrench" size={32} color="#52525b" />
            <Text className="text-metal-400 text-xs mt-2 font-mono">
              尚未登錄任何改裝品套件
            </Text>
          </DoubleBezelCard>
        ) : (
          <View className="gap-2">
            {modifications.map((mod) => (
              <TouchableOpacity
                key={mod.id}
                onPress={() => onNavigateToModDetail(mod.id)}
                className="p-3 rounded-xl border border-white/10 bg-white/[0.02] flex-row items-center justify-between"
              >
                <View className="flex-1 mr-3">
                  <View className="flex-row items-center gap-2 mb-1">
                    <View className="px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/30">
                      <Text className="text-[9px] font-mono text-purple-400 font-bold uppercase">
                        {mod.category}
                      </Text>
                    </View>
                    {mod.brand ? (
                      <Text className="text-[11px] text-metal-400 font-mono">
                        {mod.brand}
                      </Text>
                    ) : null}
                  </View>
                  <Text className="text-white font-semibold text-sm">
                    {mod.item_name}
                  </Text>
                </View>

                <View className="flex-row items-center gap-1.5 bg-purple-500/15 px-2.5 py-1.5 rounded-lg border border-purple-500/30">
                  <MaterialCommunityIcons name="tune-vertical" size={13} color="#c084fc" />
                  <Text className="text-[10px] font-mono text-purple-300 font-bold">
                    檢視實拍與調校
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};
