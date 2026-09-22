import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { DoubleBezelCard } from '../DoubleBezelCard';
import { BilingualText } from '../common/BilingualText';
import { VehicleRow } from '../../types/database';
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
  onNavigateToAnalytics: () => void;
  onNavigateToTimeline: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  vehicle,
  costStats,
  averageCostPerKm,
  ownershipCostPerKm,
  fuelStats,
  modificationsCount,
  onNavigateToAnalytics,
  onNavigateToTimeline,
}) => {
  const { t } = useTranslation();

  return (
    <View className="gap-5">
      {/* 4 核心數據儀表 (2x2 Grid) - 採用 BilingualText 雙語並陳 */}
      <View className="flex-row flex-wrap gap-2.5">
        {/* 總花費 / 總擁有成本 */}
        <View className="flex-1 min-w-[45%]">
          <DoubleBezelCard innerClassName="p-3.5">
            <BilingualText
              translationKey="vehicle.overview.totalCost"
              titleClassName="text-sm font-bold text-white font-mono"
              subClassName="text-[9px] font-mono tracking-wider text-metal-400 uppercase"
            />
            <Text className="text-xl font-bold text-white font-mono mt-1">
              ${costStats.operationalCost.toLocaleString()}
            </Text>
            <Text className="text-[10px] text-metal-500 mt-1" numberOfLines={1}>
              {costStats.totalOwnershipCost !== null
                ? t('vehicle.overview.withPurchasePrice', { cost: costStats.totalOwnershipCost.toLocaleString() })
                : t('vehicle.overview.noPurchasePrice')}
            </Text>
          </DoubleBezelCard>
        </View>

        {/* 每公里運作成本 */}
        <View className="flex-1 min-w-[45%]">
          <DoubleBezelCard innerClassName="p-3.5">
            <BilingualText
              translationKey="vehicle.overview.costPerKm"
              titleClassName="text-sm font-bold text-racing-orange font-mono"
              subClassName="text-[9px] font-mono tracking-wider text-metal-400 uppercase"
            />
            <Text className="text-xl font-bold text-racing-orange font-mono mt-1">
              {averageCostPerKm !== null ? `$${averageCostPerKm}` : '--'}
            </Text>
            <Text className="text-[10px] text-metal-500 mt-1" numberOfLines={1}>
              {ownershipCostPerKm !== null
                ? t('vehicle.overview.ownershipPerKm', { cost: ownershipCostPerKm })
                : t('vehicle.overview.amortizedDistance')}
            </Text>
          </DoubleBezelCard>
        </View>

        {/* 平均油耗 */}
        <View className="flex-1 min-w-[45%]">
          <DoubleBezelCard innerClassName="p-3.5">
            <BilingualText
              translationKey="vehicle.overview.fuelEconomy"
              titleClassName="text-sm font-bold text-racing-blue font-mono"
              subClassName="text-[9px] font-mono tracking-wider text-metal-400 uppercase"
            />
            <Text className="text-xl font-bold text-racing-blue font-mono mt-1">
              {fuelStats.latestEconomy
                ? `${fuelStats.latestEconomy.kmPerLiter} km/L`
                : '--'}
            </Text>
            <Text className="text-[10px] text-metal-500 mt-1">
              {fuelStats.avgCostKm !== null
                ? t('vehicle.overview.avgFuelCostKm', { cost: fuelStats.avgCostKm })
                : t('vehicle.overview.needTwoRefuels')}
            </Text>
          </DoubleBezelCard>
        </View>

        {/* 改裝品項數量 */}
        <View className="flex-1 min-w-[45%]">
          <DoubleBezelCard innerClassName="p-3.5">
            <BilingualText
              translationKey="vehicle.overview.modifications"
              titleClassName="text-sm font-bold text-white font-mono"
              subClassName="text-[9px] font-mono tracking-wider text-metal-400 uppercase"
            />
            <Text className="text-xl font-bold text-white font-mono mt-1">
              {modificationsCount} <Text className="text-xs text-metal-400 font-normal">{t('vehicle.overview.items')}</Text>
            </Text>
            <Text className="text-[10px] text-metal-500 mt-1">
              {t('vehicle.overview.modInvestment', { cost: costStats.modificationPurchaseCost.toLocaleString() })}
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
              {t('vehicle.overview.analyticsHubTitle')}
            </Text>
          </View>
          <Text className="text-[11px] text-metal-400 font-mono">
            {t('vehicle.overview.analyticsHubDesc')}
          </Text>
        </View>
        <View className="flex-row items-center bg-racing-orange/15 px-3 py-1.5 rounded-full border border-racing-orange/30">
          <Text className="text-xs font-mono text-racing-orange font-bold mr-1">{t('vehicle.overview.viewAnalytics')}</Text>
          <Ionicons name="chevron-forward" size={14} color="#ff4d00" />
        </View>
      </TouchableOpacity>

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
                {t('vehicle.overview.enterTimeline')}
              </Text>
            </View>
            <Text className="text-black/70 text-[11px] font-medium">
              {t('vehicle.overview.timelineDesc')}
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
