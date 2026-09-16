import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ModificationSettingSetRow, ModificationSettingRow } from '../../types/database';
import { compareSettingSets, DiffStatus } from '../../utils/calculators/settingComparator';

interface CompareSettingSetsModalProps {
  visible: boolean;
  settingSets: Array<ModificationSettingSetRow & { settings: ModificationSettingRow[] }>;
  initialSetAId?: number;
  initialSetBId?: number;
  onClose: () => void;
}

export const CompareSettingSetsModal: React.FC<CompareSettingSetsModalProps> = ({
  visible,
  settingSets,
  initialSetAId,
  initialSetBId,
  onClose,
}) => {
  // 預設 A: initialSetAId 或第 1 組；預設 B: initialSetBId 或第 2 組
  const defaultA = initialSetAId || (settingSets.length > 0 ? settingSets[0].id : 0);
  const defaultB = initialSetBId || (settingSets.length > 1 ? settingSets[1].id : defaultA);

  const [selectedAId, setSelectedAId] = useState<number>(defaultA);
  const [selectedBId, setSelectedBId] = useState<number>(defaultB);

  // 同步外部 initial 傳入
  React.useEffect(() => {
    if (visible && settingSets.length > 0) {
      if (initialSetAId && settingSets.some((s) => s.id === initialSetAId)) {
        setSelectedAId(initialSetAId);
      } else {
        setSelectedAId(settingSets[0].id);
      }

      if (initialSetBId && settingSets.some((s) => s.id === initialSetBId)) {
        setSelectedBId(initialSetBId);
      } else if (settingSets.length > 1) {
        setSelectedBId(settingSets[1].id);
      } else {
        setSelectedBId(settingSets[0].id);
      }
    }
  }, [visible, initialSetAId, initialSetBId, settingSets]);

  const setA = useMemo(() => settingSets.find((s) => s.id === selectedAId) || null, [settingSets, selectedAId]);
  const setB = useMemo(() => settingSets.find((s) => s.id === selectedBId) || null, [settingSets, selectedBId]);

  const compareResult = useMemo(() => {
    return compareSettingSets(setA?.settings || [], setB?.settings || []);
  }, [setA, setB]);

  const getBadgeStyle = (status: DiffStatus) => {
    switch (status) {
      case 'UNCHANGED':
        return {
          bg: 'bg-zinc-800/80',
          border: 'border-white/10',
          text: 'text-metal-400',
          label: '相同',
        };
      case 'CHANGED':
        return {
          bg: 'bg-racing-orange/15',
          border: 'border-racing-orange/40',
          text: 'text-racing-orange',
          label: '已變更',
        };
      case 'ADDED':
        return {
          bg: 'bg-racing-green/15',
          border: 'border-racing-green/40',
          text: 'text-racing-green',
          label: '新增',
        };
      case 'REMOVED':
        return {
          bg: 'bg-racing-red/15',
          border: 'border-racing-red/40',
          text: 'text-racing-red',
          label: '移除',
        };
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/85 justify-end">
        <View className="bg-garage-card rounded-t-3xl border-t border-white/10 p-5 max-h-[92%]">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-3.5 border-b border-white/[0.08]">
            <View>
              <Text className="text-[10px] font-mono tracking-[0.2em] text-racing-blue uppercase font-bold">
                TELEMETRY COMPARATOR
              </Text>
              <Text className="text-xl font-bold text-white tracking-tight mt-0.5">
                版本設定比較 (Diff)
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-white/10 items-center justify-center"
            >
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* 版本選擇列 (A 基準 vs B 對象) */}
          <View className="mt-3.5 bg-zinc-900/80 p-3 rounded-2xl border border-white/10">
            <View className="flex-row items-center justify-between gap-2">
              {/* Version A 選擇 */}
              <View className="flex-1">
                <Text className="text-[10px] font-mono text-metal-400 mb-1 uppercase font-bold">
                  基準版本 (A)
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {settingSets.map((s) => {
                    const isSelected = s.id === selectedAId;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => setSelectedAId(s.id)}
                        className={`px-2.5 py-1.5 rounded-lg border ${
                          isSelected
                            ? 'bg-racing-blue/20 border-racing-blue'
                            : 'bg-black/40 border-white/10'
                        }`}
                      >
                        <Text
                          className={`text-xs font-mono font-bold ${
                            isSelected ? 'text-racing-blue' : 'text-metal-300'
                          }`}
                          numberOfLines={1}
                        >
                          {s.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View className="pt-3">
                <Ionicons name="swap-horizontal" size={18} color="#71717a" />
              </View>

              {/* Version B 選擇 */}
              <View className="flex-1">
                <Text className="text-[10px] font-mono text-metal-400 mb-1 uppercase font-bold">
                  比較版本 (B)
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {settingSets.map((s) => {
                    const isSelected = s.id === selectedBId;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => setSelectedBId(s.id)}
                        className={`px-2.5 py-1.5 rounded-lg border ${
                          isSelected
                            ? 'bg-racing-orange/20 border-racing-orange'
                            : 'bg-black/40 border-white/10'
                        }`}
                      >
                        <Text
                          className={`text-xs font-mono font-bold ${
                            isSelected ? 'text-racing-orange' : 'text-metal-300'
                          }`}
                          numberOfLines={1}
                        >
                          {s.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </View>

          {/* 比對統計指標列 */}
          <View className="flex-row items-center justify-between mt-3 px-1">
            <View className="flex-row items-center gap-2">
              <View className="flex-row items-center bg-zinc-800/80 px-2 py-0.5 rounded border border-white/10">
                <Text className="text-[10px] font-mono text-metal-400">
                  相同: {compareResult.stats.unchangedCount}
                </Text>
              </View>
              <View className="flex-row items-center bg-racing-orange/15 px-2 py-0.5 rounded border border-racing-orange/30">
                <Text className="text-[10px] font-mono text-racing-orange font-bold">
                  變更: {compareResult.stats.changedCount}
                </Text>
              </View>
              <View className="flex-row items-center bg-racing-green/15 px-2 py-0.5 rounded border border-racing-green/30">
                <Text className="text-[10px] font-mono text-racing-green font-bold">
                  新增: {compareResult.stats.addedCount}
                </Text>
              </View>
              <View className="flex-row items-center bg-racing-red/15 px-2 py-0.5 rounded border border-racing-red/30">
                <Text className="text-[10px] font-mono text-racing-red font-bold">
                  移除: {compareResult.stats.removedCount}
                </Text>
              </View>
            </View>

            <Text className="text-[10px] font-mono text-metal-500">
              共 {compareResult.stats.totalParams} 項參數
            </Text>
          </View>

          {/* 完全相同提示 Banner */}
          {compareResult.isIdentical && compareResult.stats.totalParams > 0 && (
            <View className="mt-3 bg-racing-green/10 border border-racing-green/30 p-3 rounded-xl flex-row items-center justify-center">
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text className="text-racing-green font-mono font-bold text-xs ml-1.5">
                兩個版本設定完全相同
              </Text>
            </View>
          )}

          {/* 參數差異列表 */}
          <ScrollView showsVerticalScrollIndicator={false} className="mt-3 mb-4">
            {compareResult.diffs.length === 0 ? (
              <View className="py-12 items-center justify-center">
                <MaterialCommunityIcons name="tune-vertical-variant" size={36} color="#3f3f46" />
                <Text className="text-metal-500 font-mono text-xs mt-2">
                  所選版本皆無設定參數
                </Text>
              </View>
            ) : (
              <View className="space-y-2">
                {compareResult.diffs.map((diff) => {
                  const badge = getBadgeStyle(diff.status);
                  return (
                    <View
                      key={diff.name}
                      className="bg-zinc-900/60 p-3 rounded-xl border border-white/[0.08]"
                    >
                      <View className="flex-row items-center justify-between mb-1.5">
                        <Text className="text-white font-bold text-sm font-mono flex-1 mr-2" numberOfLines={1}>
                          {diff.name}
                        </Text>
                        <View className={`px-2 py-0.5 rounded border ${badge.bg} ${badge.border}`}>
                          <Text className={`text-[10px] font-mono font-bold ${badge.text}`}>
                            {badge.label}
                          </Text>
                        </View>
                      </View>

                      {/* 雙版本數值對比視圖 */}
                      <View className="flex-row items-center justify-between pt-1 border-t border-white/[0.04]">
                        {/* A 數值 */}
                        <View className="flex-1">
                          <Text className="text-[10px] font-mono text-metal-500 mb-0.5">
                            {setA?.name || '版本 A'}
                          </Text>
                          <Text className="text-metal-300 font-mono text-xs">
                            {diff.valueA !== null ? `${diff.valueA} ${diff.unitA || ''}` : '— (無)'}
                          </Text>
                        </View>

                        <Ionicons name="arrow-forward" size={14} color="#71717a" />

                        {/* B 數值 */}
                        <View className="flex-1 items-end">
                          <Text className="text-[10px] font-mono text-metal-500 mb-0.5">
                            {setB?.name || '版本 B'}
                          </Text>
                          <Text
                            className={`font-mono text-xs font-bold ${
                              diff.status === 'CHANGED'
                                ? 'text-racing-orange'
                                : diff.status === 'ADDED'
                                ? 'text-racing-green'
                                : diff.status === 'REMOVED'
                                ? 'text-racing-red'
                                : 'text-metal-300'
                            }`}
                          >
                            {diff.valueB !== null ? `${diff.valueB} ${diff.unitB || ''}` : '— (已移除)'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
