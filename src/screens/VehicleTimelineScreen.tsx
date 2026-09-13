import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { DoubleBezelCard } from '../components/DoubleBezelCard';
import { useTimeline } from '../hooks/queries/useTimeline';
import { VehicleTimelineRow, TimelineEventType } from '../types/database';

interface VehicleTimelineScreenProps {
  vehicleId: number;
  onBack: () => void;
}

type FilterCategory = 'ALL' | 'refuel' | 'maintenance' | 'modification';

export const VehicleTimelineScreen: React.FC<VehicleTimelineScreenProps> = ({
  vehicleId,
  onBack,
}) => {
  const [filter, setFilter] = useState<FilterCategory>('ALL');

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
    if (filter === 'maintenance') {
      return allEvents.filter(
        (e) => e.event_type === 'maintenance' || e.event_type === 'repair'
      );
    }
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
          label: '維修故障',
          border: 'red' as const,
        };
      case 'modification':
        return {
          icon: <MaterialCommunityIcons name="car-wrench" size={16} color="#a855f7" />,
          color: 'text-purple-400',
          bg: 'bg-purple-500/10 border-purple-500/30',
          label: '深度改裝',
          border: 'none' as const,
        };
    }
  };

  const renderTimelineItem = ({ item }: { item: VehicleTimelineRow }) => {
    const badge = getEventBadge(item.event_type);

    return (
      <View className="mb-4">
        <DoubleBezelCard
          accentBorder={badge.border}
          innerClassName="p-4"
        >
          {/* 頂部標籤與日期 */}
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              <View className={`p-1.5 rounded-lg border mr-2.5 ${badge.bg}`}>
                {badge.icon}
              </View>
              <Text className={`text-xs font-mono font-bold ${badge.color}`}>
                {badge.label}
              </Text>
            </View>

            <Text className="text-[11px] font-mono text-metal-400">
              {item.event_date}
            </Text>
          </View>

          {/* 事件主標題 */}
          <Text className="text-white font-bold text-base tracking-tight mb-1.5">
            {item.title}
          </Text>

          {/* 備註與描述 (若有) */}
          {item.description ? (
            <Text className="text-metal-400 text-xs leading-relaxed mb-3">
              {item.description}
            </Text>
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
              <Text className="text-[10px] font-mono text-metal-500 mr-1.5 uppercase">COST</Text>
              <Text className="text-sm font-mono font-bold text-white">
                ${Number(item.cost).toLocaleString()}
              </Text>
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

      {/* 分類過濾篩選膠囊 (Filter Pills) */}
      <View className="flex-row px-5 py-3 gap-2 border-b border-white/[0.04]">
        {(
          [
            { id: 'ALL', label: '全部動態' },
            { id: 'refuel', label: '加油紀錄' },
            { id: 'maintenance', label: '保修保養' },
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
    </View>
  );
};
