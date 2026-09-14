import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DoubleBezelCard } from '../DoubleBezelCard';
import { ReminderRow } from '../../types/database';
import { ReminderCalculationResult } from '../../utils/calculators/reminderCalculator';

interface RemindersTabProps {
  reminderEvals: { reminder: ReminderRow; evaluation: ReminderCalculationResult }[];
  alertCounts: { overdue: number; dueSoon: number };
  onAddReminder: () => void;
  onCompleteReminder: (id: number, name: string) => void;
  onDeleteReminder: (id: number, name: string) => void;
}

export const RemindersTab: React.FC<RemindersTabProps> = ({
  reminderEvals,
  alertCounts,
  onAddReminder,
  onCompleteReminder,
  onDeleteReminder,
}) => {
  return (
    <View className="gap-4">
      {/* 頂部雷達狀態與新增按鈕 */}
      <View className="flex-row items-center justify-between">
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

        <TouchableOpacity
          onPress={onAddReminder}
          className="flex-row items-center bg-racing-amber/15 px-3 py-1.5 rounded-full border border-racing-amber/30"
        >
          <Ionicons name="add" size={14} color="#f59e0b" />
          <Text className="text-xs text-racing-amber font-bold ml-1 font-mono">
            新增提醒
          </Text>
        </TouchableOpacity>
      </View>

      {/* 完整提醒列表 */}
      {reminderEvals.length === 0 ? (
        <DoubleBezelCard innerClassName="py-8 items-center">
          <Ionicons name="shield-checkmark-outline" size={36} color="#10b981" />
          <Text className="text-metal-400 text-xs mt-2 font-mono">
            尚未設定任何週期性保養提醒，點擊右上角新增
          </Text>
        </DoubleBezelCard>
      ) : (
        <View className="gap-2.5">
          {reminderEvals.map(({ reminder, evaluation }) => {
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
                  {(reminder.interval_km || reminder.interval_months) && (
                    <Text className="text-[10px] text-metal-500 font-mono mt-1">
                      設定週期: {reminder.interval_km ? `${reminder.interval_km.toLocaleString()} km` : ''}
                      {reminder.interval_km && reminder.interval_months ? ' / ' : ''}
                      {reminder.interval_months ? `${reminder.interval_months} 個月` : ''}
                    </Text>
                  )}
                </View>

                <View className="flex-row items-center gap-1.5">
                  <TouchableOpacity
                    onPress={() => onCompleteReminder(reminder.id, reminder.item_name)}
                    className="px-2.5 py-1.5 bg-white/10 rounded-lg border border-white/20"
                  >
                    <Text className="text-[11px] font-mono text-white font-semibold">完成保養</Text>
                  </TouchableOpacity>

                  <View className={`px-2 py-1 rounded-md border ${badgeBg}`}>
                    <Text className={`text-[10px] font-mono font-bold ${badgeColor}`}>
                      {evaluation.status}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => onDeleteReminder(reminder.id, reminder.item_name)}
                    className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20"
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
  );
};
