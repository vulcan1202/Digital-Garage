import { useKeyboardBottomInset } from '../../hooks/useKeyboardBottomInset';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useUpdateRefuel } from '../../hooks/queries/useFuel';
import { RefuelRow, FuelType } from '../../types/database';
import { DatePickerInput } from '../common/DatePickerInput';

interface EditRefuelModalProps {
  visible: boolean;
  onClose: () => void;
  record: RefuelRow | null;
  onSuccess?: () => void;
}

const FUEL_OPTIONS: FuelType[] = [
  'gasoline_98',
  'gasoline_95',
  'gasoline_92',
  'diesel',
  'premium_diesel',
  'electric',
  'hybrid',
  'other',
];

export const EditRefuelModal: React.FC<EditRefuelModalProps> = ({
  visible,
  onClose,
  record,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const updateRefuel = useUpdateRefuel();
  const rawKeyboardInset = useKeyboardBottomInset();
  const androidKeyboardInset = Platform.OS === 'android' ? rawKeyboardInset : 0;

  const [refuelDate, setRefuelDate] = useState('');
  const [mileage, setMileage] = useState('');
  const [volume, setVolume] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>('gasoline_95');

  useEffect(() => {
    if (record && visible) {
      setRefuelDate(record.refuel_date ? record.refuel_date.substring(0, 10) : new Date().toISOString().substring(0, 10));
      setMileage(record.mileage != null ? String(record.mileage) : '');
      setVolume(record.volume != null ? String(record.volume) : '');
      setPricePerUnit(record.price_per_unit != null ? String(record.price_per_unit) : '');
      setTotalCost(record.total_cost != null ? String(record.total_cost) : '');
      setFuelType(record.fuel_type || 'gasoline_95');
    }
  }, [record, visible]);

  // 自動計算總金額
  const handleVolumeChange = (val: string) => {
    setVolume(val);
    const v = parseFloat(val);
    const p = parseFloat(pricePerUnit);
    if (!isNaN(v) && !isNaN(p) && v > 0 && p > 0) {
      setTotalCost((v * p).toFixed(2));
    }
  };

  const handlePriceChange = (val: string) => {
    setPricePerUnit(val);
    const v = parseFloat(volume);
    const p = parseFloat(val);
    if (!isNaN(v) && !isNaN(p) && v > 0 && p > 0) {
      setTotalCost((v * p).toFixed(2));
    }
  };

  const handleSubmit = async () => {
    if (!record) return;

    const parsedMileage = parseInt(mileage, 10);
    const parsedVolume = parseFloat(volume);
    const parsedPrice = parseFloat(pricePerUnit);
    const parsedTotal = parseFloat(totalCost);

    if (isNaN(parsedMileage) || parsedMileage < 0) {
      Alert.alert(t('common.status.error'), t('fuel.validation.mileageRequired'));
      return;
    }
    if (isNaN(parsedVolume) || parsedVolume <= 0) {
      Alert.alert(t('common.status.error'), t('fuel.validation.volumePositive'));
      return;
    }
    if (isNaN(parsedTotal) || parsedTotal < 0) {
      Alert.alert(t('common.status.error'), t('fuel.validation.costPositive'));
      return;
    }

    try {
      await updateRefuel.mutateAsync({
        id: record.id,
        data: {
          refuel_date: refuelDate || new Date().toISOString().substring(0, 10),
          mileage: parsedMileage,
          volume: parsedVolume,
          price_per_unit: isNaN(parsedPrice) ? null : parsedPrice,
          total_cost: parsedTotal,
          fuel_type: fuelType,
        },
      });

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('fuel.validation.updateFailed');
      Alert.alert(t('common.status.error'), msg);
    }
  };

  const modalBody = (
    <View className="flex-1 justify-end bg-black/60" style={{ paddingBottom: androidKeyboardInset }}>
      <View className="bg-slate-900 border-t border-slate-800 rounded-t-3xl max-h-[88%] flex-1 justify-between p-6">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-4 border-b border-slate-800">
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-full bg-emerald-500/10 items-center justify-center mr-3">
                <Ionicons name="water-outline" size={20} color="#10B981" />
              </View>
              <Text className="text-xl font-bold text-white">{t('fuel.editRefuel')}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
            >
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView
            className="flex-1 mt-4"
            contentContainerStyle={{ paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* 日期與里程 */}
            <View className="flex-row gap-3 mb-4">
              <DatePickerInput
                label={t('fuel.fields.date')}
                required
                value={refuelDate}
                onChange={setRefuelDate}
                maximumDate={new Date()}
                containerClassName="flex-1"
              />
              <View className="flex-1">
                <Text className="text-xs font-semibold text-slate-400 mb-1.5">{t('fuel.fields.odometer')} *</Text>
                <TextInput
                  value={mileage}
                  onChangeText={setMileage}
                  keyboardType="numeric"
                  placeholder={t('fuel.fields.odometerPlaceholder')}
                  placeholderTextColor="#64748B"
                  className="bg-slate-800/80 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm"
                />
              </View>
            </View>

            {/* 燃料種類 */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-slate-400 mb-1.5">{t('fuel.fields.fuelType')}</Text>
              <View className="flex-row flex-wrap gap-2">
                {FUEL_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setFuelType(opt)}
                    className={`px-3 py-2 rounded-xl border ${
                      fuelType === opt
                        ? 'bg-emerald-500/20 border-emerald-500'
                        : 'bg-slate-800/80 border-slate-700'
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        fuelType === opt ? 'text-emerald-400 font-bold' : 'text-slate-400'
                      }`}
                    >
                      {t(`fuel.types.${opt}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 公升數與單價 */}
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-xs font-semibold text-slate-400 mb-1.5">{t('fuel.fields.volume')} *</Text>
                <TextInput
                  value={volume}
                  onChangeText={handleVolumeChange}
                  keyboardType="numeric"
                  placeholder={t('fuel.fields.volumePlaceholder')}
                  placeholderTextColor="#64748B"
                  className="bg-slate-800/80 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm"
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-slate-400 mb-1.5">{t('fuel.fields.pricePerUnit')}</Text>
                <TextInput
                  value={pricePerUnit}
                  onChangeText={handlePriceChange}
                  keyboardType="numeric"
                  placeholder={t('fuel.fields.pricePerUnitPlaceholder')}
                  placeholderTextColor="#64748B"
                  className="bg-slate-800/80 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm"
                />
              </View>
            </View>

            {/* 總費用 */}
            <View className="mb-6">
              <Text className="text-xs font-semibold text-slate-400 mb-1.5">{t('fuel.fields.totalCost')} *</Text>
              <TextInput
                value={totalCost}
                onChangeText={setTotalCost}
                keyboardType="numeric"
                placeholder={t('fuel.fields.totalCostPlaceholder')}
                placeholderTextColor="#64748B"
                className="bg-slate-800/80 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm"
              />
            </View>

            {/* Actions */}
            <View className="flex-row gap-3 mb-6">
              <TouchableOpacity
                onPress={onClose}
                className="flex-1 py-3.5 rounded-xl bg-slate-800 border border-slate-700 items-center justify-center"
              >
                <Text className="text-slate-300 font-semibold">{t('common.actions.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={updateRefuel.isPending}
                className="flex-1 py-3.5 rounded-xl bg-emerald-600 items-center justify-center flex-row gap-2 shadow-lg shadow-emerald-900/30"
              >
                {updateRefuel.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                    <Text className="text-white font-bold">{t('fuel.actions.saveChanges')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          {modalBody}
        </KeyboardAvoidingView>
      ) : (
        modalBody
      )}
    </Modal>
  );
};
