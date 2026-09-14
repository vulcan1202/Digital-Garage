import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { DoubleBezelCard } from '../components/DoubleBezelCard';
import { useVehicles, useDeleteVehicle } from '../hooks/queries/useVehicles';
import { useRefuels, useDeleteRefuel } from '../hooks/queries/useFuel';
import { useReminders, useCompleteReminder, useDeleteReminder } from '../hooks/queries/useReminders';
import { useModifications, useDeleteModification } from '../hooks/queries/useModifications';
import { useMaintenanceRecords, useDeleteMaintenanceRecord } from '../hooks/queries/useMaintenance';
import { calculateVehicleTotalCost, calculateAverageCostPerKm } from '../utils/calculators/costCalculator';
import { calculateAverageFuelCostPerKm, calculateFuelEconomy } from '../utils/calculators/fuelCalculator';
import { evaluateReminderStatus } from '../utils/calculators/reminderCalculator';
import { ModificationRow, RefuelRow, MaintenanceRecordRow } from '../types/database';

import { AddVehicleModal } from '../components/modals/AddVehicleModal';
import { EditVehicleModal } from '../components/modals/EditVehicleModal';
import { AddRefuelModal } from '../components/modals/AddRefuelModal';
import { EditRefuelModal } from '../components/modals/EditRefuelModal';
import { AddMaintenanceModal } from '../components/modals/AddMaintenanceModal';
import { EditMaintenanceModal } from '../components/modals/EditMaintenanceModal';
import { AddReminderModal } from '../components/modals/AddReminderModal';
import { AddModificationModal } from '../components/modals/AddModificationModal';
import { EditModificationModal } from '../components/modals/EditModificationModal';
import { VehiclePhotoGalleryModal } from '../components/modals/VehiclePhotoGalleryModal';
import { ImageViewerModal } from '../components/modals/ImageViewerModal';
import { CostAnalyticsCard } from '../components/analytics/CostAnalyticsCard';

interface GarageDashboardScreenProps {
  onNavigateToTimeline: (vehicleId: number) => void;
  onNavigateToModDetail: (modId: number) => void;
  onSignOut?: () => void;
}

export const GarageDashboardScreen: React.FC<GarageDashboardScreenProps> = ({
  onNavigateToTimeline,
  onNavigateToModDetail,
  onSignOut,
}) => {
  const { data: vehicles = [], isLoading: isLoadingVehicles } = useVehicles();
  const deleteVehicleMutation = useDeleteVehicle();
  const completeReminderMutation = useCompleteReminder();
  const deleteReminderMutation = useDeleteReminder();
  const deleteModMutation = useDeleteModification();
  const deleteRefuelMutation = useDeleteRefuel();
  const deleteMaintenanceMutation = useDeleteMaintenanceRecord();

  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);

  // Modals state
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [isEditVehicleOpen, setIsEditVehicleOpen] = useState(false);
  const [isAddRefuelOpen, setIsAddRefuelOpen] = useState(false);
  const [isAddMaintenanceOpen, setIsAddMaintenanceOpen] = useState(false);
  const [isAddReminderOpen, setIsAddReminderOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [maintenanceViewerImages, setMaintenanceViewerImages] = useState<Array<{ uri: string; title?: string }> | null>(null);

  // Fleet Records Tab state ('modifications' | 'maintenance' | 'refuels')
  const [activeRecordTab, setActiveRecordTab] = useState<'modifications' | 'maintenance' | 'refuels'>('modifications');

  const [isAddModOpen, setIsAddModOpen] = useState(false);
  const [editingMod, setEditingMod] = useState<ModificationRow | null>(null);
  const [editingRefuel, setEditingRefuel] = useState<RefuelRow | null>(null);
  const [editingMaintenance, setEditingMaintenance] = useState<MaintenanceRecordRow | null>(null);

  // 當車輛清單加載後，預設選取第一台車
  const activeVehicle = useMemo(() => {
    if (!vehicles.length) return null;
    if (selectedVehicleId) {
      const found = vehicles.find((v) => v.id === selectedVehicleId);
      if (found) return found;
    }
    return vehicles[0];
  }, [vehicles, selectedVehicleId]);

  const activeId = activeVehicle ? activeVehicle.id : 0;

  // 取得選取車輛的各項業務資料以進行遙測計算
  const { data: refuels = [] } = useRefuels(activeId);
  const { data: maintenanceRecords = [] } = useMaintenanceRecords(activeId);
  const { data: reminders = [] } = useReminders(activeId);
  const { data: modifications = [] } = useModifications(activeId);

  // 遙測統計計算 (純函式 Calculators)
  const costStats = useMemo(() => {
    return calculateVehicleTotalCost(
      refuels,
      maintenanceRecords,
      modifications,
      activeVehicle?.purchase_price
    );
  }, [refuels, maintenanceRecords, modifications, activeVehicle]);

  // 累計行駛里程基準：以 activeVehicle.initial_mileage 為唯一起算原點
  const baseMileage = activeVehicle ? activeVehicle.initial_mileage : 0;

  const averageCostPerKm = useMemo(() => {
    if (!activeVehicle) return null;
    return calculateAverageCostPerKm(costStats.operationalCost, baseMileage, activeVehicle.current_mileage);
  }, [costStats.operationalCost, baseMileage, activeVehicle]);

  const ownershipCostPerKm = useMemo(() => {
    if (!activeVehicle || costStats.totalOwnershipCost === null) return null;
    return calculateAverageCostPerKm(costStats.totalOwnershipCost, baseMileage, activeVehicle.current_mileage);
  }, [costStats.totalOwnershipCost, baseMileage, activeVehicle]);

  const fuelStats = useMemo(() => {
    const avgCostKm = calculateAverageFuelCostPerKm(refuels);
    let latestEconomy = null;
    if (refuels.length >= 2) {
      latestEconomy = calculateFuelEconomy(refuels[0], refuels[1]);
    }
    return { avgCostKm, latestEconomy };
  }, [refuels]);

  // 保養提醒狀態過濾與統計
  const reminderEvals = useMemo(() => {
    if (!activeVehicle) return [];
    return reminders.map((r) => ({
      reminder: r,
      evaluation: evaluateReminderStatus(r, activeVehicle.current_mileage),
    }));
  }, [reminders, activeVehicle]);

  const alertCounts = useMemo(() => {
    let overdue = 0;
    let dueSoon = 0;
    reminderEvals.forEach((item) => {
      if (item.evaluation.status === 'OVERDUE') overdue++;
      if (item.evaluation.status === 'DUE_SOON') dueSoon++;
    });
    return { overdue, dueSoon };
  }, [reminderEvals]);

  const handleDeleteVehicle = () => {
    if (!activeVehicle) return;
    Alert.alert(
      '確認移除愛車？',
      `此操作將永久刪除「${activeVehicle.brand} ${activeVehicle.model}」及其所有加油、保修、改裝紀錄（SQL 級聯刪除），無法還原！`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '確認刪除',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteVehicleMutation.mutateAsync(activeVehicle.id);
              setSelectedVehicleId(null);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : '刪除車輛失敗';
              Alert.alert('刪除失敗', msg);
            }
          },
        },
      ]
    );
  };

  const handleCompleteReminder = (reminderId: number, itemName: string) => {
    if (!activeVehicle) return;
    const today = new Date().toISOString().split('T')[0];
    Alert.alert(
      '標記保養完成',
      `確認已完成「${itemName}」？此操作將基準里程更新為目前車輛里程 (${activeVehicle.current_mileage} km)，起算下一週期。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '確認完成',
          onPress: async () => {
            try {
              await completeReminderMutation.mutateAsync({
                id: reminderId,
                vehicleId: activeVehicle.id,
                completedMileage: activeVehicle.current_mileage,
                completedDate: today,
              });
              Alert.alert('已更新', '保養基準已成功前移！');
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : '更新失敗';
              Alert.alert('更新失敗', msg);
            }
          },
        },
      ]
    );
  };

  const handleDeleteReminder = (reminderId: number, itemName: string) => {
    if (!activeVehicle) return;
    Alert.alert('刪除提醒', `確定要刪除「${itemName}」提醒雷達？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteReminderMutation.mutateAsync({
              id: reminderId,
              vehicleId: activeVehicle.id,
            });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : '刪除失敗';
            Alert.alert('刪除失敗', msg);
          }
        },
      },
    ]);
  };

  const handleDeleteMod = (modId: number, itemName: string) => {
    if (!activeVehicle) return;
    Alert.alert(
      '刪除改裝品',
      `確定要刪除「${itemName}」及其所有調校設定嗎？此操作無法還原。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '刪除',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteModMutation.mutateAsync({
                id: modId,
                vehicleId: activeVehicle.id,
              });
              Alert.alert('已刪除', '改裝品已自車庫中移除。');
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : '刪除失敗';
              Alert.alert('刪除失敗', msg);
            }
          },
        },
      ]
    );
  };

  const handleDeleteRefuel = (refuelId: number, refuelDate: string) => {
    if (!activeVehicle) return;
    Alert.alert(
      '刪除加油紀錄',
      `確定要刪除 ${refuelDate} 的加油紀錄嗎？\n此操作無法復原。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '確定刪除',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRefuelMutation.mutateAsync({
                id: refuelId,
                vehicleId: activeVehicle.id,
              });
              Alert.alert('已刪除', '加油紀錄已自車庫中移除。');
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : '刪除失敗';
              Alert.alert('刪除失敗', msg);
            }
          },
        },
      ]
    );
  };

  const handleDeleteMaintenance = (recordId: number, itemName: string) => {
    if (!activeVehicle) return;
    Alert.alert(
      '刪除保修工單',
      `確定要刪除「${itemName}」保修工單嗎？\n此操作無法復原。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '確定刪除',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMaintenanceMutation.mutateAsync({
                id: recordId,
                vehicleId: activeVehicle.id,
              });
              Alert.alert('已刪除', '保修工單已自車庫中移除。');
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : '刪除失敗';
              Alert.alert('刪除失敗', msg);
            }
          },
        },
      ]
    );
  };


  if (isLoadingVehicles) {
    return (
      <View className="flex-1 bg-garage-bg items-center justify-center">
        <ActivityIndicator size="large" color="#ff6b00" />
        <Text className="text-metal-400 mt-4 text-xs tracking-widest uppercase">
          Initializing Digital Garage...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-garage-bg" contentContainerStyle={{ paddingBottom: 60 }}>
      {/* 頂部 Header */}
      <View className="pt-14 px-5 pb-4 flex-row items-center justify-between border-b border-white/[0.06]">
        <View className="flex-row items-center gap-3">
          <Image
            source={require('../../assets/icon.png')}
            className="w-11 h-11 rounded-xl border border-amber-400/30 shadow-md"
            resizeMode="cover"
          />
          <View>
            <Text className="text-[10px] font-mono tracking-[0.25em] text-racing-orange uppercase font-bold">
              DIGITAL GARAGE TELEMETRY
            </Text>
            <Text className="text-2xl font-bold text-white tracking-tight mt-0.5">
              數位車庫座艙
            </Text>
          </View>
        </View>

        {/* 狀態指示燈與登出按鈕 */}
        <View className="flex-row items-center gap-2">
          <View className="flex-row items-center bg-white/[0.04] px-2.5 py-1 rounded-full border border-white/10">
            <View className="w-2 h-2 rounded-full bg-racing-green mr-1.5" />
            <Text className="text-[11px] text-metal-300 font-mono">ONLINE</Text>
          </View>

          {onSignOut && (
            <TouchableOpacity
              onPress={onSignOut}
              className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 items-center justify-center"
            >
              <Ionicons name="log-out-outline" size={16} color="#a1a1aa" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 車輛切換橫向選單 (Horizontal Selector) */}
      <View className="mt-5">
        <View className="px-5 mb-3 flex-row items-center justify-between">
          <Text className="text-xs font-mono tracking-wider text-metal-400 uppercase">
            ACTIVE FLEET ({vehicles.length})
          </Text>
          <TouchableOpacity
            onPress={() => setIsAddVehicleOpen(true)}
            className="flex-row items-center bg-racing-orange/15 px-2.5 py-1 rounded-full border border-racing-orange/30"
          >
            <Ionicons name="add" size={13} color="#ff6b00" />
            <Text className="text-[11px] text-racing-orange font-bold ml-1 font-mono">
              新增愛車
            </Text>
          </TouchableOpacity>
        </View>


        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
        >
          {vehicles.map((v) => {
            const isSelected = activeVehicle?.id === v.id;
            return (
              <TouchableOpacity
                key={v.id}
                onPress={() => setSelectedVehicleId(v.id)}
                activeOpacity={0.85}
              >
                <DoubleBezelCard
                  className={`w-64 ${
                    isSelected
                      ? 'border-2 border-racing-orange shadow-lg shadow-racing-orange/40'
                      : 'border-white/10 opacity-75'
                  }`}
                  innerClassName={isSelected ? 'bg-zinc-900 border-racing-orange/30' : 'bg-garage-card'}
                >
                  <View className="h-28 w-full rounded-lg overflow-hidden bg-zinc-950 mb-3 relative">
                    {v.cover_url ? (
                      <Image
                        source={{ uri: v.cover_url }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="w-full h-full items-center justify-center bg-white/[0.02]">
                        <Ionicons name="car-sport-outline" size={40} color="#52525b" />
                      </View>
                    )}

                    {/* 選擇中指示徽章 (Active Badge) */}
                    {isSelected && (
                      <View className="absolute top-2 left-2 bg-racing-orange px-2 py-0.5 rounded flex-row items-center gap-1 shadow-md shadow-black">
                        <View className="w-1.5 h-1.5 rounded-full bg-black" />
                        <Text className="text-[10px] font-mono font-black text-black tracking-wider">
                          ACTIVE
                        </Text>
                      </View>
                    )}

                    <View className="absolute top-2 right-2 bg-black/70 px-2 py-0.5 rounded border border-white/10">
                      <Text className="text-[10px] font-mono text-metal-200">
                        {v.year ? `${v.year}` : 'N/A'}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center justify-between">
                    <Text
                      className={`font-bold text-base tracking-tight flex-1 mr-2 ${
                        isSelected ? 'text-racing-orange' : 'text-white'
                      }`}
                      numberOfLines={1}
                    >
                      {v.brand} {v.model}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={16} color="#FF5500" />
                    )}
                  </View>

                  <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-white/[0.06]">
                    <Text className="text-[11px] text-metal-400 font-mono">ODOMETER</Text>
                    <Text className="text-xs font-mono font-semibold text-metal-100">
                      {v.current_mileage.toLocaleString()} KM
                    </Text>
                  </View>
                </DoubleBezelCard>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 車輛遙測儀表面板 (Telemetry Grid - Visual Density: 7) */}
      {activeVehicle && (
        <View className="px-5 mt-6">
          <View className="flex-row items-center justify-between mb-3">
            <View>
              <View className="flex-row items-center gap-1.5 mb-1">
                <Text className="text-xs font-mono tracking-wider text-metal-400 uppercase">
                  VEHICLE TELEMETRY
                </Text>
                {/* 車型 Badge */}
                <View className="bg-zinc-800 border border-white/10 px-2 py-0.5 rounded flex-row items-center gap-1">
                  <Ionicons
                    name={
                      activeVehicle.vehicle_type === 'motorcycle'
                        ? 'bicycle'
                        : activeVehicle.vehicle_type === 'other'
                        ? 'grid'
                        : 'car-sport'
                    }
                    size={11}
                    color="#ff4d00"
                  />
                  <Text className="text-[9px] font-mono font-bold text-racing-orange uppercase">
                    {activeVehicle.vehicle_type || 'car'}
                  </Text>
                </View>
                {/* 車牌 Badge */}
                {activeVehicle.license_plate && (
                  <View className="bg-white/10 border border-white/20 px-2 py-0.5 rounded">
                    <Text className="text-[10px] font-mono font-bold text-white tracking-wider">
                      {activeVehicle.license_plate}
                    </Text>
                  </View>
                )}
              </View>
              <Text className="text-[11px] font-mono text-metal-500">
                {activeVehicle.brand} {activeVehicle.model}
                {activeVehicle.engine_displacement_cc ? ` · ${activeVehicle.engine_displacement_cc} c.c.` : ''}
                {activeVehicle.fuel_type ? ` · ${activeVehicle.fuel_type}` : ''}
              </Text>
            </View>

            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                onPress={() => setIsGalleryOpen(true)}
                className="flex-row items-center bg-racing-orange/15 px-2.5 py-1 rounded-full border border-racing-orange/30 active:bg-racing-orange/25"
              >
                <Ionicons name="images-outline" size={12} color="#ff6b00" />
                <Text className="text-[10px] font-mono text-racing-orange font-bold ml-1">相簿管理</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setIsEditVehicleOpen(true)}
                className="flex-row items-center bg-white/10 px-2.5 py-1 rounded-full border border-white/20"
              >
                <Ionicons name="pencil-outline" size={12} color="#fff" />
                <Text className="text-[10px] font-mono text-white ml-1">編輯車輛</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDeleteVehicle}
                className="flex-row items-center bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20"
              >
                <Ionicons name="trash-outline" size={12} color="#ef4444" />
                <Text className="text-[10px] font-mono text-racing-red ml-1">刪除車輛</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 4 核心數據儀表 (2x2 Grid) */}
          <View className="flex-row flex-wrap gap-2.5">
            {/* 總花費 / 總擁有成本 */}
            <View className="flex-1 min-w-[45%]">
              <DoubleBezelCard innerClassName="p-3.5">
                <Text className="text-[10px] font-mono tracking-wider text-metal-400 uppercase">
                  TOTAL RECORDED COST
                </Text>
                <Text className="text-xl font-bold text-white font-mono mt-1">
                  ${costStats.operationalCost.toLocaleString()}
                </Text>
                <Text className="text-[10px] text-metal-500 mt-1" numberOfLines={1}>
                  {costStats.totalOwnershipCost !== null
                    ? `含車價總持有: $${costStats.totalOwnershipCost.toLocaleString()}`
                    : '未設定購車價格'}
                </Text>
              </DoubleBezelCard>
            </View>

            {/* 每公里運作成本 */}
            <View className="flex-1 min-w-[45%]">
              <DoubleBezelCard innerClassName="p-3.5">
                <Text className="text-[10px] font-mono tracking-wider text-metal-400 uppercase">
                  COST PER KM
                </Text>
                <Text className="text-xl font-bold text-racing-orange font-mono mt-1">
                  {averageCostPerKm !== null ? `$${averageCostPerKm}` : '--'}
                </Text>
                <Text className="text-[10px] text-metal-500 mt-1" numberOfLines={1}>
                  {ownershipCostPerKm !== null
                    ? `含車價: $${ownershipCostPerKm}/km`
                    : '運作公里攤提 (距基準)'}
                </Text>
              </DoubleBezelCard>
            </View>

            {/* 平均油耗 */}
            <View className="flex-1 min-w-[45%]">
              <DoubleBezelCard innerClassName="p-3.5">
                <Text className="text-[10px] font-mono tracking-wider text-metal-400 uppercase">
                  FUEL ECONOMY
                </Text>
                <Text className="text-xl font-bold text-racing-blue font-mono mt-1">
                  {fuelStats.latestEconomy
                    ? `${fuelStats.latestEconomy.kmPerLiter} km/L`
                    : '--'}
                </Text>
                <Text className="text-[10px] text-metal-500 mt-1">
                  {fuelStats.avgCostKm ? `平均 $${fuelStats.avgCostKm}/km` : '需至少兩筆加油'}
                </Text>
              </DoubleBezelCard>
            </View>

            {/* 改裝品項數量 */}
            <View className="flex-1 min-w-[45%]">
              <DoubleBezelCard innerClassName="p-3.5">
                <Text className="text-[10px] font-mono tracking-wider text-metal-400 uppercase">
                  MODIFICATIONS
                </Text>
                <Text className="text-xl font-bold text-white font-mono mt-1">
                  {modifications.length} <Text className="text-xs text-metal-400 font-normal">ITEMS</Text>
                </Text>
                <Text className="text-[10px] text-metal-500 mt-1">
                  改裝投資 ${costStats.modificationPurchaseCost.toLocaleString()}
                </Text>
              </DoubleBezelCard>
            </View>
          </View>

          {/* 車輛多維度成本分析卡片 (P1-2 Cost Analytics Card - 非破壞性掛載) */}
          <View className="mt-4">
            <CostAnalyticsCard vehicleId={activeVehicle.id} />
          </View>

          {/* 保養提醒警示條 (Reminders Telemetry Bar) */}
          <View className="mt-6">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <Text className="text-xs font-mono tracking-wider text-metal-400 uppercase mr-2">
                  MAINTENANCE RADAR
                </Text>
                {alertCounts.overdue > 0 && (
                  <View className="bg-racing-red/20 px-2 py-0.5 rounded-full border border-racing-red/40 mr-1.5">
                    <Text className="text-[10px] font-mono text-racing-red font-bold">
                      {alertCounts.overdue} OVERDUE
                    </Text>
                  </View>
                )}
                {alertCounts.dueSoon > 0 && (
                  <View className="bg-racing-amber/20 px-2 py-0.5 rounded-full border border-racing-amber/40">
                    <Text className="text-[10px] font-mono text-racing-amber font-bold">
                      {alertCounts.dueSoon} DUE SOON
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {reminderEvals.length === 0 ? (
              <DoubleBezelCard innerClassName="py-6 items-center">
                <Ionicons name="shield-checkmark-outline" size={32} color="#10b981" />
                <Text className="text-metal-400 text-xs mt-2 font-mono">所有保養項目均在健康範圍內</Text>
              </DoubleBezelCard>
            ) : (
              <View className="gap-2">
                {reminderEvals.slice(0, 5).map(({ reminder, evaluation }) => {
                  let statusBg = 'bg-white/[0.02] border-white/10';
                  let badgeColor = 'text-racing-green';
                  let badgeBg = 'bg-racing-green/10 border-racing-green/30';

                  if (evaluation.status === 'OVERDUE') {
                    statusBg = 'bg-racing-red/[0.05] border-racing-red/30';
                    badgeColor = 'text-racing-red';
                    badgeBg = 'bg-racing-red/20 border-racing-red/40';
                  } else if (evaluation.status === 'DUE_SOON') {
                    statusBg = 'bg-racing-amber/[0.05] border-racing-amber/30';
                    badgeColor = 'text-racing-amber';
                    badgeBg = 'bg-racing-amber/20 border-racing-amber/40';
                  }

                  return (
                    <View
                      key={reminder.id}
                      className={`p-3.5 rounded-xl border flex-row items-center justify-between ${statusBg}`}
                    >
                      <View className="flex-1 mr-3">
                        <Text className="text-white font-semibold text-sm">
                          {reminder.item_name}
                        </Text>
                        <Text className="text-[11px] text-metal-400 font-mono mt-0.5">
                          {evaluation.remainingMileage !== null
                            ? `剩餘 ${evaluation.remainingMileage.toLocaleString()} km`
                            : ''}
                          {evaluation.remainingMileage !== null && evaluation.remainingDays !== null ? ' · ' : ''}
                          {evaluation.remainingDays !== null
                            ? `剩餘 ${evaluation.remainingDays} 天`
                            : ''}
                        </Text>
                      </View>

                      <View className="flex-row items-center gap-1.5">
                        <TouchableOpacity
                          onPress={() => handleCompleteReminder(reminder.id, reminder.item_name)}
                          className="px-2 py-1 bg-white/10 rounded border border-white/20"
                        >
                          <Text className="text-[10px] font-mono text-white font-semibold">完成保養</Text>
                        </TouchableOpacity>

                        <View className={`px-2 py-1 rounded-md border ${badgeBg}`}>
                          <Text className={`text-[10px] font-mono font-bold ${badgeColor}`}>
                            {evaluation.status}
                          </Text>
                        </View>

                        <TouchableOpacity
                          onPress={() => handleDeleteReminder(reminder.id, reminder.item_name)}
                          className="p-1 rounded bg-red-500/10 border border-red-500/20"
                        >
                          <Ionicons name="trash-outline" size={13} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* 車輛歷程履歷中樞 (Vehicle Fleet Records - 改裝/保養/加油 Tab 切換) */}
          <View className="mt-6">
            {/* 分頁切換器 (Tab Switcher) */}
            <View className="flex-row bg-zinc-950 p-1 rounded-2xl border border-white/10 mb-4">
              <TouchableOpacity
                onPress={() => setActiveRecordTab('modifications')}
                className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5 ${
                  activeRecordTab === 'modifications'
                    ? 'bg-purple-500/20 border border-purple-500/40'
                    : ''
                }`}
              >
                <MaterialCommunityIcons
                  name="car-wrench"
                  size={14}
                  color={activeRecordTab === 'modifications' ? '#c084fc' : '#71717a'}
                />
                <Text
                  className={`text-xs font-mono font-bold ${
                    activeRecordTab === 'modifications' ? 'text-purple-300' : 'text-metal-400'
                  }`}
                >
                  改裝 ({modifications.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveRecordTab('maintenance')}
                className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5 ${
                  activeRecordTab === 'maintenance'
                    ? 'bg-racing-orange/20 border border-racing-orange/40'
                    : ''
                }`}
              >
                <Ionicons
                  name="construct-outline"
                  size={14}
                  color={activeRecordTab === 'maintenance' ? '#ff6b00' : '#71717a'}
                />
                <Text
                  className={`text-xs font-mono font-bold ${
                    activeRecordTab === 'maintenance' ? 'text-racing-orange' : 'text-metal-400'
                  }`}
                >
                  保修 ({maintenanceRecords.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveRecordTab('refuels')}
                className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5 ${
                  activeRecordTab === 'refuels'
                    ? 'bg-racing-blue/20 border border-racing-blue/40'
                    : ''
                }`}
              >
                <Ionicons
                  name="water-outline"
                  size={14}
                  color={activeRecordTab === 'refuels' ? '#007aff' : '#71717a'}
                />
                <Text
                  className={`text-xs font-mono font-bold ${
                    activeRecordTab === 'refuels' ? 'text-racing-blue' : 'text-metal-400'
                  }`}
                >
                  加油 ({refuels.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* TAB 1: 改裝清單 */}
            {activeRecordTab === 'modifications' && (
              <View>
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center">
                    <Text className="text-xs font-mono tracking-wider text-metal-400 uppercase mr-2">
                      MODIFICATIONS LIST (改裝清單)
                    </Text>
                    <View className="bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/40">
                      <Text className="text-[10px] font-mono text-purple-300 font-bold">
                        {modifications.length} ITEMS
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => setIsAddModOpen(true)}
                    className="flex-row items-center bg-purple-500/15 px-2.5 py-1 rounded-full border border-purple-500/30"
                  >
                    <Ionicons name="add" size={13} color="#c084fc" />
                    <Text className="text-[11px] text-purple-300 font-bold ml-1 font-mono">
                      新增改裝
                    </Text>
                  </TouchableOpacity>
                </View>

                {modifications.length === 0 ? (
                  <DoubleBezelCard innerClassName="py-6 items-center">
                    <MaterialCommunityIcons name="car-wrench" size={32} color="#a855f7" />
                    <Text className="text-metal-400 text-xs mt-2 font-mono">
                      此車輛尚未登錄任何改裝品套件
                    </Text>
                  </DoubleBezelCard>
                ) : (
                  <View className="gap-2.5">
                    {modifications.map((mod) => {
                      const totalModCost =
                        (Number(mod.purchase_price) || 0) + (Number(mod.install_price) || 0);
                      return (
                        <View
                          key={mod.id}
                          className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02]"
                        >
                          <View className="flex-row items-start justify-between">
                            <View className="flex-1 mr-2">
                              <View className="flex-row items-center gap-2 mb-1">
                                <View className="px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/30">
                                  <Text className="text-[10px] font-mono text-purple-400 font-bold uppercase">
                                    {mod.category}
                                  </Text>
                                </View>
                                {mod.shop_name ? (
                                  <Text className="text-[10px] text-metal-500 font-mono" numberOfLines={1}>
                                    {mod.shop_name}
                                  </Text>
                                ) : null}
                              </View>

                              <Text className="text-white font-bold text-sm tracking-tight">
                                {mod.item_name}
                              </Text>

                              {(mod.brand || mod.model) && (
                                <Text className="text-[11px] text-metal-400 font-mono mt-0.5">
                                  {[mod.brand, mod.model].filter(Boolean).join(' · ')}
                                </Text>
                              )}
                            </View>

                            <View className="items-end">
                              <Text className="text-xs font-mono font-bold text-white">
                                ${totalModCost.toLocaleString()}
                              </Text>
                              <Text className="text-[9px] text-metal-500 font-mono">
                                {mod.install_date || mod.purchase_date || '未註記日期'}
                              </Text>
                            </View>
                          </View>

                          <View className="flex-row items-center justify-between mt-3 pt-2.5 border-t border-white/[0.06]">
                            <View className="flex-row items-center">
                              {mod.install_mileage !== null ? (
                                <Text className="text-[10px] font-mono text-metal-400">
                                  @{mod.install_mileage.toLocaleString()} KM
                                </Text>
                              ) : (
                                <Text className="text-[10px] font-mono text-metal-500">標準配置</Text>
                              )}
                            </View>

                            <View className="flex-row items-center gap-1.5">
                              <TouchableOpacity
                                onPress={() => setEditingMod(mod)}
                                className="px-2.5 py-1 bg-white/10 rounded-md border border-white/20 flex-row items-center"
                              >
                                <Ionicons name="pencil" size={11} color="#fff" />
                                <Text className="text-[10px] font-mono text-white ml-1 font-semibold">
                                  編輯
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                onPress={() => onNavigateToModDetail(mod.id)}
                                className="px-2.5 py-1 bg-purple-500/20 rounded-md border border-purple-500/40 flex-row items-center"
                              >
                                <MaterialCommunityIcons name="tune-vertical" size={11} color="#c084fc" />
                                <Text className="text-[10px] font-mono text-purple-300 ml-1 font-semibold">
                                  調校
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                onPress={() => handleDeleteMod(mod.id, mod.item_name)}
                                className="p-1 rounded-md bg-red-500/10 border border-red-500/20"
                              >
                                <Ionicons name="trash-outline" size={12} color="#ef4444" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* TAB 2: 保養維修 */}
            {activeRecordTab === 'maintenance' && (
              <View>
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center">
                    <Text className="text-xs font-mono tracking-wider text-metal-400 uppercase mr-2">
                      MAINTENANCE & REPAIR (保修履歷)
                    </Text>
                    <View className="bg-racing-orange/20 px-2 py-0.5 rounded-full border border-racing-orange/40">
                      <Text className="text-[10px] font-mono text-racing-orange font-bold">
                        {maintenanceRecords.length} LOGS
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => setIsAddMaintenanceOpen(true)}
                    className="flex-row items-center bg-racing-orange/15 px-2.5 py-1 rounded-full border border-racing-orange/30"
                  >
                    <Ionicons name="add" size={13} color="#ff6b00" />
                    <Text className="text-[11px] text-racing-orange font-bold ml-1 font-mono">
                      新增保修
                    </Text>
                  </TouchableOpacity>
                </View>

                {maintenanceRecords.length === 0 ? (
                  <DoubleBezelCard innerClassName="py-6 items-center">
                    <Ionicons name="construct-outline" size={32} color="#71717a" />
                    <Text className="text-metal-400 text-xs mt-2 font-mono">
                      此車輛尚未登錄任何保養或維修工單
                    </Text>
                  </DoubleBezelCard>
                ) : (
                  <View className="gap-2.5">
                    {maintenanceRecords.map((record) => {
                      const isRepair = record.record_type === 'repair';
                      return (
                        <View
                          key={record.id}
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
                                    {isRepair ? '維修故障' : '定期保養'}
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

                              {/* 工單照片縮圖列 */}
                              {(record as any).photos && (record as any).photos.length > 0 && (
                                <View className="flex-row items-center mt-2 space-x-1.5">
                                  {(record as any).photos.map((p: any, pIdx: number) => (
                                    <TouchableOpacity
                                      key={p.id}
                                      onPress={() => {
                                        const viewerImgs = (record as any).photos.map((photo: any) => ({
                                          uri: photo.url,
                                          title: `${record.item_name} · 工單照片`,
                                        }));
                                        setMaintenanceViewerImages(viewerImgs);
                                      }}
                                      className="w-9 h-9 rounded-lg overflow-hidden border border-white/20 mr-1.5"
                                    >
                                      <Image source={{ uri: p.url }} className="w-full h-full" resizeMode="cover" />
                                    </TouchableOpacity>
                                  ))}
                                  <Text className="text-[10px] text-metal-500 font-mono">
                                    共 {(record as any).photos.length} 張
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
                                onPress={() => setEditingMaintenance(record)}
                                className="px-2.5 py-1 bg-white/10 rounded-md border border-white/20 flex-row items-center"
                              >
                                <Ionicons name="pencil" size={11} color="#fff" />
                                <Text className="text-[10px] font-mono text-white ml-1 font-semibold">
                                  編輯
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                onPress={() => handleDeleteMaintenance(record.id, record.item_name)}
                                className="p-1 rounded-md bg-red-500/10 border border-red-500/20"
                              >
                                <Ionicons name="trash-outline" size={12} color="#ef4444" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* TAB 3: 加油日誌 */}
            {activeRecordTab === 'refuels' && (
              <View>
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center">
                    <Text className="text-xs font-mono tracking-wider text-metal-400 uppercase mr-2">
                      REFUEL LOGS (加油日誌)
                    </Text>
                    <View className="bg-racing-blue/20 px-2 py-0.5 rounded-full border border-racing-blue/40">
                      <Text className="text-[10px] font-mono text-racing-blue font-bold">
                        {refuels.length} LOGS
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => setIsAddRefuelOpen(true)}
                    className="flex-row items-center bg-racing-blue/15 px-2.5 py-1 rounded-full border border-racing-blue/30"
                  >
                    <Ionicons name="add" size={13} color="#007aff" />
                    <Text className="text-[11px] text-racing-blue font-bold ml-1 font-mono">
                      新增加油
                    </Text>
                  </TouchableOpacity>
                </View>

                {refuels.length === 0 ? (
                  <DoubleBezelCard innerClassName="py-6 items-center">
                    <Ionicons name="water-outline" size={32} color="#71717a" />
                    <Text className="text-metal-400 text-xs mt-2 font-mono">
                      此車輛尚未登錄任何加油日誌
                    </Text>
                  </DoubleBezelCard>
                ) : (
                  <View className="gap-2.5">
                    {refuels.map((refuel) => {
                      const fuelLabelMap: Record<string, string> = {
                        gasoline_98: '98 無鉛',
                        gasoline_95: '95 無鉛',
                        gasoline_92: '92 無鉛',
                        diesel: '超級柴油',
                        premium_diesel: '頂級柴油',
                        electric: '純電充電',
                        hybrid: '油電複合',
                        other: '其他油品',
                      };
                      const fuelLabel = fuelLabelMap[refuel.fuel_type] || refuel.fuel_type;

                      return (
                        <View
                          key={refuel.id}
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
                                onPress={() => setEditingRefuel(refuel)}
                                className="px-2.5 py-1 bg-white/10 rounded-md border border-white/20 flex-row items-center"
                              >
                                <Ionicons name="pencil" size={11} color="#fff" />
                                <Text className="text-[10px] font-mono text-white ml-1 font-semibold">
                                  編輯
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                onPress={() => handleDeleteRefuel(refuel.id, refuel.refuel_date)}
                                className="p-1 rounded-md bg-red-500/10 border border-red-500/20"
                              >
                                <Ionicons name="trash-outline" size={12} color="#ef4444" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* 快捷遙測記錄中樞 (Telemetry Action Deck - Visual Density: 7) */}
          <View className="mt-6">
            <Text className="text-xs font-mono tracking-wider text-metal-400 uppercase mb-3">
              TELEMETRY OPERATIONS (記錄發送)
            </Text>

            <View className="flex-row gap-2.5">
              <TouchableOpacity
                onPress={() => setIsAddRefuelOpen(true)}
                className="flex-1 bg-zinc-900/90 border border-racing-blue/40 p-3 rounded-2xl items-center"
              >
                <View className="w-8 h-8 rounded-full bg-racing-blue/20 items-center justify-center mb-1.5">
                  <Ionicons name="water" size={16} color="#007aff" />
                </View>
                <Text className="text-white font-mono font-bold text-xs">+ 加油</Text>
                <Text className="text-[10px] font-mono text-metal-500 mt-0.5">油耗記錄</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setIsAddMaintenanceOpen(true)}
                className="flex-1 bg-zinc-900/90 border border-racing-orange/40 p-3 rounded-2xl items-center"
              >
                <View className="w-8 h-8 rounded-full bg-racing-orange/20 items-center justify-center mb-1.5">
                  <Ionicons name="construct" size={16} color="#ff6b00" />
                </View>
                <Text className="text-white font-mono font-bold text-xs">+ 保修</Text>
                <Text className="text-[10px] font-mono text-metal-500 mt-0.5">工單履歷</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setIsAddReminderOpen(true)}
                className="flex-1 bg-zinc-900/90 border border-racing-amber/40 p-3 rounded-2xl items-center"
              >
                <View className="w-8 h-8 rounded-full bg-racing-amber/20 items-center justify-center mb-1.5">
                  <Ionicons name="pulse" size={16} color="#f59e0b" />
                </View>

                <Text className="text-white font-mono font-bold text-xs">+ 提醒</Text>
                <Text className="text-[10px] font-mono text-metal-500 mt-0.5">週期監測</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setIsAddModOpen(true)}
                className="flex-1 bg-zinc-900/90 border border-purple-500/40 p-3 rounded-2xl items-center"
              >
                <View className="w-8 h-8 rounded-full bg-purple-500/20 items-center justify-center mb-1.5">
                  <MaterialCommunityIcons name="car-wrench" size={16} color="#a855f7" />
                </View>
                <Text className="text-white font-mono font-bold text-xs">+ 改裝</Text>
                <Text className="text-[10px] font-mono text-metal-500 mt-0.5">套件入庫</Text>
              </TouchableOpacity>
            </View>
          </View>


          {/* 快速導航與操作按鈕 (Button-in-Button / Island CTA) */}
          <View className="mt-8 gap-3">
            {/* 導航至車輛時序牆 */}
            <TouchableOpacity
              onPress={() => onNavigateToTimeline(activeVehicle.id)}
              activeOpacity={0.88}
              className="rounded-full bg-racing-orange px-6 py-4 flex-row items-center justify-between shadow-lg"
            >
              <View>
                <Text className="text-black font-bold text-base tracking-tight">
                  進入愛車動態時間軸牆
                </Text>
                <Text className="text-black/70 text-[11px] font-medium">
                  即時串接 SQL View 混合動態流
                </Text>
              </View>

              {/* Nested Circle Icon (Button-in-Button) */}
              <View className="w-9 h-9 rounded-full bg-black/15 items-center justify-center">
                <Ionicons name="arrow-forward" size={18} color="#000" />
              </View>
            </TouchableOpacity>

            {/* 導航至改裝品詳細 (若有改裝品) */}
            {modifications.length > 0 && (
              <TouchableOpacity
                onPress={() => onNavigateToModDetail(modifications[0].id)}
                activeOpacity={0.88}
                className="rounded-full bg-white/[0.08] px-6 py-3.5 flex-row items-center justify-between border border-white/10"
              >
                <View>
                  <Text className="text-white font-semibold text-sm">
                    調校參數管理: {modifications[0].item_name}
                  </Text>
                  <Text className="text-metal-400 text-[11px]">
                    檢視通用設定參數與版本控制
                  </Text>
                </View>

                {/* Nested Circle Icon */}
                <View className="w-8 h-8 rounded-full bg-white/10 items-center justify-center">
                  <MaterialCommunityIcons name="tune-vertical" size={16} color="#fff" />
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* 業務 CRUD 模態窗群組 */}
      <AddVehicleModal
        visible={isAddVehicleOpen}
        onClose={() => setIsAddVehicleOpen(false)}
        onCreated={(newId) => setSelectedVehicleId(newId)}
      />

      {activeVehicle && (
        <>
          <EditVehicleModal
            visible={isEditVehicleOpen}
            vehicle={activeVehicle}
            onClose={() => setIsEditVehicleOpen(false)}
          />

          <AddRefuelModal
            visible={isAddRefuelOpen}
            vehicleId={activeVehicle.id}
            currentVehicleMileage={activeVehicle.current_mileage}
            onClose={() => setIsAddRefuelOpen(false)}
          />


          <AddMaintenanceModal
            visible={isAddMaintenanceOpen}
            vehicleId={activeVehicle.id}
            currentVehicleMileage={activeVehicle.current_mileage}
            onClose={() => setIsAddMaintenanceOpen(false)}
          />

          <AddReminderModal
            visible={isAddReminderOpen}
            vehicleId={activeVehicle.id}
            currentVehicleMileage={activeVehicle.current_mileage}
            onClose={() => setIsAddReminderOpen(false)}
          />

          <AddModificationModal
            visible={isAddModOpen}
            vehicleId={activeVehicle.id}
            currentVehicleMileage={activeVehicle.current_mileage}
            onClose={() => setIsAddModOpen(false)}
          />

          <EditModificationModal
            visible={!!editingMod}
            modification={editingMod}
            onClose={() => setEditingMod(null)}
          />

          <EditRefuelModal
            visible={!!editingRefuel}
            record={editingRefuel}
            onClose={() => setEditingRefuel(null)}
          />

          <EditMaintenanceModal
            visible={!!editingMaintenance}
            record={editingMaintenance}
            onClose={() => setEditingMaintenance(null)}
          />

          {/* 車輛專屬相簿管理 Modal */}
          <VehiclePhotoGalleryModal
            visible={isGalleryOpen}
            onClose={() => setIsGalleryOpen(false)}
            vehicleId={activeVehicle.id}
            vehicleName={`${activeVehicle.brand} ${activeVehicle.model}`}
          />

          {/* 保養紀錄工單照片大圖檢視 Modal */}
          {maintenanceViewerImages && (
            <ImageViewerModal
              visible={!!maintenanceViewerImages}
              onClose={() => setMaintenanceViewerImages(null)}
              images={maintenanceViewerImages}
            />
          )}
        </>
      )}
    </ScrollView>
  );
};

