import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { DoubleBezelCard } from '../DoubleBezelCard';
import { useCostAnalytics } from '../../hooks/queries/useCostAnalytics';

interface CostAnalyticsCardProps {
  vehicleId: number;
}

export const CostAnalyticsCard: React.FC<CostAnalyticsCardProps> = ({ vehicleId }) => {
  const { t } = useTranslation();
  const [selectedMonths, setSelectedMonths] = useState<number>(12);
  const { data: analytics, isLoading, isError } = useCostAnalytics(vehicleId, selectedMonths);

  if (isLoading) {
    return (
      <DoubleBezelCard innerClassName="p-4 items-center justify-center min-h-[160px]">
        <ActivityIndicator color="#ff4d00" size="small" />
        <Text className="text-xs font-mono text-metal-400 mt-2">
          {t('analytics.loading')}
        </Text>
      </DoubleBezelCard>
    );
  }

  if (isError || !analytics) {
    return null; // 若讀取失敗或無資料時安靜降級，不影響主儀表顯示
  }

  const {
    total_operational_cost,
    total_ownership_cost,
    cost_per_km,
    fuel_cost_per_km,
    total_distance_km,
    category_breakdown,
    monthly_trend,
  } = analytics;

  // 計算分類佔比
  const opTotal = total_operational_cost > 0 ? total_operational_cost : 1; // 避免除以零
  const fuelPct = Math.round((category_breakdown.fuel / opTotal) * 100);
  const maintPct = Math.round((category_breakdown.maintenance / opTotal) * 100);
  const repairPct = Math.round((category_breakdown.repair / opTotal) * 100);
  const modPct = Math.max(0, 100 - fuelPct - maintPct - repairPct);

  // 取得月度最高支出以做比例換算
  const maxMonthly = Math.max(...monthly_trend.map((p) => p.total), 1);

  return (
    <DoubleBezelCard innerClassName="p-4">
      {/* 標題與月份範圍切換 */}
      <View className="flex-row items-center justify-between mb-3.5 pb-2.5 border-b border-white/[0.06]">
        <View className="flex-row items-center gap-2">
          <View className="w-2 h-2 rounded-full bg-racing-orange" />
          <Text className="text-xs font-mono font-bold tracking-wider text-metal-200 uppercase">
            {t('analytics.costAnalytics')}
          </Text>
        </View>
        <View className="flex-row items-center gap-1 bg-white/[0.05] p-0.5 rounded-lg border border-white/[0.08]">
          {[6, 12, 24].map((m) => {
            const isSelected = selectedMonths === m;
            return (
              <TouchableOpacity
                key={m}
                onPress={() => setSelectedMonths(m)}
                className={`px-2 py-0.5 rounded ${isSelected ? 'bg-racing-orange' : 'bg-transparent'}`}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-[10px] font-mono font-bold ${
                    isSelected ? 'text-black' : 'text-metal-400'
                  }`}
                >
                  {m}M
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 關鍵指標網格 (營運花費 / 總擁有成本 / 每公里攤提) */}
      <View className="flex-row gap-2 mb-4">
        {/* 營運持有花費 */}
        <View className="flex-1 bg-white/[0.02] p-2.5 rounded-xl border border-white/[0.04]">
          <Text className="text-[10px] font-mono text-metal-400 uppercase">
            {t('analytics.totalOperationalCost')}
          </Text>
          <Text className="text-sm font-bold text-white font-mono mt-0.5" numberOfLines={1}>
            ${Math.round(total_operational_cost).toLocaleString()}
          </Text>
          <Text className="text-[9px] font-mono text-metal-500 mt-0.5">
            {t('analytics.operationalCostSubtitle')}
          </Text>
        </View>

        {/* 總擁有成本 (TCO) */}
        <View className="flex-1 bg-white/[0.02] p-2.5 rounded-xl border border-white/[0.04]">
          <Text className="text-[10px] font-mono text-metal-400 uppercase">
            {t('analytics.totalTco')}
          </Text>
          <Text
            className={`text-sm font-bold font-mono mt-0.5 ${
              total_ownership_cost !== null ? 'text-racing-blue' : 'text-metal-500'
            }`}
            numberOfLines={1}
          >
            {total_ownership_cost !== null
              ? `$${Math.round(total_ownership_cost).toLocaleString()}`
              : t('vehicle.overview.noPurchasePrice')}
          </Text>
          <Text className="text-[9px] font-mono text-metal-500 mt-0.5">
            {t('analytics.tcoSubtitle')}
          </Text>
        </View>

        {/* 每公里成本 */}
        <View className="flex-1 bg-white/[0.02] p-2.5 rounded-xl border border-white/[0.04]">
          <Text className="text-[10px] font-mono text-metal-400 uppercase">
            {t('analytics.costPerKm')}
          </Text>
          <Text
            className={`text-sm font-bold font-mono mt-0.5 ${
              cost_per_km !== null ? 'text-emerald-400' : 'text-metal-500'
            }`}
            numberOfLines={1}
          >
            {cost_per_km !== null ? `$${cost_per_km}/km` : '--'}
          </Text>
          <Text className="text-[9px] font-mono text-metal-500 mt-0.5" numberOfLines={1}>
            {fuel_cost_per_km !== null
              ? `${t('analytics.fuelCostPrefix')} $${fuel_cost_per_km}`
              : t('analytics.noMileageDiff')}
          </Text>
        </View>
      </View>

      {/* 四大維度費用佔比色條 (Stacked Progress Bar) */}
      <View className="mb-4">
        <View className="flex-row items-center justify-between mb-1.5">
          <Text className="text-[10px] font-mono text-metal-400 uppercase">
            {t('analytics.categoryStructure')}
          </Text>
          <Text className="text-[10px] font-mono text-metal-500">
            {total_distance_km > 0
              ? t('analytics.accumulatedDistance', { distance: total_distance_km.toLocaleString() })
              : t('analytics.baseMileage')}
          </Text>
        </View>

        {/* 堆疊比例條 */}
        <View className="h-2 w-full bg-zinc-800 rounded-full flex-row overflow-hidden border border-white/10">
          {total_operational_cost > 0 ? (
            <>
              {fuelPct > 0 && <View style={{ width: `${fuelPct}%` }} className="h-full bg-amber-400" />}
              {maintPct > 0 && <View style={{ width: `${maintPct}%` }} className="h-full bg-blue-500" />}
              {repairPct > 0 && <View style={{ width: `${repairPct}%` }} className="h-full bg-red-500" />}
              {modPct > 0 && <View style={{ width: `${modPct}%` }} className="h-full bg-purple-500" />}
            </>
          ) : (
            <View className="w-full h-full bg-white/10" />
          )}
        </View>

        {/* 標籤圖例 */}
        <View className="flex-row flex-wrap items-center justify-between mt-2.5 pt-1">
          {/* 加油 */}
          <View className="flex-row items-center gap-1.5 min-w-[22%]">
            <View className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <Text className="text-[10px] font-mono text-metal-300">
              {t('fuel.title')} ${Math.round(category_breakdown.fuel).toLocaleString()}
            </Text>
          </View>

          {/* 保養 */}
          <View className="flex-row items-center gap-1.5 min-w-[22%]">
            <View className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <Text className="text-[10px] font-mono text-metal-300">
              {t('maintenance.title')} ${Math.round(category_breakdown.maintenance).toLocaleString()}
            </Text>
          </View>

          {/* 維修 */}
          <View className="flex-row items-center gap-1.5 min-w-[22%]">
            <View className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <Text className="text-[10px] font-mono text-metal-300">
              {t('maintenance.types.repair')} ${Math.round(category_breakdown.repair).toLocaleString()}
            </Text>
          </View>

          {/* 改裝 */}
          <View className="flex-row items-center gap-1.5 min-w-[22%]">
            <View className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <Text className="text-[10px] font-mono text-metal-300">
              {t('modifications.title')} ${Math.round(category_breakdown.modification).toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      {/* 連續月份月度趨勢直方圖 (Zero-Filled Monthly Trend) */}
      <View className="mt-1 pt-3 border-t border-white/[0.05]">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-[10px] font-mono text-metal-400 uppercase">
            {t('analytics.monthlyTrend')} ({selectedMonths}M)
          </Text>
          <Text className="text-[9px] font-mono text-metal-500">
            {t('analytics.highestMonthly', { cost: Math.round(maxMonthly).toLocaleString() })}
          </Text>
        </View>

        {/* 垂直條列分佈 */}
        <View className="flex-row items-end justify-between h-20 px-1 pt-2">
          {monthly_trend.map((point) => {
            const heightPct = Math.max(6, Math.round((point.total / maxMonthly) * 100));
            const hasExpense = point.total > 0;
            // 顯示簡短月份，例如 "09"
            const monthLabel = point.year_month.split('-')[1];

            return (
              <View key={point.year_month} className="flex-1 items-center mx-0.5">
                <View
                  style={{ height: `${heightPct}%` }}
                  className={`w-full rounded-t-sm ${
                    hasExpense
                      ? 'bg-racing-orange/80 border-t border-racing-orange'
                      : 'bg-white/[0.04]'
                  }`}
                />
                <Text className="text-[8px] font-mono text-metal-500 mt-1" numberOfLines={1}>
                  {monthLabel}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </DoubleBezelCard>
  );
};
