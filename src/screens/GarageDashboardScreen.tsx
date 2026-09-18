import React, { useState, useMemo, useEffect } from 'react';
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
import { useVehicles, useDeleteVehicle, useVehiclePhotos } from '../hooks/queries/useVehicles';
import { useRefuels, useDeleteRefuel } from '../hooks/queries/useFuel';
import { useReminders, useCompleteReminder, useDeleteReminder } from '../hooks/queries/useReminders';
import { useRecurringStatus } from '../hooks/queries/useRecurringExpenses';
import { useModifications, useDeleteModification } from '../hooks/queries/useModifications';
import { useMaintenanceRecords, useDeleteMaintenanceRecord } from '../hooks/queries/useMaintenance';
import { calculateVehicleTotalCost, calculateAverageCostPerKm } from '../utils/calculators/costCalculator';
import { calculateAverageFuelCostPerKm, calculateFuelEconomy } from '../utils/calculators/fuelCalculator';
import { evaluateReminderStatus } from '../utils/calculators/reminderCalculator';
import { ModificationRow, RefuelRow, MaintenanceRecordRow, MaintenanceRecordType } from '../types/database';

// 模態窗群組
import { AddVehicleModal } from '../components/modals/AddVehicleModal';
import { EditVehicleModal } from '../components/modals/EditVehicleModal';
import { AddRefuelModal } from '../components/modals/AddRefuelModal';
import { EditRefuelModal } from '../components/modals/EditRefuelModal';
import { AddMaintenanceModal } from '../components/modals/AddMaintenanceModal';
import { EditMaintenanceModal } from '../components/modals/EditMaintenanceModal';
import { AddReminderModal } from '../components/modals/AddReminderModal';
import { AddRecurringExpenseModal } from '../components/modals/AddRecurringExpenseModal';
import { AddModificationModal } from '../components/modals/AddModificationModal';
import { EditModificationModal } from '../components/modals/EditModificationModal';
import { VehiclePhotoGalleryModal } from '../components/modals/VehiclePhotoGalleryModal';
import { ImageViewerModal } from '../components/modals/ImageViewerModal';

// 6 大車輛資訊分頁 Hub Tabs
import { OverviewTab } from '../components/garage/OverviewTab';
import { RecordsTab } from '../components/garage/RecordsTab';
import { ModificationsTab } from '../components/garage/ModificationsTab';
import { PhotosHubTab } from '../components/garage/PhotosHubTab';
import { AnalyticsTab } from '../components/garage/AnalyticsTab';
import { RemindersTab } from '../components/garage/RemindersTab';
import { networkMonitor } from '../services/networkMonitor';
import { syncQueue } from '../services/syncQueue';

export type VehicleHubTab = 'overview' | 'records' | 'modifications' | 'photos' | 'analytics' | 'reminders';

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

  // 當前選取的 Hub Tab (預設 overview)
  const [activeTab, setActiveTab] = useState<VehicleHubTab>('overview');

  // Modals state
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [isEditVehicleOpen, setIsEditVehicleOpen] = useState(false);
  const [isAddRefuelOpen, setIsAddRefuelOpen] = useState(false);
  const [isAddMaintenanceOpen, setIsAddMaintenanceOpen] = useState(false);
  const [initialMaintType, setInitialMaintType] = useState<MaintenanceRecordType>('maintenance');
  const [isAddReminderOpen, setIsAddReminderOpen] = useState(false);
  const [isAddRecurringOpen, setIsAddRecurringOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<Array<{ uri: string; title?: string }> | null>(null);

  const [isAddModOpen, setIsAddModOpen] = useState(false);
  const [editingMod, setEditingMod] = useState<ModificationRow | null>(null);
  const [editingRefuel, setEditingRefuel] = useState<RefuelRow | null>(null);
  const [editingMaintenance, setEditingMaintenance] = useState<MaintenanceRecordRow | null>(null);

  // 離線與同步狀態管理
  const [isOnline, setIsOnline] = useState(networkMonitor.getIsOnline());
  const [syncQueueItems, setSyncQueueItems] = useState(syncQueue.getQueue());
  const [failedSyncItems, setFailedSyncItems] = useState(syncQueue.getFailedMutations());

  useEffect(() => {
    const unsubNet = networkMonitor.addListener((online) => {
      setIsOnline(online);
    });
    const unsubQueue = syncQueue.subscribe(() => {
      setSyncQueueItems(syncQueue.getQueue());
      setFailedSyncItems(syncQueue.getFailedMutations());
    });
    return () => {
      unsubNet();
      unsubQueue();
    };
  }, []);

  const handleStatusBadgePress = () => {
    if (failedSyncItems.length > 0) {
      const details = failedSyncItems
        .slice(0, 5)
        .map((item, idx) => `${idx + 1}. [${item.type}] ${item.errorMessage || '伺服器驗證未通過'}`)
        .join('\n');

      Alert.alert(
        '離線同步異常警報',
        `偵測到 ${failedSyncItems.length} 筆操作同步失敗（已隔離避免卡死）：\n\n${details}${
          failedSyncItems.length > 5 ? '\n...及其他項目' : ''
        }`,
        [
          {
            text: '全部重試',
            onPress: () => {
              failedSyncItems.forEach((item) => syncQueue.retryFailedMutation(item.id));
            },
          },
          {
            text: '清除警報',
            style: 'destructive',
            onPress: () => syncQueue.clearFailedMutations(),
          },
          { text: '稍後處理', style: 'cancel' },
        ]
      );
    } else if (!isOnline) {
      Alert.alert(
        '離線模式',
        `目前處於離線狀態。\n待同步佇列：${syncQueueItems.length} 筆操作\n恢復連線後將自動於背景上傳。`
      );
    } else if (syncQueueItems.length > 0) {
      Alert.alert('佇列同步中', `正在同步 ${syncQueueItems.length} 筆離線操作至車庫雲端伺服器...`);
    } else {
      Alert.alert('雲端連線正常', '已與數位車庫後端伺服器建立正常連線，資料即時同步中。');
    }
  };

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
  const { data: recurringStatuses = [] } = useRecurringStatus(activeId);
  const { data: modifications = [] } = useModifications(activeId);
  const { data: vehiclePhotos = [] } = useVehiclePhotos(activeId);

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

  // 開啟保養或維修 modal
  const handleOpenAddMaintenance = (type: MaintenanceRecordType = 'maintenance') => {
    setInitialMaintType(type);
    setIsAddMaintenanceOpen(true);
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
          <TouchableOpacity
            onPress={handleStatusBadgePress}
            activeOpacity={0.7}
            className={`flex-row items-center px-2.5 py-1 rounded-full border ${
              failedSyncItems.length > 0
                ? 'bg-red-500/15 border-red-500/40'
                : syncQueueItems.length > 0
                ? 'bg-cyan-500/15 border-cyan-500/40'
                : isOnline
                ? 'bg-white/[0.04] border-white/10'
                : 'bg-amber-500/15 border-amber-500/40'
            }`}
          >
            <View
              className={`w-2 h-2 rounded-full mr-1.5 ${
                failedSyncItems.length > 0
                  ? 'bg-red-500'
                  : syncQueueItems.length > 0
                  ? 'bg-cyan-400'
                  : isOnline
                  ? 'bg-racing-green'
                  : 'bg-amber-400'
              }`}
            />
            <Text
              className={`text-[11px] font-mono font-bold ${
                failedSyncItems.length > 0
                  ? 'text-red-400'
                  : syncQueueItems.length > 0
                  ? 'text-cyan-300'
                  : isOnline
                  ? 'text-metal-300'
                  : 'text-amber-300'
              }`}
            >
              {failedSyncItems.length > 0
                ? `ERR (${failedSyncItems.length})`
                : syncQueueItems.length > 0
                ? `SYNC (${syncQueueItems.length})`
                : isOnline
                ? 'ONLINE'
                : 'OFFLINE'}
            </Text>
          </TouchableOpacity>

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

      {/* 車輛主資訊區塊 */}
      {activeVehicle && (
        <View className="px-5 mt-5">
          {/* 車輛抬頭識別列 (Vehicle Header Bar) */}
          <View className="flex-row items-center justify-between gap-3 mb-3.5">
            {/* 左側：ACTIVE COCKPIT、車種/車牌 Badges、車輛型號 */}
            <View className="flex-1 pr-2">
              <View className="flex-row flex-wrap items-center gap-1.5 mb-1">
                <Text className="text-[11px] font-mono tracking-wider text-metal-400 uppercase font-semibold">
                  ACTIVE COCKPIT
                </Text>
                {/* 車型 Badge */}
                <View className="bg-zinc-800/90 border border-white/10 px-1.5 py-0.5 rounded flex-row items-center gap-1">
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
                  <View className="bg-white/10 border border-white/20 px-1.5 py-0.5 rounded">
                    <Text className="text-[10px] font-mono font-bold text-white tracking-wider">
                      {activeVehicle.license_plate}
                    </Text>
                  </View>
                )}
              </View>
              <Text className="text-[11px] font-mono text-metal-400" numberOfLines={1}>
                {activeVehicle.brand} {activeVehicle.model}
                {activeVehicle.engine_displacement_cc ? ` · ${activeVehicle.engine_displacement_cc} c.c.` : ''}
                {activeVehicle.fuel_type ? ` · ${activeVehicle.fuel_type}` : ''}
              </Text>
            </View>

            {/* 右側：動作按鈕群組 (flex-shrink-0 確保按鈕絕不被擠壓或重疊) */}
            <View className="flex-row items-center gap-1.5 flex-shrink-0">
              <TouchableOpacity
                onPress={() => setIsEditVehicleOpen(true)}
                className="flex-row items-center bg-white/10 px-2.5 py-1.5 rounded-full border border-white/20"
                activeOpacity={0.7}
              >
                <Ionicons name="pencil-outline" size={11} color="#fff" />
                <Text className="text-[10px] font-mono text-white ml-1">編輯愛車</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDeleteVehicle}
                className="flex-row items-center bg-red-500/10 px-2.5 py-1.5 rounded-full border border-red-500/20"
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={11} color="#ef4444" />
                <Text className="text-[10px] font-mono text-racing-red ml-1">刪除愛車</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 全域常駐快捷發送列 (Quick Action Deck - Visual Density 6) */}
          <View className="mb-4 bg-zinc-900/70 p-2 rounded-xl border border-white/10">
            <View className="flex-row gap-1.5">
              <TouchableOpacity
                onPress={() => setIsAddRefuelOpen(true)}
                className="flex-1 bg-racing-blue/15 border border-racing-blue/30 py-1.5 rounded-lg items-center"
                activeOpacity={0.75}
              >
                <Ionicons name="water" size={14} color="#007aff" />
                <Text className="text-white font-mono font-bold text-[10px] mt-0.5">+加油</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleOpenAddMaintenance('maintenance')}
                className="flex-1 bg-racing-orange/15 border border-racing-orange/30 py-1.5 rounded-lg items-center"
                activeOpacity={0.75}
              >
                <Ionicons name="construct" size={14} color="#ff6b00" />
                <Text className="text-white font-mono font-bold text-[10px] mt-0.5">+保養</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleOpenAddMaintenance('repair')}
                className="flex-1 bg-racing-red/15 border border-racing-red/30 py-1.5 rounded-lg items-center"
                activeOpacity={0.75}
              >
                <Ionicons name="build" size={14} color="#ef4444" />
                <Text className="text-white font-mono font-bold text-[10px] mt-0.5">+維修</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setIsAddModOpen(true)}
                className="flex-1 bg-purple-500/15 border border-purple-500/30 py-1.5 rounded-lg items-center"
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons name="car-wrench" size={14} color="#c084fc" />
                <Text className="text-white font-mono font-bold text-[10px] mt-0.5">+改裝</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setIsAddReminderOpen(true)}
                className="flex-1 bg-racing-amber/15 border border-racing-amber/30 py-1.5 rounded-lg items-center"
                activeOpacity={0.75}
              >
                <Ionicons name="pulse" size={14} color="#f59e0b" />
                <Text className="text-white font-mono font-bold text-[10px] mt-0.5">+提醒</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 車輛座艙 6 大分頁導航 (Vehicle Hub Tabs - Visual Density 6) */}
          <View className="flex-row bg-zinc-950 p-1 rounded-xl border border-white/10 mb-4">
            {/* Tab 1: 總覽 Overview */}
            <TouchableOpacity
              onPress={() => setActiveTab('overview')}
              className={`flex-1 py-1.5 rounded-lg items-center justify-center ${
                activeTab === 'overview' ? 'bg-racing-orange/20 border border-racing-orange/40' : ''
              }`}
            >
              <Text
                className={`text-[11px] font-mono font-bold ${
                  activeTab === 'overview' ? 'text-racing-orange' : 'text-metal-400'
                }`}
              >
                總覽
              </Text>
            </TouchableOpacity>

            {/* Tab 2: 歷程 Records */}
            <TouchableOpacity
              onPress={() => setActiveTab('records')}
              className={`flex-1 py-1.5 rounded-lg items-center justify-center ${
                activeTab === 'records' ? 'bg-racing-blue/20 border border-racing-blue/40' : ''
              }`}
            >
              <Text
                className={`text-[11px] font-mono font-bold ${
                  activeTab === 'records' ? 'text-racing-blue' : 'text-metal-400'
                }`}
              >
                歷程 ({refuels.length + maintenanceRecords.length})
              </Text>
            </TouchableOpacity>

            {/* Tab 3: 改裝 Modifications */}
            <TouchableOpacity
              onPress={() => setActiveTab('modifications')}
              className={`flex-1 py-1.5 rounded-lg items-center justify-center ${
                activeTab === 'modifications' ? 'bg-purple-500/20 border border-purple-500/40' : ''
              }`}
            >
              <Text
                className={`text-[11px] font-mono font-bold ${
                  activeTab === 'modifications' ? 'text-purple-300' : 'text-metal-400'
                }`}
              >
                改裝 ({modifications.length})
              </Text>
            </TouchableOpacity>

            {/* Tab 4: 媒體 Photos */}
            <TouchableOpacity
              onPress={() => setActiveTab('photos')}
              className={`flex-1 py-1.5 rounded-lg items-center justify-center ${
                activeTab === 'photos' ? 'bg-amber-500/20 border border-amber-500/40' : ''
              }`}
            >
              <Text
                className={`text-[11px] font-mono font-bold ${
                  activeTab === 'photos' ? 'text-amber-300' : 'text-metal-400'
                }`}
              >
                媒體 ({vehiclePhotos.length})
              </Text>
            </TouchableOpacity>

            {/* Tab 5: 分析 Analytics */}
            <TouchableOpacity
              onPress={() => setActiveTab('analytics')}
              className={`flex-1 py-1.5 rounded-lg items-center justify-center ${
                activeTab === 'analytics' ? 'bg-emerald-500/20 border border-emerald-500/40' : ''
              }`}
            >
              <Text
                className={`text-[11px] font-mono font-bold ${
                  activeTab === 'analytics' ? 'text-emerald-400' : 'text-metal-400'
                }`}
              >
                分析
              </Text>
            </TouchableOpacity>

            {/* Tab 6: 提醒 Reminders */}
            <TouchableOpacity
              onPress={() => setActiveTab('reminders')}
              className={`flex-1 py-1.5 rounded-lg items-center justify-center ${
                activeTab === 'reminders' ? 'bg-racing-amber/20 border border-racing-amber/40' : ''
              }`}
            >
              <Text
                className={`text-[11px] font-mono font-bold ${
                  activeTab === 'reminders' ? 'text-racing-amber' : 'text-metal-400'
                }`}
              >
                提醒 ({reminders.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* 6 大分頁內容渲染區塊 */}
          {activeTab === 'overview' && (
            <OverviewTab
              vehicle={activeVehicle}
              costStats={costStats}
              averageCostPerKm={averageCostPerKm}
              ownershipCostPerKm={ownershipCostPerKm}
              fuelStats={fuelStats}
              modificationsCount={modifications.length}
              reminderEvals={reminderEvals}
              alertCounts={alertCounts}
              onCompleteReminder={handleCompleteReminder}
              onNavigateToAnalytics={() => setActiveTab('analytics')}
              onNavigateToReminders={() => setActiveTab('reminders')}
              onNavigateToTimeline={() => onNavigateToTimeline(activeVehicle.id)}
            />
          )}

          {activeTab === 'records' && (
            <RecordsTab
              refuels={refuels}
              maintenanceRecords={maintenanceRecords}
              onAddRefuel={() => setIsAddRefuelOpen(true)}
              onAddMaintenance={() => handleOpenAddMaintenance('maintenance')}
              onAddRepair={() => handleOpenAddMaintenance('repair')}
              onEditRefuel={(r) => setEditingRefuel(r)}
              onDeleteRefuel={handleDeleteRefuel}
              onEditMaintenance={(m) => setEditingMaintenance(m)}
              onDeleteMaintenance={handleDeleteMaintenance}
              onPreviewImages={(imgs) => setViewerImages(imgs)}
            />
          )}

          {activeTab === 'modifications' && (
            <ModificationsTab
              modifications={modifications}
              onAddModification={() => setIsAddModOpen(true)}
              onEditModification={(m) => setEditingMod(m)}
              onDeleteModification={handleDeleteMod}
              onNavigateToModDetail={onNavigateToModDetail}
            />
          )}

          {activeTab === 'photos' && (
            <PhotosHubTab
              vehiclePhotos={vehiclePhotos}
              maintenanceRecords={maintenanceRecords}
              modifications={modifications}
              onOpenVehicleGallery={() => setIsGalleryOpen(true)}
              onPreviewImages={(imgs) => setViewerImages(imgs)}
              onNavigateToModDetail={onNavigateToModDetail}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsTab vehicleId={activeVehicle.id} />
          )}

          {activeTab === 'reminders' && (
            <RemindersTab
              vehicle={activeVehicle}
              reminderEvals={reminderEvals}
              alertCounts={alertCounts}
              recurringStatuses={recurringStatuses}
              onAddReminder={() => setIsAddReminderOpen(true)}
              onAddRecurringExpense={() => setIsAddRecurringOpen(true)}
              onCompleteReminder={handleCompleteReminder}
              onDeleteReminder={handleDeleteReminder}
            />
          )}
        </View>
      )}

      {/* 業務 CRUD 模態窗群組 (保留既有 10 大 Modal 原生結構與生命週期) */}
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
            initialRecordType={initialMaintType}
            onClose={() => setIsAddMaintenanceOpen(false)}
          />

          <AddReminderModal
            visible={isAddReminderOpen}
            vehicleId={activeVehicle.id}
            currentVehicleMileage={activeVehicle.current_mileage}
            onClose={() => setIsAddReminderOpen(false)}
          />

          <AddRecurringExpenseModal
            visible={isAddRecurringOpen}
            vehicle={activeVehicle}
            onClose={() => setIsAddRecurringOpen(false)}
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

          {/* 全螢幕大圖檢視 Modal */}
          {viewerImages && (
            <ImageViewerModal
              visible={!!viewerImages}
              onClose={() => setViewerImages(null)}
              images={viewerImages}
            />
          )}
        </>
      )}
    </ScrollView>
  );
};
