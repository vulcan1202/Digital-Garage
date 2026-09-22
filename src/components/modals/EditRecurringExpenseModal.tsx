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
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rawKeyboardInset = useKeyboardBottomInset();
  const androidKeyboardInset = Platform.OS === 'android' ? rawKeyboardInset : 0;

  useEffect(() => {
    if (visible && record) {
      setCategory(record.category || 'other');
      setTitle(record.title || '');
      setAmount(record.amount != null ? String(record.amount) : '');
      setPaidDate(record.paid_date ? record.paid_date.substring(0, 10) : '');
      setCoverageStartDate(record.coverage_start_date ? record.coverage_start_date.substring(0, 10) : '');
      setCoverageEndDate(record.coverage_end_date ? record.coverage_end_date.substring(0, 10) : '');
      setNotes(record.notes || '');
    }
  }, [visible, record]);

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
