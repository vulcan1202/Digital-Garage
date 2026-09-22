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
import { useCreateRecurringExpenseMutation } from '../../hooks/queries/useRecurringExpenses';
import { RecurringExpenseCategory } from '../../types/recurringExpense';
import {
  getSmartPreFill,
  deriveInspectionWindow,
} from '../../utils/calculators/recurringCalculator';
import { useKeyboardBottomInset } from '../../hooks/useKeyboardBottomInset';
import { VehicleWithCover } from '../../types/database';
import { DatePickerInput } from '../common/DatePickerInput';

interface AddRecurringExpenseModalProps {
  visible: boolean;
  vehicle: VehicleWithCover | null;
  onClose: () => void;
}

const CATEGORIES: { key: RecurringExpenseCategory; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { key: 'license_tax', icon: 'card-text-outline' },
  { key: 'road_maintenance_fee', icon: 'road-variant' },
  { key: 'inspection', icon: 'shield-check-outline' },
  { key: 'compulsory_insurance', icon: 'shield-car' },
  { key: 'liability_insurance', icon: 'shield-account' },
  { key: 'other', icon: 'receipt' },
];

export const AddRecurringExpenseModal: React.FC<AddRecurringExpenseModalProps> = ({
  visible,
  vehicle,
  onClose,
}) => {
  const { t } = useTranslation();
  const vehicleId = vehicle ? vehicle.id : 0;
  const createMutation = useCreateRecurringExpenseMutation(vehicleId);

  const [category, setCategory] = useState<RecurringExpenseCategory>('license_tax');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidDate, setPaidDate] = useState('');
  const [coverageStartDate, setCoverageStartDate] = useState('');
  const [coverageEndDate, setCoverageEndDate] = useState('');
  const [nextInspectionDate, setNextInspectionDate] = useState('');
  const [notes, setNotes] = useState('');
  const [notice, setNotice] = useState<string | undefined>('');

  const rawKeyboardInset = useKeyboardBottomInset();
  const androidKeyboardInset = Platform.OS === 'android' ? rawKeyboardInset : 0;

  // 當開啟或切換類別時，觸發 Smart Pre-fill 自動帶入
  const applySmartPreFill = (targetCat: RecurringExpenseCategory) => {
    if (!vehicle) return;
    const prefill = getSmartPreFill(targetCat, vehicle);
    setTitle(prefill.title);
    setAmount(prefill.defaultAmount > 0 ? String(prefill.defaultAmount) : '');
    setPaidDate(prefill.paidDate);
    setCoverageStartDate(prefill.coverageStartDate);
    setCoverageEndDate(prefill.coverageEndDate);
    setNextInspectionDate(prefill.nextInspectionDate || '');
    setNotice(prefill.notice);
  };

  const handleNextInspectionDateChange = (dateStr: string) => {
    setNextInspectionDate(dateStr);
    const window = deriveInspectionWindow(dateStr);
    setCoverageStartDate(window.coverageStartDate);
    setCoverageEndDate(window.coverageEndDate);
    setPaidDate(dateStr);
  };

  useEffect(() => {
    if (visible && vehicle) {
      applySmartPreFill(category);
    }
  }, [visible, vehicle]);

  const handleSelectCategory = (cat: RecurringExpenseCategory) => {
    setCategory(cat);
    applySmartPreFill(cat);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert(t('common.status.error'), t('recurring.validation.titleRequired'));
      return;
    }

    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum < 0) {
      Alert.alert(t('common.status.error'), t('recurring.validation.amountInvalid'));
      return;
    }

    const finalPaidDate = category === 'inspection' ? (nextInspectionDate.trim() || paidDate.trim()) : paidDate.trim();

    if (!finalPaidDate || !coverageStartDate.trim() || !coverageEndDate.trim()) {
      Alert.alert(t('common.status.error'), t('recurring.validation.dateRequired'));
      return;
    }

    if (coverageEndDate < coverageStartDate) {
      Alert.alert(t('common.status.error'), t('recurring.validation.dateLogicError'));
      return;
    }

    try {
      await createMutation.mutateAsync({
        vehicle_id: vehicleId,
        category,
        title: title.trim(),
        amount: amtNum,
        paid_date: finalPaidDate,
        coverage_start_date: coverageStartDate.trim(),
        coverage_end_date: coverageEndDate.trim(),
        notes: notes.trim() ? notes.trim() : null,
        sync_as_registration_date: null,
      });

      Alert.alert(t('common.status.success'), t('recurring.validation.saveSuccess', { name: title.trim() }));
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('recurring.validation.saveFailed');
      Alert.alert(t('common.status.error'), msg);
    }
  };

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
                <Ionicons name="calendar-outline" size={18} color="#ff6b00" />
              </View>
              <View>
                <Text className="text-white font-bold text-base">{t('recurring.addExpense')}</Text>
                <Text className="text-metal-400 text-xs font-mono">
                  {vehicle ? `${vehicle.brand} ${vehicle.model}` : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} className="p-1">
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
                      onPress={() => handleSelectCategory(c.key)}
                      className={`px-3 py-2 rounded-xl border flex-row items-center gap-1.5 ${
                        isSelected
                          ? 'bg-racing-orange/20 border-racing-orange'
                          : 'bg-zinc-800/80 border-white/10'
                      }`}
                    >
                      <MaterialCommunityIcons
                        name={c.icon}
                        size={16}
                        color={isSelected ? '#ff6b00' : '#888'}
                      />
                      <Text
                        className={`text-xs font-mono font-bold ${
                          isSelected ? 'text-racing-orange' : 'text-metal-300'
                        }`}
                      >
                        {t(`recurring.labels.${c.key}`)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* 法規智慧提示卡片 */}
            {notice && (
              <View className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl mb-4 flex-row items-start gap-2">
                <Ionicons name="information-circle-outline" size={18} color="#f59e0b" className="mt-0.5" />
                <Text className="text-amber-300/90 text-xs flex-1 leading-relaxed">
                  {notice}
                </Text>
              </View>
            )}

            {/* 標題欄位 */}
            <View className="mb-3.5">
              <Text className="text-metal-400 text-xs font-mono mb-1.5">{t('recurring.fields.title')} *</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={t('recurring.fields.titlePlaceholder')}
                placeholderTextColor="#555"
                className="bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
              />
            </View>

            {/* 金額欄位 */}
            <View className="mb-3.5">
              <Text className="text-metal-400 text-xs font-mono mb-1.5">{t('recurring.fields.amount')} *</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                keyboardType="numeric"
                placeholderTextColor="#555"
                className="bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
              />
            </View>

            {/* 依類別區分日期輸入欄位 */}
            {category === 'inspection' ? (
              <>
                {/* 規定定檢日期 */}
                <DatePickerInput
                  label={t('recurring.inspectionDetails.statutoryInspectionDate')}
                  required
                  value={nextInspectionDate}
                  onChange={handleNextInspectionDateChange}
                  placeholder={t('recurring.inspectionDetails.statutoryInspectionDatePlaceholder')}
                  containerClassName="mb-3.5"
                />

                {/* 法定檢驗寬限期即時提示卡片（前後各 1 個月） */}
                {Boolean(coverageStartDate && coverageEndDate) && (
                  <View className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-3 mb-3.5 flex-row items-center gap-2.5">
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
                )}
              </>
            ) : (
              <>
                {/* 一般規費：付款日 */}
                <DatePickerInput
                  label={t('recurring.fields.paidDateLabel')}
                  required
                  value={paidDate}
                  onChange={setPaidDate}
                  maximumDate={new Date()}
                  placeholder={t('recurring.fields.paidDatePlaceholder')}
                  containerClassName="mb-3.5"
                />

                {/* 一般規費：有效起訖期間 */}
                <View className="flex-row gap-3 mb-3.5">
                  <DatePickerInput
                    label={t('recurring.fields.coverageStartDate')}
                    required
                    value={coverageStartDate}
                    onChange={setCoverageStartDate}
                    placeholder={t('recurring.fields.coverageStartDate')}
                    containerClassName="flex-1"
                  />
                  <DatePickerInput
                    label={t('recurring.fields.coverageEndDate')}
                    required
                    value={coverageEndDate}
                    onChange={setCoverageEndDate}
                    placeholder={t('recurring.fields.coverageEndDate')}
                    containerClassName="flex-1"
                  />
                </View>
              </>
            )}

            {/* 備註 */}
            <View className="mb-6">
              <Text className="text-metal-400 text-xs font-mono mb-1.5">{t('recurring.fields.notes')}</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={t('recurring.fields.notesPlaceholder')}
                placeholderTextColor="#555"
                multiline
                numberOfLines={2}
                className="bg-black/60 border border-white/10 rounded-xl px-3.5 py-2 text-white font-mono text-sm min-h-[50px]"
              />
            </View>

            {/* 儲存確認按鈕 */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={createMutation.isPending}
              className="bg-racing-orange py-3.5 rounded-xl items-center justify-center mb-6 shadow-lg shadow-orange-500/20"
              activeOpacity={0.8}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text className="text-black font-bold text-sm tracking-wider font-mono">
                  {t('recurring.fields.saveBtn')}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
