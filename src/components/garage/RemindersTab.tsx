import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { DoubleBezelCard } from '../DoubleBezelCard';
import { ReminderRow, VehicleWithCover } from '../../types/database';
import { ReminderCalculationResult } from '../../utils/calculators/reminderCalculator';
import { RecurringStatusSummary, RECURRING_CATEGORY_LABELS, RecurringExpenseCategory } from '../../types/recurringExpense';

interface RemindersTabProps {
  vehicle: VehicleWithCover | null;
  reminderEvals: { reminder: ReminderRow; evaluation: ReminderCalculationResult }[];
  alertCounts: { overdue: number; dueSoon: number };
  recurringStatuses?: RecurringStatusSummary[];
  onAddReminder: () => void;
  onAddRecurringExpense: () => void;
  onCompleteReminder: (id: number, name: string) => void;
  onDeleteReminder: (id: number, name: string) => void;
}

const CATEGORY_ICONS: Record<RecurringExpenseCategory, keyof typeof Ionicons.glyphMap> = {
  license_tax: 'document-text-outline',
  road_maintenance_fee: 'speedometer-outline',
  inspection: 'construct-outline',
  compulsory_insurance: 'shield-checkmark-outline',
  liability_insurance: 'shield-outline',
  other: 'receipt-outline',
};

export const RemindersTab: React.FC<RemindersTabProps> = ({
  vehicle,
  reminderEvals,
  alertCounts,
  recurringStatuses = [],
  onAddReminder,
  onAddRecurringExpense,
  onCompleteReminder,
  onDeleteReminder,
}) => {
  const { t } = useTranslation();
  const recurringAlertCounts = React.useMemo(() => {
    let overdue = 0;
    let dueSoon = 0;
    recurringStatuses.forEach((s) => {
      if (s.status === 'overdue') overdue++;
      else if (s.status === 'due_soon') dueSoon++;
    });
    return { overdue, dueSoon };
  }, [recurringStatuses]);

  return (
    <View className="gap-4">
      {/* 週期規費與法定排程 (RECURRING EXPENSES & COMPLIANCE) */}
      <View className="gap-3 mb-2">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Text className="text-xs font-mono tracking-wider text-metal-400 uppercase mr-2">
              {t('recurring.complianceTitle')}
            </Text>
            {recurringAlertCounts.overdue > 0 && (
              <View className="bg-racing-red/20 px-2 py-0.5 rounded-full border border-racing-red/40 mr-1.5">
                <Text className="text-[10px] font-mono text-racing-red font-bold">
                  {recurringAlertCounts.overdue} OVERDUE
                </Text>
              </View>
            )}
            {recurringAlertCounts.dueSoon > 0 && (
              <View className="bg-racing-amber/20 px-2 py-0.5 rounded-full border border-racing-amber/40">
                <Text className="text-[10px] font-mono text-racing-amber font-bold">
                  {recurringAlertCounts.dueSoon} DUE SOON
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            onPress={onAddRecurringExpense}
            className="flex-row items-center bg-cyan-500/15 px-3 py-1.5 rounded-full border border-cyan-500/30"
          >
            <Ionicons name="add" size={14} color="#06b6d4" />
            <Text className="text-xs text-cyan-400 font-bold ml-1 font-mono">
              {t('recurring.addExpense')}
            </Text>
          </TouchableOpacity>
        </View>

        {recurringStatuses.length === 0 ? (
          <DoubleBezelCard innerClassName="py-6 items-center">
            <Ionicons name="calendar-outline" size={32} color="#06b6d4" />
            <Text className="text-metal-400 text-xs mt-2 font-mono text-center">
              尚無週期規費紀錄，點擊右上角登記牌照稅、公路養管費或定檢
            </Text>
          </DoubleBezelCard>
        ) : (
          <View className="gap-2.5">
            {recurringStatuses.map((item) => {
              let statusBg = 'bg-white/[0.02] border-white/10';
              let badgeColor = 'text-metal-400';
              let badgeBg = 'bg-white/5 border-white/10';
              let statusText = t('recurring.status.unset');

              if (item.status === 'overdue') {
                statusBg = 'bg-racing-red/[0.05] border-racing-red/30';
                badgeColor = 'text-racing-red';
                badgeBg = 'bg-racing-red/20 border-racing-red/40';
                statusText = t('recurring.status.overdue');
              } else if (item.status === 'due_soon') {
                statusBg = 'bg-racing-amber/[0.05] border-racing-amber/30';
                badgeColor = 'text-racing-amber';
                badgeBg = 'bg-racing-amber/20 border-racing-amber/40';
                statusText = t('recurring.status.dueSoon');
              } else if (item.status === 'good') {
                badgeColor = 'text-racing-green';
                badgeBg = 'bg-racing-green/10 border-racing-green/30';
                statusText = t('recurring.status.good');
              }

              const iconName = CATEGORY_ICONS[item.category] || 'receipt-outline';
              const label = t(`recurring.labels.${item.category}` as any, { defaultValue: item.title });

              return (
                <View
                  key={item.category}
                  className={`p-3.5 rounded-xl border flex-row items-center justify-between ${statusBg}`}
                >
                  <View className="flex-row items-center flex-1 mr-2">
                    <View className="w-8 h-8 rounded-lg bg-white/5 items-center justify-center mr-2.5 border border-white/10">
                      <Ionicons name={iconName} size={16} color="#06b6d4" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-semibold text-sm" numberOfLines={1}>
                        {label}
                      </Text>
                      {item.coverage_end_date ? (
                        <Text className="text-[11px] text-metal-400 font-mono mt-0.5">
                          有效至 {item.coverage_end_date}
                          {item.days_remaining !== null && item.days_remaining !== undefined && (
                            <Text
                              className={
                                item.days_remaining < 0
                                  ? 'text-racing-red font-bold'
                                  : item.days_remaining <= 30
                                  ? 'text-racing-amber font-bold'
                                  : 'text-racing-green'
                              }
                            >
                              {item.days_remaining < 0
                                ? ` · 逾期 ${Math.abs(item.days_remaining)} 天`
                                : ` · 剩餘 ${item.days_remaining} 天`}
                            </Text>
                          )}
                        </Text>
                      ) : (
                        <Text className="text-[11px] text-metal-500 font-mono mt-0.5">
                          尚未登記最新繳納與覆蓋期
                        </Text>
                      )}
                    </View>
                  </View>

                  <View className={`px-2 py-1 rounded-md border ${badgeBg}`}>
                    <Text className={`text-[10px] font-mono font-bold ${badgeColor}`}>
                      {statusText}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* 分隔線 */}
      <View className="h-[1px] bg-white/10 my-1" />

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
            {t('common.actions.add')}
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
