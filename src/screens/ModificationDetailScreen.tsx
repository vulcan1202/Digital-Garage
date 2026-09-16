import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { DoubleBezelCard } from '../components/DoubleBezelCard';
import {
  useModificationDetail,
  useSetCurrentSettingSet,
  useDeleteModification,
  useAddModificationPhotos,
  useDeleteModificationPhoto,
  useDeleteSettingSet,
  useCloneSettingSet,
} from '../hooks/queries/useModifications';
import { AppError } from '../services/errors/AppError';
import { AddSettingSetModal } from '../components/modals/AddSettingSetModal';
import { EditSettingSetModal } from '../components/modals/EditSettingSetModal';
import { CompareSettingSetsModal } from '../components/modals/CompareSettingSetsModal';
import { ImageViewerModal } from '../components/modals/ImageViewerModal';
import { storageService } from '../services/storageService';
import { pickImagesFromLibrary, takePhotoWithCamera } from '../utils/imageOptimizer';

interface ModificationDetailScreenProps {
  modificationId: number;
  onBack: () => void;
}

export const ModificationDetailScreen: React.FC<ModificationDetailScreenProps> = ({
  modificationId,
  onBack,
}) => {
  const { data: mod, isLoading, error } = useModificationDetail(modificationId);
  const setCurrentMutation = useSetCurrentMutationWrapper();
  const deleteModMutation = useDeleteModification();
  const deleteSettingSetMutation = useDeleteSettingSet();
  const cloneSettingSetMutation = useCloneSettingSet();

  // 目前選取要查看參數的設定組 ID (若未手動選取，優先顯示 is_current = true 的版本)
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null);
  const [isAddSetModalOpen, setIsAddSetModalOpen] = useState(false);
  const [isEditSetModalOpen, setIsEditSetModalOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  // 改裝套件相片預覽與上傳狀態
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);

  const addPhotosMutation = useAddModificationPhotos();
  const deletePhotoMutation = useDeleteModificationPhoto();

  const handleUploadPhoto = async (source: 'camera' | 'library') => {
    if (!mod) return;
    try {
      let localUris: string[] = [];
      if (source === 'camera') {
        const p = await takePhotoWithCamera();
        if (p) localUris.push(p.uri);
      } else {
        const list = await pickImagesFromLibrary({ allowsMultipleSelection: true, selectionLimit: 5 });
        localUris = list.map((i) => i.uri);
      }

      if (localUris.length === 0) return;

      setIsUploadingPhotos(true);
      const photoPayload: Array<{ url: string; photo_type?: string }> = [];
      for (const uri of localUris) {
        try {
          const res = await storageService.uploadLocalUri(mod.vehicle_id, 'modifications', uri);
          photoPayload.push({ url: res.publicUrl });
        } catch (upErr) {
          console.warn('上傳改裝品相片失敗:', upErr);
        }
      }

      if (photoPayload.length > 0) {
        await addPhotosMutation.mutateAsync({
          modificationId: mod.id,
          photos: photoPayload,
        });
        Alert.alert('上傳成功', `已成功新增 ${photoPayload.length} 張改裝相片！`);
      }
    } catch (err: any) {
      Alert.alert('上傳失敗', err?.message || '相片處理發生錯誤');
    } finally {
      setIsUploadingPhotos(false);
    }
  };

  const handleDeletePhoto = (photoId: number) => {
    if (!mod) return;
    Alert.alert('刪除相片', '確定要刪除這張改裝相片嗎？此操作無法復原。', [
      { text: '取消', style: 'cancel' },
      {
        text: '確定刪除',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePhotoMutation.mutateAsync({
              photoId,
              modificationId: mod.id,
            });
            if (viewerIndex !== null) setViewerIndex(null);
          } catch (err: any) {
            Alert.alert('刪除失敗', err?.message || '刪除照片失敗');
          }
        },
      },
    ]);
  };


  const handleDeleteSettingSet = (setId: number, setName: string, isCurrent: boolean) => {
    if (!mod) return;
    const confirmMessage = isCurrent
      ? `版本「${setName}」為目前生效中的版本。刪除後系統將自動將剩餘最新版本設為生效中，確定刪除嗎？`
      : `確定要刪除調校版本「${setName}」嗎？此操作無法復原。`;

    Alert.alert('刪除調校版本', confirmMessage, [
      { text: '取消', style: 'cancel' },
      {
        text: '確定刪除',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSettingSetMutation.mutateAsync({
              modificationId: mod.id,
              setId,
            });
            if (selectedSetId === setId) {
              setSelectedSetId(null);
            }
            Alert.alert('刪除成功', `版本「${setName}」已成功移除。`);
          } catch (err: any) {
            Alert.alert('刪除失敗', err?.message || '刪除調校版本失敗');
          }
        },
      },
    ]);
  };

  const handleCloneSettingSet = async (setId: number, setName: string) => {
    if (!mod) return;
    try {
      const cloned = await cloneSettingSetMutation.mutateAsync({
        modificationId: mod.id,
        setId,
      });
      setSelectedSetId(cloned.id);
      Alert.alert('複製成功', `已成功建立「${cloned.name}」獨立 Snapshot 副本！`);
    } catch (err: any) {
      Alert.alert('複製失敗', err?.message || '複製調校版本失敗');
    }
  };

  // 切換使用中版本之包裝處理 (具備 23505 唯一約束衝突提示)
  function useSetCurrentMutationWrapper() {
    const mutation = useSetCurrentSettingSet();
    return {
      ...mutation,
      switchCurrent: async (modId: number, targetSetId: number) => {
        try {
          await mutation.mutateAsync({
            modificationId: modId,
            setId: targetSetId,
          });
          Alert.alert('設定啟用成功', '已切換為目前生效之調校參數版本。');
        } catch (err) {
          const appErr = AppError.fromSupabaseError(err);
          if (appErr.code === 'CONFLICT') {
            Alert.alert('設定衝突', '同一時間僅能有一組設定處於生效狀態，請重新整理後再試。');
          } else {
            Alert.alert('操作失敗', appErr.message);
          }
        }
      },
    };
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-garage-bg items-center justify-center">
        <ActivityIndicator size="large" color="#ff6b00" />
        <Text className="text-metal-400 text-xs font-mono mt-3 uppercase tracking-widest">
          Loading Tuning Telemetry...
        </Text>
      </View>
    );
  }

  if (error || !mod) {
    return (
      <View className="flex-1 bg-garage-bg items-center justify-center px-6">
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text className="text-white text-base font-bold mt-3">無法讀取改裝品調校資料</Text>
        <Text className="text-metal-400 text-xs text-center mt-1">
          {error ? (error as Error).message : '查無此改裝品'}
        </Text>
        <TouchableOpacity
          onPress={onBack}
          className="mt-6 px-6 py-2.5 rounded-full bg-white/10 border border-white/20"
        >
          <Text className="text-white font-mono text-xs">返回上一頁</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 確定目前生效中的設定組與用戶正在檢視的設定組
  const currentActiveSet = mod.setting_sets.find((s) => s.is_current);
  const viewingSet = selectedSetId
    ? mod.setting_sets.find((s) => s.id === selectedSetId) || currentActiveSet || mod.setting_sets[0]
    : currentActiveSet || mod.setting_sets[0];

  return (
    <ScrollView className="flex-1 bg-garage-bg" contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View className="pt-14 px-5 pb-4 flex-row items-center justify-between border-b border-white/[0.06]">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={onBack}
            className="w-9 h-9 rounded-full bg-white/[0.06] items-center justify-center mr-3 border border-white/10"
          >
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text className="text-[10px] font-mono tracking-[0.2em] text-racing-orange uppercase font-bold">
              MODIFICATION & TUNING
            </Text>
            <Text className="text-xl font-bold text-white tracking-tight" numberOfLines={1}>
              {mod.item_name}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          <View className="px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30">
            <Text className="text-[10px] font-mono text-purple-400 uppercase font-bold">
              {mod.category}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                '確認移除改裝品？',
                `此操作將永久刪除「${mod.item_name}」及其所有調校設定與通用參數（SQL 級聯刪除），無法還原！`,
                [
                  { text: '取消', style: 'cancel' },
                  {
                    text: '確認刪除',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await deleteModMutation.mutateAsync({
                          id: mod.id,
                          vehicleId: mod.vehicle_id,
                        });
                        Alert.alert('已刪除', '改裝品已自車庫中移除。');
                        onBack();
                      } catch (err: unknown) {
                        const msg = err instanceof Error ? err.message : '刪除失敗';
                        Alert.alert('刪除失敗', msg);
                      }
                    },
                  },
                ]
              );
            }}
            className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 items-center justify-center"
          >
            <Ionicons name="trash-outline" size={14} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>


      {/* 改裝品核心硬體規格與歷史重要日期 (DoubleBezelCard) */}
      <View className="px-5 mt-5">
        <DoubleBezelCard innerClassName="p-4">
          <Text className="text-[10px] font-mono tracking-wider text-metal-400 uppercase">
            HARDWARE SPECIFICATION
          </Text>
          <Text className="text-lg font-bold text-white mt-1">
            {mod.brand || '無品牌標示'} · {mod.model || '標準型號'}
          </Text>

          {mod.shop_name && (
            <View className="flex-row items-center mt-2">
              <Ionicons name="business-outline" size={13} color="#a1a1aa" />
              <Text className="text-xs text-metal-300 ml-1.5 font-mono">
                安裝改裝廠: {mod.shop_name}
              </Text>
            </View>
          )}

          {/* 鐵律嚴格呈現：清楚區分 install_date (安裝日) 與 recorded_date (調校參數記錄日) */}
          <View className="mt-4 pt-3 border-t border-white/[0.06] flex-row justify-between">
            <View className="flex-1">
              <Text className="text-[10px] font-mono text-metal-500 uppercase">
                INSTALL DATE (安裝日)
              </Text>
              <Text className="text-xs font-mono font-semibold text-racing-orange mt-0.5">
                {mod.install_date || '未記錄安裝日'}
              </Text>
              {mod.install_mileage !== null && (
                <Text className="text-[10px] font-mono text-metal-400 mt-0.5">
                  @{mod.install_mileage.toLocaleString()} KM
                </Text>
              )}
            </View>

            <View className="flex-1 border-l border-white/[0.06] pl-3">
              <Text className="text-[10px] font-mono text-metal-500 uppercase">
                PURCHASE (購買日/費用)
              </Text>
              <Text className="text-xs font-mono text-metal-200 mt-0.5">
                {mod.purchase_date || '--'}
              </Text>
              <Text className="text-[10px] font-mono text-metal-400 mt-0.5">
                料資 ${Number(mod.purchase_price).toLocaleString()} + 工資 ${Number(mod.install_price).toLocaleString()}
              </Text>
            </View>
          </View>

          {mod.note && (
            <View className="mt-3 pt-2.5 border-t border-white/[0.04]">
              <Text className="text-xs text-metal-400 leading-relaxed italic">
                "{mod.note}"
              </Text>
            </View>
          )}
        </DoubleBezelCard>
      </View>

      {/* 改裝套件實體相簿 (Photos Section) */}
      <View className="mt-6 px-5">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <Text className="text-xs font-mono tracking-wider text-metal-400 uppercase mr-2">
              MODIFICATION PHOTOS ({mod.photos.length})
            </Text>
            {isUploadingPhotos && (
              <View className="flex-row items-center bg-racing-orange/10 px-2 py-0.5 rounded border border-racing-orange/30">
                <ActivityIndicator size="small" color="#FF6B00" />
                <Text className="text-[10px] font-mono text-racing-orange font-bold ml-1">
                  上傳中...
                </Text>
              </View>
            )}
          </View>

          <View className="flex-row items-center space-x-2">
            <TouchableOpacity
              onPress={() => handleUploadPhoto('camera')}
              disabled={isUploadingPhotos}
              className="flex-row items-center bg-white/10 px-2.5 py-1 rounded-full border border-white/20 active:bg-white/20"
            >
              <Ionicons name="camera-outline" size={12} color="#fff" />
              <Text className="text-[10px] font-mono text-white font-bold ml-1">拍照</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleUploadPhoto('library')}
              disabled={isUploadingPhotos}
              className="flex-row items-center bg-purple-500/15 px-2.5 py-1 rounded-full border border-purple-500/30 active:bg-purple-500/25 ml-2"
            >
              <Ionicons name="images-outline" size={12} color="#c084fc" />
              <Text className="text-[10px] font-mono text-purple-300 font-bold ml-1">相簿</Text>
            </TouchableOpacity>
          </View>
        </View>

        {mod.photos.length === 0 ? (
          <DoubleBezelCard innerClassName="py-5 items-center">
            <Ionicons name="images-outline" size={28} color="#52525b" />
            <Text className="text-metal-400 text-xs mt-1.5 font-mono">
              尚未上傳此改裝品的開箱或安裝實照
            </Text>
            <TouchableOpacity
              onPress={() => handleUploadPhoto('library')}
              disabled={isUploadingPhotos}
              className="mt-2.5 px-3 py-1 bg-white/10 rounded-full border border-white/15"
            >
              <Text className="text-[11px] text-white font-bold">點此選取照片</Text>
            </TouchableOpacity>
          </DoubleBezelCard>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
            {mod.photos.map((photo, idx) => (
              <View key={photo.id} className="relative mr-2.5">
                <TouchableOpacity
                  onPress={() => setViewerIndex(idx)}
                  activeOpacity={0.85}
                  className="w-24 h-24 rounded-xl overflow-hidden border border-white/10 bg-black/40"
                >
                  <Image source={{ uri: photo.url }} className="w-full h-full" resizeMode="cover" />
                </TouchableOpacity>

                {/* 刪除照片按鈕 */}
                <TouchableOpacity
                  onPress={() => handleDeletePhoto(photo.id)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/80 items-center justify-center border border-white/20"
                >
                  <Ionicons name="trash-outline" size={11} color="#FF4D4D" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* 調校設定版本控制組 (ModificationSettingSets - Versioning) */}
      <View className="mt-6 px-5">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <Text className="text-xs font-mono tracking-wider text-metal-400 uppercase mr-2">
              TUNING SETS ({mod.setting_sets.length})
            </Text>
            <View className="bg-racing-blue/10 px-2 py-0.5 rounded border border-racing-blue/30">
              <Text className="text-[10px] font-mono text-racing-blue font-bold">
                VERSION CONTROL
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            {mod.setting_sets.length >= 2 && (
              <TouchableOpacity
                onPress={() => setIsCompareModalOpen(true)}
                className="flex-row items-center bg-racing-blue/15 px-2.5 py-1 rounded-full border border-racing-blue/30"
              >
                <Ionicons name="git-compare-outline" size={13} color="#007aff" />
                <Text className="text-[11px] font-mono text-racing-blue font-bold ml-1">
                  版本比較
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => setIsAddSetModalOpen(true)}
              className="flex-row items-center bg-racing-orange/15 px-2.5 py-1 rounded-full border border-racing-orange/30"
            >
              <Ionicons name="add" size={13} color="#ff6b00" />
              <Text className="text-[11px] font-mono text-racing-orange font-bold ml-1">
                新增版本
              </Text>
            </TouchableOpacity>
          </View>
        </View>


        {/* 版本卡片清單 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10 }}
        >
          {mod.setting_sets.map((set) => {
            const isViewing = viewingSet?.id === set.id;
            const isEffective = set.is_current;

            return (
              <TouchableOpacity
                key={set.id}
                onPress={() => setSelectedSetId(set.id)}
                activeOpacity={0.85}
              >
                <View
                  className={`w-52 p-3.5 rounded-xl border ${
                    isViewing
                      ? 'bg-zinc-800/80 border-racing-orange'
                      : 'bg-garage-card border-white/10'
                  }`}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-white font-bold text-sm" numberOfLines={1}>
                      {set.name}
                    </Text>
                    {isEffective ? (
                      <View className="bg-racing-green/20 px-2 py-0.5 rounded border border-racing-green/40">
                        <Text className="text-[9px] font-mono text-racing-green font-bold">
                          ACTIVE
                        </Text>
                      </View>
                    ) : (
                      <View className="bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/10">
                        <Text className="text-[9px] font-mono text-metal-500">
                          ARCHIVE
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text className="text-[10px] font-mono text-metal-400">
                    RECORDED: {set.recorded_date}
                  </Text>
                  {set.mileage !== null && (
                    <Text className="text-[10px] font-mono text-metal-500 mt-0.5">
                      MILEAGE: {set.mileage.toLocaleString()} KM
                    </Text>
                  )}

                  {set.note ? (
                    <Text className="text-[11px] text-metal-400 mt-2 line-clamp-1" numberOfLines={1}>
                      {set.note}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 選中設定組的通用參數表 (Generic ModificationSettings Table) */}
      {viewingSet ? (
        <View className="mt-6 px-5">
          <DoubleBezelCard innerClassName="p-4">
            <View className="flex-row items-center justify-between pb-3 border-b border-white/[0.08]">
              <View>
                <Text className="text-xs font-mono tracking-wider text-metal-400 uppercase">
                  ACTIVE PROFILE TELEMETRY
                </Text>
                <Text className="text-base font-bold text-white mt-0.5">
                  {viewingSet.name}
                </Text>
              </View>

              {/* 切換此組為生效版本按鈕 (Button-in-Button) */}
              {!viewingSet.is_current ? (
                <TouchableOpacity
                  onPress={() => setCurrentMutation.switchCurrent(mod.id, viewingSet.id)}
                  disabled={setCurrentMutation.isPending}
                  className="px-3.5 py-1.5 rounded-full bg-racing-orange flex-row items-center"
                >
                  <Text className="text-black font-bold text-xs font-mono mr-1">
                    {setCurrentMutation.isPending ? '套用中...' : '啟用此調校'}
                  </Text>
                  <View className="w-4 h-4 rounded-full bg-black/20 items-center justify-center">
                    <Ionicons name="checkmark" size={10} color="#000" />
                  </View>
                </TouchableOpacity>
              ) : (
                <View className="flex-row items-center bg-racing-green/15 px-3 py-1 rounded-full border border-racing-green/30">
                  <View className="w-1.5 h-1.5 rounded-full bg-racing-green mr-1.5" />
                  <Text className="text-racing-green text-xs font-mono font-bold">
                    目前生效中
                  </Text>
                </View>
              )}
            </View>

            {/* 通用調校參數動態條列 (Data-driven Table) */}
            <View className="mt-3">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-[10px] font-mono text-metal-500 tracking-wider uppercase">
                  PARAMETERS ({viewingSet.settings.length})
                </Text>

                {/* 版本動作按鈕群：編輯、複製、刪除 */}
                <View className="flex-row items-center gap-1.5">
                  <TouchableOpacity
                    onPress={() => setIsEditSetModalOpen(true)}
                    className="flex-row items-center bg-white/10 px-2 py-1 rounded-md border border-white/20"
                    activeOpacity={0.7}
                  >
                    <Ionicons name="pencil-outline" size={11} color="#fff" />
                    <Text className="text-[10px] font-mono text-white ml-1 font-semibold">
                      編輯
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleCloneSettingSet(viewingSet.id, viewingSet.name)}
                    disabled={cloneSettingSetMutation.isPending}
                    className="flex-row items-center bg-purple-500/15 px-2 py-1 rounded-md border border-purple-500/30"
                    activeOpacity={0.7}
                  >
                    <Ionicons name="copy-outline" size={11} color="#c084fc" />
                    <Text className="text-[10px] font-mono text-purple-300 ml-1 font-semibold">
                      {cloneSettingSetMutation.isPending ? '複製中...' : '複製'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleDeleteSettingSet(viewingSet.id, viewingSet.name, viewingSet.is_current)}
                    disabled={deleteSettingSetMutation.isPending}
                    className="flex-row items-center bg-red-500/15 px-2 py-1 rounded-md border border-red-500/30"
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={11} color="#ef4444" />
                    <Text className="text-[10px] font-mono text-racing-red ml-1 font-semibold">
                      刪除
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {viewingSet.settings.length === 0 ? (
                <View className="py-6 items-center">
                  <MaterialCommunityIcons name="tune-vertical-variant" size={32} color="#3f3f46" />
                  <Text className="text-metal-500 text-xs font-mono mt-2">
                    此設定組尚未建立細項參數
                  </Text>
                </View>
              ) : (
                <View className="divide-y divide-white/[0.04]">
                  {viewingSet.settings.map((param) => (
                    <View
                      key={param.id}
                      className="py-3 flex-row items-center justify-between"
                    >
                      <View className="flex-1 mr-3">
                        <Text className="text-metal-200 font-semibold text-sm">
                          {param.setting_name}
                        </Text>
                      </View>

                      <View className="flex-row items-baseline">
                        <Text className="text-racing-orange font-mono font-bold text-base mr-1">
                          {param.setting_value}
                        </Text>
                        {param.unit ? (
                          <Text className="text-metal-400 font-mono text-xs">
                            {param.unit}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </DoubleBezelCard>
        </View>
      ) : null}

      {/* Modal: 新增調校版本 */}
      <AddSettingSetModal
        visible={isAddSetModalOpen}
        modificationId={mod.id}
        currentVehicleMileage={mod.install_mileage ?? undefined}
        onClose={() => setIsAddSetModalOpen(false)}
      />

      {/* Modal: 編輯調校版本 */}
      <EditSettingSetModal
        visible={isEditSetModalOpen}
        modificationId={mod.id}
        settingSet={viewingSet || null}
        onClose={() => setIsEditSetModalOpen(false)}
      />

      {/* Modal: 版本設定比較 (Comparator) */}
      <CompareSettingSetsModal
        visible={isCompareModalOpen}
        settingSets={mod.setting_sets}
        initialSetAId={viewingSet?.id}
        onClose={() => setIsCompareModalOpen(false)}
      />

      {/* Modal: 全螢幕改裝照片瀏覽器 */}
      {viewerIndex !== null && (
        <ImageViewerModal
          visible={viewerIndex !== null}
          onClose={() => setViewerIndex(null)}
          images={mod.photos.map((p) => ({ uri: p.url }))}
          initialIndex={viewerIndex}
          onDeletePhoto={(idx) => handleDeletePhoto(mod.photos[idx].id)}
        />
      )}
    </ScrollView>
  );
};


