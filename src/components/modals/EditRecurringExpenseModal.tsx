import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useUpdateRecurringExpenseMutation } from '../../hooks/queries/useRecurringExpenses';
import { RecurringExpenseCategory } from '../../types/recurringExpense';
import { deriveInspectionWindow, addMonthsClamped, formatYMD, parseYMD } from '../../utils/calculators/recurringCalculator';
import { useKeyboardBottomInset } from '../../hooks/useKeyboardBottomInset';
import { RecurringExpenseRow } from '../../types/database';
import { DatePickerInput } from '../common/DatePickerInput';

interface EditRecurringExpenseModalProps {
  visible: boolean;
  record: RecurringExpenseRow | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const CATEGORIES: { key: RecurringExpenseCategory; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { key: 'license_tax', icon: 'card-text-outline' },
  { key: 'road_maintenance_fee', icon: 'road-variant' },
  { key: 'inspection', icon: 'shield-check-outline' },
  { key: 'compulsory_insurance', icon: 'shield-car' },
  { key: 'liability_insurance', icon: 'shield-account' },
  { key: 'other', icon: 'receipt' },
];

export const EditRecurringExpenseModal: React.FC<EditRecurringExpenseModalProps> = ({
  visible,
  record,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const vehicleId = record ? record.vehicle_id : 0;
  const updateMutation = useUpdateRecurringExpenseMutation(vehicleId);

  const [category, setCategory] = useState<RecurringExpenseCategory>('license_tax');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidDate, setPaidDate] = useState('');
  const [coverageStartDate, setCoverageStartDate] = useState('');
  const [coverageEndDate, setCoverageEndDate] = useState('');
  const [nextInspectionDate, setNextInspectionDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rawKeyboardInset = useKeyboardBottomInset();
  const androidKeyboardInset = Platform.OS === 'android' ? rawKeyboardInset : 0;

  useEffect(() => {
    if (visible && record) {
      const cat = record.category || 'other';
      const coverageEnd = record.coverage_end_date ? record.coverage_end_date.substring(0, 10) : '';

      setCategory(cat);
      setTitle(record.title || '');
      setAmount(record.amount != null ? String(record.amount) : '');
      setPaidDate(record.paid_date ? record.paid_date.substring(0, 10) : '');
      setCoverageStartDate(record.coverage_start_date ? record.coverage_start_date.substring(0, 10) : '');
      setCoverageEndDate(coverageEnd);
      setNotes(record.notes || '');

      // 定期檢驗：資料庫僅存 coverage_end_date，需回推「下次定檢日」= coverage_end_date 往前 1 個月
      if (cat === 'inspection' && coverageEnd) {
        const parsedEnd = parseYMD(coverageEnd);
        if (parsedEnd) {
          const nextObj = addMonthsClamped(parsedEnd.year, parsedEnd.month, parsedEnd.day, -1);
          setNextInspectionDate(formatYMD(nextObj.year, nextObj.month, nextObj.day));
        } else {
          setNextInspectionDate('');
        }
      } else {
        setNextInspectionDate('');
      }
    }
  }, [visible, record]);

  // 下次定檢日變更時，前後各 1 個月的寬限期由系統自動計算
  const handleNextInspectionDateChange = (dateStr: string) => {
    setNextInspectionDate(dateStr);
    const window = deriveInspectionWindow(dateStr);
    setCoverageStartDate(window.coverageStartDate);
    setCoverageEndDate(window.coverageEndDate);
  };

  // 牌照稅 / 公路養管費：鎖定整年度，繳費日變動時依繳費日所在年重新計算 1/1 ~ 12/31
  const handleAnnualPaidDateChange = (dateStr: string) => {
    setPaidDate(dateStr);
    const year = dateStr.trim() ? parseInt(dateStr.trim().substring(0, 4), 10) : NaN;
    if (!isNaN(year)) {
      setCoverageStartDate(`${year}-01-01`);
      setCoverageEndDate(`${year}-12-31`);
    }
  };

  if (!record) return null;

  const handleSubmit = async () => {
    if (isSubmitting || updateMutation.isPending) return;

    if (!title.trim()) {
      Alert.alert(t('common.status.error'), t('recurring.validation.titleRequired'));
      return;
    }

    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum < 0) {
      Alert.alert(t('common.status.error'), t('recurring.validation.amountInvalid'));
      return;
    }

    if (!paidDate.trim() || !coverageStartDate.trim() || !coverageEndDate.trim()) {
      Alert.alert(t('common.status.error'), t('recurring.validation.dateRequired'));
      return;
    }

    if (coverageEndDate < coverageStartDate) {
      Alert.alert(t('common.status.error'), t('recurring.validation.dateLogicError'));
      return;
    }

    setIsSubmitting(true);
    try {
      await updateMutation.mutateAsync({
        id: record.id,
        data: {
          category,
          title: title.trim(),
          amount: amtNum,
          paid_date: paidDate.trim(),
          coverage_start_date: coverageStartDate.trim(),
          coverage_end_date: coverageEndDate.trim(),
          notes: notes.trim() ? notes.trim() : null,
        },
      });

      Alert.alert(t('common.status.success'), t('recurring.validation.updateSuccess', { name: title.trim() }));
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('recurring.validation.saveFailed');
      Alert.alert(t('common.status.error'), msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormLocked = isSubmitting || updateMutation.isPending;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/80"
      >
        <View
          style={{ paddingBottom: Math.max(androidKeyboardInset, 20) }}
          className="bg-zinc-900 border-t border-white/10 rounded-t-3xl max-h-[90%] overflow-hidden"
        >
          {/* Header */}
          <View className="px-5 py-4 border-b border-white/[0.08] flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="w-8 h-8 rounded-lg bg-racing-orange/20 items-center justify-center border border-racing-orange/40">
                <Ionicons name="pencil" size={16} color="#ff6b00" />
              </View>
              <View>
                <Text className="text-white font-bold text-base">{t('recurring.fields.editExpense')}</Text>
                <Text className="text-metal-400 text-xs font-mono">#{record.id}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} disabled={isFormLocked} className="p-1">
              <Ionicons name="close" size={22} color="#888" />
            </TouchableOpacity>
          </View>

          <ScrollView className="px-5 py-3" showsVerticalScrollIndicator={false}>
            {/* 類別選擇器 */}
            <Text className="text-metal-400 text-xs font-mono mb-2 uppercase tracking-wider">
              {t('recurring.fields.categoriesHeader')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <View className="flex-row gap-2">
                {CATEGORIES.map((c) => {
                  const isSelected = category === c.key;
                  return (
                    <TouchableOpacity
                      key={c.key}
                      onPress={() => setCategory(c.key)}
                      disabled={isFormLocked}
                      className={`px-3 py-2 rounded-xl border flex-row items-center gap-1.5 ${
                        isSelected
                          ? 'bg-racing-orange/20 border-racing-orange'
                          : 'bg-zinc-950 border-white/10'
                      }`}
                    >
                      <MaterialCommunityIcons
                        name={c.icon}
                        size={16}
                        color={isSelected ? '#ff6b00' : '#888'}
                      />
                      <Text
                        className={`text-xs font-mono ${
                          isSelected ? 'text-racing-orange font-bold' : 'text-metal-400'
                        }`}
                      >
                        {t(`recurring.labels.${c.key}` as any, { defaultValue: c.key })}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* 標題與金額 */}
            <View className="gap-3 mb-4">
              <View>
                <Text className="text-metal-400 text-xs font-mono mb-1">
                  {t('recurring.fields.title')} *
                </Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder={t('recurring.fields.titlePlaceholder')}
                  placeholderTextColor="#666"
                  editable={!isFormLocked}
                  className="bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm"
                />
              </View>

              <View>
                <Text className="text-metal-400 text-xs font-mono mb-1">
                  {t('recurring.fields.amount')} *
                </Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  editable={!isFormLocked}
                  className="bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm"
                />
              </View>
            </View>

            {/* 依類別區分日期輸入欄位 */}
            {category === 'inspection' ? (
              <>
                {/* 此次檢驗日（不論是否逾期，實際受檢日） */}
                <View className="mb-4">
                  <DatePickerInput
                    label={t('recurring.inspectionDetails.thisInspectionDate')}
                    required
                    value={paidDate}
                    onChange={setPaidDate}
                    maximumDate={new Date()}
                  />
                </View>

                {/* 下次定檢日（行照蓋印） */}
                <View className="mb-4">
                  <DatePickerInput
                    label={t('recurring.inspectionDetails.nextInspectionDate')}
                    required
                    value={nextInspectionDate}
                    onChange={handleNextInspectionDateChange}
                  />
                </View>

                {/* 法定檢驗寬限期即時提示卡片（前後各 1 個月，系統自動計算，不可編輯） */}
                <View className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-3 mb-4 flex-row items-center gap-2.5">
                  <Ionicons name="calendar-outline" size={18} color="#06b6d4" />
                  <View className="flex-1">
                    <Text className="text-white text-xs font-medium">
                      {t('recurring.inspectionDetails.gracePeriodHeader')}
                    </Text>
                    <Text className="text-cyan-400 text-[11px] font-mono mt-0.5">
                      {t('recurring.inspectionDetails.gracePeriodDesc', {
                        start: coverageStartDate,
                        end: coverageEndDate,
                      })}
                    </Text>
                  </View>
                </View>
              </>
            ) : category === 'license_tax' || category === 'road_maintenance_fee' ? (
              <>
                {/* 牌照稅 / 公路養管費：僅需輸入繳費日期，年度效期由系統鎖定 */}
                <View className="mb-4">
                  <DatePickerInput
                    label={t('recurring.fields.paidDateLabel')}
                    required
                    value={paidDate}
                    onChange={handleAnnualPaidDateChange}
                    maximumDate={new Date()}
                  />
                </View>

                {/* 年度效期即時提示卡片（系統自動鎖定整年度，不可編輯） */}
                <View className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-3 mb-4 flex-row items-center gap-2.5">
                  <Ionicons name="calendar-outline" size={18} color="#06b6d4" />
                  <View className="flex-1">
                    <Text className="text-white text-xs font-medium">
                      {t('recurring.annualDetails.coverageHeader')}
                    </Text>
                    <Text className="text-cyan-400 text-[11px] font-mono mt-0.5">
                      {t('recurring.annualDetails.coverageDesc', {
                        start: coverageStartDate,
                        end: coverageEndDate,
                      })}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                {/* 繳納日期 */}
                <View className="mb-4">
                  <DatePickerInput
                    label={t('recurring.fields.paidDateLabel')}
                    required
                    value={paidDate}
                    onChange={setPaidDate}
                    maximumDate={new Date()}
                  />
                </View>

                {/* 生效涵蓋起訖日 */}
                <View className="flex-row gap-3 mb-4">
                  <DatePickerInput
                    label={t('recurring.fields.coverageStartDate')}
                    required
                    value={coverageStartDate}
                    onChange={setCoverageStartDate}
                    containerClassName="flex-1"
                  />

                  <DatePickerInput
                    label={t('recurring.fields.coverageEndDate')}
                    required
                    value={coverageEndDate}
                    onChange={setCoverageEndDate}
                    containerClassName="flex-1"
                  />
                </View>
              </>
            )}

            {/* 備註 */}
            <View className="mb-6">
              <Text className="text-metal-400 text-xs font-mono mb-1">
                {t('recurring.fields.notes')}
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={t('recurring.fields.notesPlaceholder')}
                placeholderTextColor="#666"
                multiline
                numberOfLines={2}
                editable={!isFormLocked}
                className="bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono text-sm"
              />
            </View>

            {/* 按鈕組 */}
            <View className="flex-row gap-3 pb-6">
              <TouchableOpacity
                onPress={onClose}
                disabled={isFormLocked}
                className="flex-1 py-3.5 rounded-xl border border-white/10 items-center justify-center bg-zinc-950"
              >
                <Text className="text-metal-300 font-mono text-sm">{t('common.actions.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isFormLocked}
                className="flex-2 py-3.5 rounded-xl bg-racing-orange items-center justify-center flex-row gap-2 flex-1"
              >
                {isFormLocked ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#000" />
                    <Text className="text-black font-bold font-mono text-sm">
                      {t('recurring.fields.saveChanges')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};