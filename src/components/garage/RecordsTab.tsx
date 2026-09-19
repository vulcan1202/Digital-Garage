import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { DoubleBezelCard } from '../DoubleBezelCard';
import { MaintenanceRecordRow, RefuelRow } from '../../types/database';

export type RecordsFilterType = 'ALL' | 'FUEL' | 'MAINTENANCE' | 'REPAIR';

interface RecordsTabProps {
  refuels: RefuelRow[];
  maintenanceRecords: MaintenanceRecordRow[];
  onAddRefuel: () => void;
  onAddMaintenance: () => void;
  onAddRepair: () => void;
  onEditRefuel: (refuel: RefuelRow) => void;
  onDeleteRefuel: (id: number, date: string) => void;
  onEditMaintenance: (record: MaintenanceRecordRow) => void;
  onDeleteMaintenance: (id: number, itemName: string) => void;
  onPreviewImages: (images: { uri: string; title: string }[]) => void;
}

export const RecordsTab: React.FC<RecordsTabProps> = ({
  refuels,
  maintenanceRecords,
  onAddRefuel,
  onAddMaintenance,
  onAddRepair,
  onEditRefuel,
  onDeleteRefuel,
  onEditMaintenance,
  onDeleteMaintenance,
  onPreviewImages,
}) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<RecordsFilterType>('ALL');

  // 統一項目規格以利混合或單獨列表排序呈現 (以時間降序)
  type UnifiedRecord =
    | { type: 'refuel'; data: RefuelRow; timestamp: number }
    | { type: 'maintenance'; data: MaintenanceRecordRow; timestamp: number };

  const unifiedList: UnifiedRecord[] = [
    ...refuels.map((r) => ({
      type: 'refuel' as const,
      data: r,
      timestamp: new Date(r.refuel_date).getTime() || 0,
    })),
    ...maintenanceRecords.map((m) => ({
      type: 'maintenance' as const,
      data: m,
      timestamp: new Date(m.service_date).getTime() || 0,
    })),
  ].sort((a, b) => b.timestamp - a.timestamp);

  const filteredList = unifiedList.filter((item) => {
    if (filter === 'ALL') return true;
    if (filter === 'FUEL') return item.type === 'refuel';
    if (filter === 'MAINTENANCE') return item.type === 'maintenance' && item.data.record_type === 'maintenance';
    if (filter === 'REPAIR') return item.type === 'maintenance' && item.data.record_type === 'repair';
    return true;
  });

  const maintenanceCount = maintenanceRecords.filter((m) => m.record_type === 'maintenance').length;
  const repairCount = maintenanceRecords.filter((m) => m.record_type === 'repair').length;

  return (
    <View className="gap-4">
      {/* 快捷登錄動作按鈕列 */}
      <View className="flex-row gap-2">
        <TouchableOpacity
          onPress={onAddRefuel}
          className="flex-1 bg-racing-blue/15 border border-racing-blue/30 py-2.5 px-2 rounded-xl flex-row items-center justify-center gap-1.5"
        >
          <Ionicons name="water" size={14} color="#007aff" />
          <Text className="text-xs font-mono font-bold text-racing-blue">+ {t('fuel.addRefuel')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onAddMaintenance}
          className="flex-1 bg-racing-orange/15 border border-racing-orange/30 py-2.5 px-2 rounded-xl flex-row items-center justify-center gap-1.5"
        >
          <Ionicons name="construct" size={14} color="#ff6b00" />
          <Text className="text-xs font-mono font-bold text-racing-orange">+ {t('maintenance.addMaintenance')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onAddRepair}
          className="flex-1 bg-racing-red/15 border border-racing-red/30 py-2.5 px-2 rounded-xl flex-row items-center justify-center gap-1.5"
        >
          <Ionicons name="build" size={14} color="#ef4444" />
          <Text className="text-xs font-mono font-bold text-racing-red">+ {t('maintenance.addRepair')}</Text>
        </TouchableOpacity>
      </View>

      {/* 次級分類篩選器 (Sub-category Segmented Bar) */}
      <View className="flex-row bg-zinc-950 p-1 rounded-2xl border border-white/10">
        <TouchableOpacity
          onPress={() => setFilter('ALL')}
          className={`flex-1 py-2 rounded-xl items-center justify-center ${
            filter === 'ALL' ? 'bg-white/15 border border-white/30' : ''
          }`}
        >
          <Text
            className={`text-xs font-mono font-bold ${
              filter === 'ALL' ? 'text-white' : 'text-metal-400'
            }`}
          >
            {t('common.actions.all')} ({unifiedList.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFilter('FUEL')}
          className={`flex-1 py-2 rounded-xl items-center justify-center ${
            filter === 'FUEL' ? 'bg-racing-blue/20 border border-racing-blue/40' : ''
          }`}
        >
          <Text
            className={`text-xs font-mono font-bold ${
              filter === 'FUEL' ? 'text-racing-blue' : 'text-metal-400'
            }`}
          >
            {t('fuel.title')} ({refuels.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFilter('MAINTENANCE')}
          className={`flex-1 py-2 rounded-xl items-center justify-center ${
            filter === 'MAINTENANCE' ? 'bg-racing-orange/20 border border-racing-orange/40' : ''
          }`}
        >
          <Text
            className={`text-xs font-mono font-bold ${
              filter === 'MAINTENANCE' ? 'text-racing-orange' : 'text-metal-400'
            }`}
          >
            {t('maintenance.types.maintenance')} ({maintenanceCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFilter('REPAIR')}
          className={`flex-1 py-2 rounded-xl items-center justify-center ${
            filter === 'REPAIR' ? 'bg-racing-red/20 border border-racing-red/40' : ''
          }`}
        >
          <Text
            className={`text-xs font-mono font-bold ${
              filter === 'REPAIR' ? 'text-racing-red' : 'text-metal-400'
            }`}
          >
            {t('maintenance.types.repair')} ({repairCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* 工單與日誌清單 */}
      {filteredList.length === 0 ? (
        <DoubleBezelCard innerClassName="py-8 items-center">
          <Ionicons name="document-text-outline" size={36} color="#52525b" />
          <Text className="text-metal-400 text-xs mt-2 font-mono">
            {t('common.status.emptyFilter')}
          </Text>
        </DoubleBezelCard>
      ) : (
        <View className="gap-2.5">
          {filteredList.map((item) => {
            if (item.type === 'refuel') {
              const refuel = item.data;
              const fuelLabel =
                refuel.fuel_type === 'gasoline_92'
                  ? t('fuel.types.gasoline_92')
                  : refuel.fuel_type === 'gasoline_95'
                  ? t('fuel.types.gasoline_95')
                  : refuel.fuel_type === 'gasoline_98'
                  ? t('fuel.types.gasoline_98')
                  : refuel.fuel_type === 'diesel'
                  ? t('fuel.types.diesel')
                  : refuel.fuel_type === 'premium_diesel'
                  ? t('fuel.types.premium_diesel')
                  : refuel.fuel_type === 'electric'
                  ? t('fuel.types.electric')
                  : refuel.fuel_type === 'hybrid'
                  ? t('fuel.types.hybrid')
                  : t('fuel.types.other');

              return (
                <View
                  key={`refuel-${refuel.id}`}
                  className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02]"
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 mr-2">
                      <View className="flex-row items-center gap-2 mb-1">
                        <View className="px-2 py-0.5 rounded bg-racing-blue/15 border border-racing-blue/30">
                          <Text className="text-[10px] font-mono text-racing-blue font-bold uppercase">
                            {fuelLabel}
                          </Text>
                        </View>
                        <Text className="text-[11px] text-metal-400 font-mono">
                          {refuel.volume} L {refuel.price_per_unit ? `@$${refuel.price_per_unit}/L` : ''}
                        </Text>
                      </View>

                      <Text className="text-white font-bold text-sm tracking-tight font-mono">
                        {refuel.refuel_date}
                      </Text>
                    </View>

                    <View className="items-end">
                      <Text className="text-xs font-mono font-bold text-racing-blue">
                        ${Number(refuel.total_cost).toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center justify-between mt-3 pt-2.5 border-t border-white/[0.06]">
                    <View className="flex-row items-center">
                      <Ionicons name="speedometer-outline" size={12} color="#71717a" />
                      <Text className="text-[10px] font-mono text-metal-400 ml-1">
                        @{refuel.mileage.toLocaleString()} KM
                      </Text>
                    </View>

                    <View className="flex-row items-center gap-1.5">
                      <TouchableOpacity
                        onPress={() => onEditRefuel(refuel)}
                        className="px-2.5 py-1 bg-white/10 rounded-md border border-white/20 flex-row items-center"
                      >
                        <Ionicons name="pencil" size={11} color="#fff" />
                        <Text className="text-[10px] font-mono text-white ml-1 font-semibold">
                          {t('common.actions.edit')}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => onDeleteRefuel(refuel.id, refuel.refuel_date)}
                        className="p-1 rounded-md bg-red-500/10 border border-red-500/20"
                      >
                        <Ionicons name="trash-outline" size={12} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            } else {
              const record = item.data;
              const isRepair = record.record_type === 'repair';
              const photos = (record as MaintenanceRecordRow & { photos?: { id: number; url: string }[] }).photos || [];

              return (
                <View
                  key={`maint-${record.id}`}
                  className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02]"
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 mr-2">
                      <View className="flex-row items-center gap-2 mb-1">
                        <View
                          className={`px-2 py-0.5 rounded border ${
                            isRepair
                              ? 'bg-racing-red/15 border-racing-red/30'
                              : 'bg-racing-orange/15 border-racing-orange/30'
                          }`}
                        >
                          <Text
                            className={`text-[10px] font-mono font-bold uppercase ${
                              isRepair ? 'text-racing-red' : 'text-racing-orange'
                            }`}
                          >
                            {isRepair ? t('maintenance.types.repair') : t('maintenance.types.maintenance')}
                          </Text>
                        </View>
                        {record.shop_name ? (
                          <Text className="text-[10px] text-metal-500 font-mono" numberOfLines={1}>
                            {record.shop_name}
                          </Text>
                        ) : null}
                      </View>

                      <Text className="text-white font-bold text-sm tracking-tight">
                        {record.item_name}
                      </Text>

                      {record.note ? (
                        <Text className="text-[11px] text-metal-400 font-mono mt-0.5" numberOfLines={2}>
                          {record.note}
                        </Text>
                      ) : null}

                      {/* 工單相片縮圖列 */}
                      {photos.length > 0 && (
                        <View className="flex-row items-center mt-2 space-x-1.5">
                          {photos.map((p) => (
                            <TouchableOpacity
                              key={p.id}
                              onPress={() => {
                                const viewerImgs = photos.map((photo) => ({
                                  uri: photo.url,
                                  title: `${record.item_name} · ${t('maintenance.workOrderPhoto')}`,
                                }));
                                onPreviewImages(viewerImgs);
                              }}
                              className="w-9 h-9 rounded-lg overflow-hidden border border-white/20 mr-1.5"
                            >
                              <Image source={{ uri: p.url }} className="w-full h-full" resizeMode="cover" />
                            </TouchableOpacity>
                          ))}
                          <Text className="text-[10px] text-metal-500 font-mono">
                            {t('common.status.photoCount', { count: photos.length })}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View className="items-end">
                      <Text className="text-xs font-mono font-bold text-white">
                        ${Number(record.cost).toLocaleString()}
                      </Text>
                      <Text className="text-[9px] text-metal-500 font-mono">
                        {record.service_date}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center justify-between mt-3 pt-2.5 border-t border-white/[0.06]">
                    <View className="flex-row items-center">
                      <Ionicons name="speedometer-outline" size={12} color="#71717a" />
                      <Text className="text-[10px] font-mono text-metal-400 ml-1">
                        @{record.mileage.toLocaleString()} KM
                      </Text>
                    </View>

                    <View className="flex-row items-center gap-1.5">
                      <TouchableOpacity
                        onPress={() => onEditMaintenance(record)}
                        className="px-2.5 py-1 bg-white/10 rounded-md border border-white/20 flex-row items-center"
                      >
                        <Ionicons name="pencil" size={11} color="#fff" />
                        <Text className="text-[10px] font-mono text-white ml-1 font-semibold">
                          {t('common.actions.edit')}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => onDeleteMaintenance(record.id, record.item_name)}
                        className="p-1 rounded-md bg-red-500/10 border border-red-500/20"
                      >
                        <Ionicons name="trash-outline" size={12} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            }
          })}
        </View>
      )}
    </View>
  );
};
