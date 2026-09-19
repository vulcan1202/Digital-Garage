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
  parseYMD,
  formatYMD,
  addMonthsClamped,
} from '../../utils/calculators/recurringCalculator';
import { useKeyboardBottomInset } from '../../hooks/useKeyboardBottomInset';
import { VehicleWithCover } from '../../types/database';
import { DatePickerInput } from '../common/DatePickerInput';

interface AddRecurringExpenseModalProps {
  visible: boolean;
  vehicle: VehicleWithCover | null;
  onClose: () => void;
}

type MciIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const CATEGORIES: { key: RecurringExpenseCategory; icon: MciIconName }[] = [
  { key: 'license_tax', icon: 'card-bulleted-outline' },
  { key: 'road_maintenance_fee', icon: 'road-variant' },
  { key: 'inspection', icon: 'shield-check-outline' },
  { key: 'compulsory_insurance', icon: 'file-certificate-outline' },
  { key: 'liability_insurance', icon: 'security' },
  { key: 'other', icon: 'dots-horizontal-circle-outline' },
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
  const [notes, setNotes] = useState('');
  const [notice, setNotice] = useState<string | undefined>('');
  const [syncAsRegistrationDate, setSyncAsRegistrationDate] = useState(false);

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
    setNotice(prefill.notice);
    setSyncAsRegistrationDate(false);
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

    if (!paidDate.trim() || !coverageStartDate.trim() || !coverageEndDate.trim()) {
      Alert.alert(t('common.status.error'), t('recurring.validation.dateRequired'));
      return;
    }

    if (coverageEndDate < coverageStartDate) {
      Alert.alert(t('common.status.error'), t('recurring.validation.dateLogicError'));
      return;
    }

    const doSubmit = async (syncDate: string | null) => {
      try {
        await createMutation.mutateAsync({
          vehicle_id: vehicleId,
          category,
          title: title.trim(),
          amount: amtNum,
          paid_date: paidDate.trim(),
          coverage_start_date: coverageStartDate.trim(),
          coverage_end_date: coverageEndDate.trim(),
          notes: notes.trim() ? notes.trim() : null,
          sync_as_registration_date: syncDate,
        });

        Alert.alert(t('common.status.success'), t('recurring.validation.saveSuccess', { name: title.trim() }));
        onClose();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : t('recurring.validation.saveFailed');
        Alert.alert(t('common.status.error'), msg);
      }
    };

    if (category === 'inspection' && syncAsRegistrationDate) {
      // 依 coverageStartDate (+1 month) 推算檢驗基準日
      let derivedRegDate: string | null = null;
      const parsedStart = parseYMD(coverageStartDate);
      if (parsedStart) {
        const baseObj = addMonthsClamped(parsedStart.year, parsedStart.month, parsedStart.day, 1);
        let regYear = baseObj.year;
        if (vehicle?.manufacture_date) {
          const pMfg = parseYMD(vehicle.manufacture_date);
          if (pMfg) regYear = pMfg.year;
        } else if (vehicle?.registration_date) {
          const pReg = parseYMD(vehicle.registration_date);
          if (pReg) regYear = pReg.year;
        } else if (vehicle?.year) {
          regYear = vehicle.year;
        }

        const todayYear = new Date().getFullYear();
        if (regYear > todayYear) {
          regYear = todayYear;
        }
        const targetObj = addMonthsClamped(regYear, baseObj.month, baseObj.day, 0);
        derivedRegDate = formatYMD(targetObj.year, targetObj.month, targetObj.day);
      }

      if (derivedRegDate) {
        // 若該車輛已有 registration_date 且與目前計算出的日期不同，跳出 Alert 確認覆寫
        if (vehicle?.registration_date && vehicle.registration_date !== derivedRegDate) {
          Alert.alert(
            t('recurring.fields.confirmOverwrite'),
            t('recurring.fields.syncOverwriteWarning', {
              existing: vehicle.registration_date,
              newDate: derivedRegDate,
            }),
            [
              { text: t('common.actions.cancel'), style: 'cancel' },
              {
                text: t('recurring.fields.confirmOverwrite'),
                style: 'destructive',
                onPress: () => doSubmit(derivedRegDate),
              },
            ]
          );
          return;
        }
        await doSubmit(derivedRegDate);
        return;
      }
    }

    await doSubmit(null);
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

            {/* 付款/檢驗日 */}
            <DatePickerInput
              label={t('recurring.fields.paidDateLabel')}
              required
              value={paidDate}
              onChange={setPaidDate}
              maximumDate={new Date()}
              placeholder={t('recurring.fields.paidDatePlaceholder')}
              containerClassName="mb-3.5"
            />

            {/* 有效起訖期間 */}
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

            {/* 若為定期檢驗，顯示同步發照日 Checkbox */}
            {category === 'inspection' && vehicle && (
              <TouchableOpacity
                onPress={() => setSyncAsRegistrationDate(!syncAsRegistrationDate)}
                activeOpacity={0.7}
                className="flex-row items-center gap-2.5 p-3 rounded-xl bg-zinc-800/80 border border-white/10 mb-3.5"
              >
                <Ionicons
                  name={syncAsRegistrationDate ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={syncAsRegistrationDate ? '#ff6b00' : '#888'}
                />
                <View className="flex-1">
                  <Text className="text-white text-xs font-medium">
                    {t('recurring.fields.syncRegistrationDate')}
                  </Text>
                  <Text className="text-metal-400 text-[10px] mt-0.5">
                    {t('recurring.fields.syncRegistrationDesc')}
                  </Text>
                </View>
              </TouchableOpacity>
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
