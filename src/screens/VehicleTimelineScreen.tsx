import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { DoubleBezelCard } from '../components/DoubleBezelCard';
import { useTimeline } from '../hooks/queries/useTimeline';
import { useRefuels, useDeleteRefuel } from '../hooks/queries/useFuel';
import { useMaintenanceRecords, useDeleteMaintenanceRecord } from '../hooks/queries/useMaintenance';
import { useModifications, useDeleteModification } from '../hooks/queries/useModifications';
import {
  VehicleTimelineRow,
  TimelineEventType,
  RefuelRow,
  MaintenanceRecordRow,
  ModificationRow,
} from '../types/database';
import { EditRefuelModal } from '../components/modals/EditRefuelModal';
import { EditMaintenanceModal } from '../components/modals/EditMaintenanceModal';
import { EditModificationModal } from '../components/modals/EditModificationModal';

interface VehicleTimelineScreenProps {
  vehicleId: number;
  onBack: () => void;
  onNavigateToModDetail?: (modId: number) => void;
}

type FilterCategory = 'ALL' | 'refuel' | 'maintenance' | 'repair' | 'modification';

export const VehicleTimelineScreen: React.FC<VehicleTimelineScreenProps> = ({
  vehicleId,
  onBack,
  onNavigateToModDetail,
}) => {
  const [filter, setFilter] = useState<FilterCategory>('ALL');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const { data: refuels = [] } = useRefuels(vehicleId);
  const { data: maintenanceRecords = [] } = useMaintenanceRecords(vehicleId);
  const { data: modifications = [] } = useModifications(vehicleId);

  const deleteRefuelMutation = useDeleteRefuel();
  const deleteMaintenanceMutation = useDeleteMaintenanceRecord();
  const deleteModMutation = useDeleteModification();

  const [editingRefuel, setEditingRefuel] = useState<RefuelRow | null>(null);
  const [editingMaintenance, setEditingMaintenance] = useState<MaintenanceRecordRow | null>(null);
  const [editingMod, setEditingMod] = useState<ModificationRow | null>(null);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useTimeline(vehicleId);

  // 將 useInfiniteQuery 回傳之多頁平坦化為單一陣列
  const allEvents = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flat();
  }, [data]);

  // 前端分類快速過濾 (純展示過濾，底層依然是單一 View 查詢)
  const filteredEvents = useMemo(() => {
    if (filter === 'ALL') return allEvents;
    return allEvents.filter((e) => e.event_type === filter);
  }, [allEvents, filter]);

  // 渲染不同型別事件的圖示與色彩主題
  const getEventBadge = (eventType: TimelineEventType) => {
    switch (eventType) {
      case 'refuel':
        return {
          icon: <Ionicons name="water-outline" size={16} color="#007aff" />,
          color: 'text-racing-blue',
          bg: 'bg-racing-blue/10 border-racing-blue/30',
          label: '加油紀錄',
          border: 'blue' as const,
        };
      case 'maintenance':
        return {
          icon: <Ionicons name="construct-outline" size={16} color="#ff6b00" />,
          color: 'text-racing-orange',
          bg: 'bg-racing-orange/10 border-racing-orange/30',
          label: '定期保養',
          border: 'orange' as const,
        };
      case 'repair':
        return {
          icon: <Ionicons name="warning-outline" size={16} color="#ef4444" />,
          color: 'text-racing-red',
          bg: 'bg-racing-red/10 border-racing-red/30',
          label: '故障維修',
          border: 'red' as const,
        };
      case 'modification':
        return {
          icon: <MaterialCommunityIcons name="car-wrench" size={16} color="#a855f7" />,
          color: 'text-purple-400',
          bg: 'bg-purple-500/10 border-purple-500/30',
          label: '改裝升級',
          border: 'none' as const,
        };
      case 'purchase':
        return {
          icon: <Ionicons name="key-outline" size={16} color="#10b981" />,
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/10 border-emerald-500/30',
          label: '購入入庫',
          border: 'none' as const,
        };
    }
  };

  const handleDeleteEvent = (item: VehicleTimelineRow) => {
    // 依 Guardrail: Purchase Event 不提供一般 Delete
    if (item.event_type === 'purchase') {
      Alert.alert('提示', '購入入庫為愛車基本資料，請至車輛管理介面編輯或刪除整輛車。');
      return;
    }

    let typeName = '紀錄';
    if (item.event_type === 'refuel') typeName = '加油紀錄';
    else if (item.event_type === 'maintenance') typeName = '保養工單';
    else if (item.event_type === 'repair') typeName = '維修工單';
    else if (item.event_type === 'modification') typeName = '改裝品';

    Alert.alert(`刪除${typeName}`, `確定要刪除「${item.title}」嗎？\n此操作無法復原。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '確定刪除',
        style: 'destructive',
        onPress: async () => {
          try {
            if (item.event_type === 'refuel') {
              await deleteRefuelMutation.mutateAsync({ id: item.event_id, vehicleId });
            } else if (item.event_type === 'maintenance' || item.event_type === 'repair') {
              await deleteMaintenanceMutation.mutateAsync({ id: item.event_id, vehicleId });
            } else if (item.event_type === 'modification') {
              await deleteModMutation.mutateAsync({ id: item.event_id, vehicleId });
            }
            refetch();
            Alert.alert('刪除成功', `已成功刪除該筆${typeName}。`);
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : '刪除失敗';
            Alert.alert('刪除失敗', message);
          }
        },
      },
    ]);
  };

  const handleEditEvent = (item: VehicleTimelineRow) => {
    // 依 Guardrail: 若需修改 Purchase 資訊，導向提示至車輛管理
    if (item.event_type === 'purchase') {
      Alert.alert('車輛基本資料', '購入入庫為愛車基本資料，請至車輛管理介面（編輯愛車）進行修改。');
      return;
    }

    if (item.event_type === 'refuel') {
      const found = refuels.find((r) => r.id === item.event_id);
      if (found) {
        setEditingRefuel(found);
      } else {
        setEditingRefuel({
          id: item.event_id,
          vehicle_id: vehicleId,
          refuel_date: item.event_date,
          mileage: item.mileage,
          volume: 0,
          price_per_unit: null,
          total_cost: item.cost,
          fuel_type: 'gasoline_98',
          created_at: item.created_at,
          updated_at: item.created_at,
        });
      }
    } else if (item.event_type === 'maintenance' || item.event_type === 'repair') {
      const found = maintenanceRecords.find((m) => m.id === item.event_id);
      if (found) {
        setEditingMaintenance(found);
      } else {
        setEditingMaintenance({
          id: item.event_id,
          vehicle_id: vehicleId,
          record_type: item.event_type === 'repair' ? 'repair' : 'maintenance',
          item_name: item.title,
          service_date: item.event_date,
          mileage: item.mileage,
          cost: item.cost,
          shop_name: null,
          note: item.description,
          created_at: item.created_at,
          updated_at: item.created_at,
        });
      }
    } else if (item.event_type === 'modification') {
      const found = modifications.find((m) => m.id === item.event_id);
      if (found) {
        setEditingMod(found);
      }
    }
  };

  const renderTimelineItem = ({ item }: { item: VehicleTimelineRow }) => {
    const badge = getEventBadge(item.event_type);

    // 關聯各領域既有擴充資料
    const refuelDetail =
      item.event_type === 'refuel' ? refuels.find((r) => r.id === item.event_id) : null;
    const maintenanceDetail =
      item.event_type === 'maintenance' || item.event_type === 'repair'
        ? maintenanceRecords.find((m) => m.id === item.event_id)
        : null;
    const modDetail =
      item.event_type === 'modification'
        ? modifications.find((m) => m.id === item.event_id)
        : null;

    return (
      <View className="mb-4">
        <DoubleBezelCard accentBorder={badge.border} innerClassName="p-4">
          {/* 頂部標籤與日期 */}
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              <View className={`p-1.5 rounded-lg border mr-2.5 ${badge.bg}`}>
                {badge.icon}
              </View>
              <Text className={`text-xs font-mono font-bold ${badge.color}`}>
                {badge.label}
              </Text>
              {modDetail?.category && (
                <View className="ml-2 px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/30">
                  <Text className="text-[10px] font-mono text-purple-300 font-semibold uppercase">
                    {modDetail.category}
                  </Text>
                </View>
              )}
            </View>

            <Text className="text-[11px] font-mono text-metal-400">
              {item.event_date}
            </Text>
          </View>

          {/* 事件主標題 */}
          <Text className="text-white font-bold text-base tracking-tight mb-1">
            {item.title}
          </Text>

          {/* 改裝品型號或品牌細節 */}
          {modDetail && (modDetail.brand || modDetail.model) ? (
            <Text className="text-metal-400 text-xs font-mono mb-1.5">
              {[modDetail.brand, modDetail.model].filter(Boolean).join(' · ')}
            </Text>
          ) : null}

          {/* 施作店家資訊 (保養/維修/改裝) */}
          {(maintenanceDetail?.shop_name || modDetail?.shop_name) ? (
            <View className="flex-row items-center mb-2">
              <Ionicons name="business-outline" size={12} color="#71717a" />
              <Text className="text-metal-400 text-xs font-mono ml-1.5">
                {maintenanceDetail?.shop_name || modDetail?.shop_name}
              </Text>
            </View>
          ) : null}

          {/* 加油擴充遙測資訊 (公升數、單價) */}
          {refuelDetail && (refuelDetail.volume > 0 || refuelDetail.price_per_unit) ? (
            <View className="flex-row items-center mb-2">
              <Ionicons name="water-outline" size={12} color="#38bdf8" />
              <Text className="text-sky-300 text-xs font-mono ml-1.5">
                {refuelDetail.volume > 0 ? `${refuelDetail.volume} L` : ''}
                {refuelDetail.volume > 0 && refuelDetail.price_per_unit ? ' @ ' : ''}
                {refuelDetail.price_per_unit ? `$${refuelDetail.price_per_unit}/L` : ''}
              </Text>
            </View>
          ) : null}

          {/* 備註與描述 (若有) */}
          {item.description ? (
            <Text className="text-metal-400 text-xs leading-relaxed mb-2.5">
              {item.description}
            </Text>
          ) : null}

          {/* 關聯照片縮圖清單 (若保養維修有上傳照片) */}
          {maintenanceDetail && maintenanceDetail.photos && maintenanceDetail.photos.length > 0 ? (
            <View className="mb-3">
              <View className="flex-row items-center mb-1.5">
                <Ionicons name="images-outline" size={12} color="#a1a1aa" />
                <Text className="text-metal-400 text-[11px] font-mono ml-1">
                  現場照片 ({maintenanceDetail.photos.length})
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                {maintenanceDetail.photos.map((photo) => (
                  <TouchableOpacity
                    key={photo.id}
                    onPress={() => setSelectedPhoto(photo.url)}
                    className="mr-2 rounded-lg overflow-hidden border border-white/10"
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: photo.url }}
                      className="w-16 h-16 bg-metal-900"
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* 底部數據：里程與花費 (高密度遙測排版) */}
          <View className="flex-row items-center justify-between pt-2.5 mt-1 border-t border-white/[0.06]">
            <View className="flex-row items-center">
              <Ionicons name="speedometer-outline" size={14} color="#71717a" />
              <Text className="text-xs font-mono text-metal-300 ml-1.5">
                {item.mileage.toLocaleString()} KM
              </Text>
            </View>

            <View className="flex-row items-center">
              <Text className="text-[10px] font-mono text-metal-500 mr-1.5 uppercase">
                {item.event_type === 'purchase' ? 'PRICE' : 'COST'}
              </Text>
              <Text className="text-sm font-mono font-bold text-white">
                ${Number(item.cost).toLocaleString()}
              </Text>
            </View>
          </View>

          {/* 操作按鈕與來源導向 (編輯、調校版本、刪除) */}
          <View className="flex-row items-center justify-between mt-2.5 pt-2 border-t border-white/[0.04]">
            {/* 左側：改裝品專屬「調校版本」快速直達 */}
            <View className="flex-row items-center">
              {item.event_type === 'modification' && onNavigateToModDetail && (
                <TouchableOpacity
                  onPress={() => onNavigateToModDetail(item.event_id)}
                  className="px-2.5 py-1 bg-purple-500/15 rounded-md border border-purple-500/30 flex-row items-center mr-2"
                >
                  <MaterialCommunityIcons name="tune" size={12} color="#c084fc" />
                  <Text className="text-[10px] font-mono text-purple-300 ml-1 font-semibold">
                    調校版本
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 右側：既有 Edit & Delete 操作 (Purchase 僅提供導航提示，不提供一般刪除) */}
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                onPress={() => handleEditEvent(item)}
                className="px-2.5 py-1 bg-white/10 rounded-md border border-white/20 flex-row items-center"
              >
                <Ionicons name="pencil" size={11} color="#fff" />
                <Text className="text-[10px] font-mono text-white ml-1 font-semibold">
                  {item.event_type === 'purchase' ? '車輛資訊' : '編輯'}
                </Text>
              </TouchableOpacity>

              {item.event_type !== 'purchase' && (
                <TouchableOpacity
                  onPress={() => handleDeleteEvent(item)}
                  className="p-1 rounded-md bg-red-500/10 border border-red-500/20"
                >
                  <Ionicons name="trash-outline" size={12} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </DoubleBezelCard>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-garage-bg">
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
              VIEW: VEHICLE_TIMELINE
            </Text>
            <Text className="text-xl font-bold text-white tracking-tight">
              愛車動態時序牆
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => refetch()}
          className="w-9 h-9 rounded-full bg-white/[0.06] items-center justify-center border border-white/10"
        >
          <Ionicons name="refresh-outline" size={18} color="#a1a1aa" />
        </TouchableOpacity>
      </View>

      {/* 分類過濾篩選膠囊 (Filter Pills: ALL, refuel, maintenance, repair, modification) */}
      <View className="border-b border-white/[0.04] py-2.5">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {(
            [
              { id: 'ALL', label: '全部動態' },
              { id: 'refuel', label: '加油紀錄' },
              { id: 'maintenance', label: '定期保養' },
              { id: 'repair', label: '故障維修' },
              { id: 'modification', label: '改裝升級' },
            ] as const
          ).map((tab) => {
            const isActive = filter === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setFilter(tab.id)}
                className={`px-3 py-1.5 rounded-full border ${
                  isActive
                    ? 'bg-racing-orange border-racing-orange'
                    : 'bg-white/[0.03] border-white/10'
                }`}
              >
                <Text
                  className={`text-xs font-mono font-medium ${
                    isActive ? 'text-black font-bold' : 'text-metal-400'
                  }`}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 時間軸卡片流 (FlatList with Infinite Loading) */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#ff6b00" />
          <Text className="text-metal-400 text-xs font-mono mt-3 uppercase tracking-widest">
            Querying Timeline View...
          </Text>
        </View>
      ) : filteredEvents.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <MaterialCommunityIcons name="timeline-clock-outline" size={48} color="#3f3f46" />
          <Text className="text-metal-300 font-semibold text-base mt-4">尚無時間軸事件</Text>
          <Text className="text-metal-500 text-xs text-center mt-1">
            新增加油、保修紀錄或改裝品後，將自動匯聚於此時序牆。
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => `${item.event_type}-${item.event_id}-${item.created_at}`}
          renderItem={renderTimelineItem}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 60 }}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#ff6b00" />
              </View>
            ) : null
          }
        />
      )}

      {/* 圖片大圖檢視 Modal */}
      <Modal
        visible={!!selectedPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View className="flex-1 bg-black/90 items-center justify-center p-4">
          <TouchableOpacity
            onPress={() => setSelectedPhoto(null)}
            className="absolute top-12 right-5 z-10 p-2 rounded-full bg-white/20"
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          {selectedPhoto && (
            <Image
              source={{ uri: selectedPhoto }}
              className="w-full h-3/4 rounded-lg"
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* 編輯對話框掛載 (既有 CRUD 複用，零重複 CRUD) */}
      <EditRefuelModal
        visible={!!editingRefuel}
        record={editingRefuel}
        onClose={() => {
          setEditingRefuel(null);
          refetch();
        }}
      />

      <EditMaintenanceModal
        visible={!!editingMaintenance}
        record={editingMaintenance}
        onClose={() => {
          setEditingMaintenance(null);
          refetch();
        }}
      />

      <EditModificationModal
        visible={!!editingMod}
        modification={editingMod}
        onClose={() => {
          setEditingMod(null);
          refetch();
        }}
      />
    </View>
  );
};
