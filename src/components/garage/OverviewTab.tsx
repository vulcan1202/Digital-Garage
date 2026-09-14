import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DoubleBezelCard } from '../DoubleBezelCard';
import { VehicleRow, ReminderRow } from '../../types/database';
import { ReminderCalculationResult } from '../../utils/calculators/reminderCalculator';
import { FuelEconomyResult } from '../../utils/calculators/fuelCalculator';

interface OverviewTabProps {
  vehicle: VehicleRow;
  costStats: {
    operationalCost: number;
    totalOwnershipCost: number | null;
    modificationPurchaseCost: number;
  };
  averageCostPerKm: number | null;
  ownershipCostPerKm: number | null;
  fuelStats: {
    latestEconomy: FuelEconomyResult | null;
    avgCostKm: number | null;
  };
  modificationsCount: number;
  reminderEvals: { reminder: ReminderRow; evaluation: ReminderCalculationResult }[];
  alertCounts: { overdue: number; dueSoon: number };
  onCompleteReminder: (id: number, name: string) => void;
  onNavigateToAnalytics: () => void;
  onNavigateToReminders: () => void;
  onNavigateToTimeline: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  vehicle,
  costStats,
  averageCostPerKm,
  ownershipCostPerKm,
  fuelStats,
  modificationsCount,
  reminderEvals,
  alertCounts,
  onCompleteReminder,
  onNavigateToAnalytics,
  onNavigateToReminders,
  onNavigateToTimeline,
}) => {
  return (
    <View className="gap-5">
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
              {fuelStats.avgCostKm !== null ? `平均 $${fuelStats.avgCostKm}/km` : '需至少兩筆加油'}
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
              {modificationsCount} <Text className="text-xs text-metal-400 font-normal">ITEMS</Text>
            </Text>
            <Text className="text-[10px] text-metal-500 mt-1">
              改裝投資 ${costStats.modificationPurchaseCost.toLocaleString()}
            </Text>
          </DoubleBezelCard>
        </View>
      </View>

      {/* 成本分析精簡卡片 (Cost Summary CTA) */}
      <TouchableOpacity
        onPress={onNavigateToAnalytics}
        activeOpacity={0.88}
        className="rounded-2xl bg-zinc-900/80 p-4 border border-white/10 flex-row items-center justify-between"
      >
        <View className="flex-1 mr-3">
          <View className="flex-row items-center gap-1.5 mb-1">
            <Ionicons name="bar-chart" size={14} color="#ff4d00" />
            <Text className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              多維度成本分析中樞
            </Text>
          </View>
          <Text className="text-[11px] text-metal-400 font-mono">
            查看月度連續支出趨勢 (6M/12M/24M)、工單細分類別佔比與持有成本攤提
          </Text>
        </View>
        <View className="flex-row items-center bg-racing-orange/15 px-3 py-1.5 rounded-full border border-racing-orange/30">
          <Text className="text-xs font-mono text-racing-orange font-bold mr-1">查看分析</Text>
          <Ionicons name="chevron-forward" size={14} color="#ff4d00" />
        </View>
      </TouchableOpacity>

      {/* 保養提醒雷達摘要 (Maintenance Radar Preview) */}
      <View>
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

          <TouchableOpacity onPress={onNavigateToReminders}>
            <Text className="text-[11px] font-mono text-metal-400">全部 ({reminderEvals.length}) &gt;</Text>
          </TouchableOpacity>
        </View>

        {reminderEvals.length === 0 ? (
          <DoubleBezelCard innerClassName="py-5 items-center">
            <Ionicons name="shield-checkmark-outline" size={28} color="#10b981" />
            <Text className="text-metal-400 text-xs mt-1.5 font-mono">所有保養項目均在健康範圍內</Text>
          </DoubleBezelCard>
        ) : (
          <View className="gap-2">
            {reminderEvals.slice(0, 3).map(({ reminder, evaluation }) => {
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
                  className={`p-3 rounded-xl border flex-row items-center justify-between ${statusBg}`}
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
                      onPress={() => onCompleteReminder(reminder.id, reminder.item_name)}
                      className="px-2 py-1 bg-white/10 rounded border border-white/20"
                    >
                      <Text className="text-[10px] font-mono text-white font-semibold">完成</Text>
                    </TouchableOpacity>

                    <View className={`px-2 py-1 rounded-md border ${badgeBg}`}>
                      <Text className={`text-[10px] font-mono font-bold ${badgeColor}`}>
                        {evaluation.status}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* 最近動態導航至全螢幕時間軸 (Recent Activity Preview & Timeline CTA) */}
      <View>
        <TouchableOpacity
          onPress={onNavigateToTimeline}
          activeOpacity={0.88}
          className="rounded-2xl bg-racing-orange px-5 py-4 flex-row items-center justify-between shadow-lg"
        >
          <View>
            <View className="flex-row items-center gap-1.5 mb-0.5">
              <Ionicons name="time" size={16} color="#000" />
              <Text className="text-black font-bold text-base tracking-tight">
                進入愛車動態時間軸牆
              </Text>
            </View>
            <Text className="text-black/70 text-[11px] font-medium">
              即時串接 SQL View 混合動態流（加油、保養、改裝）
            </Text>
          </View>

          <View className="w-8 h-8 rounded-full bg-black/15 items-center justify-center">
            <Ionicons name="arrow-forward" size={16} color="#000" />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};
