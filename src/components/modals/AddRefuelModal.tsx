import React, { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAddRefuel } from '../../hooks/queries/useFuel';
import { DatePickerInput } from '../common/DatePickerInput';
import { FuelType } from '../../types/database';
import { useKeyboardBottomInset } from '../../hooks/useKeyboardBottomInset';

interface AddRefuelModalProps {
  visible: boolean;
  vehicleId: number;
  currentVehicleMileage?: number;
  onClose: () => void;
}

const FUEL_TYPES: FuelType[] = [
  'gasoline_98',
  'gasoline_95',
  'gasoline_92',
  'diesel',
  'premium_diesel',
  'electric',
  'hybrid',
  'other',
];

export const AddRefuelModal: React.FC<AddRefuelModalProps> = ({
  visible,
  vehicleId,
  currentVehicleMileage,
  onClose,
}) => {
  const { t } = useTranslation();
  const today = new Date().toISOString().split('T')[0];
  const [refuelDate, setRefuelDate] = useState(today);
  const [mileage, setMileage] = useState(currentVehicleMileage ? String(currentVehicleMileage) : '');
  const [volume, setVolume] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [selectedFuelType, setSelectedFuelType] = useState<FuelType>('gasoline_98');

  const addRefuelMutation = useAddRefuel();
  const rawKeyboardInset = useKeyboardBottomInset();
  const androidKeyboardInset = Platform.OS === 'android' ? rawKeyboardInset : 0;

  // 自動計算單價或總額
  const handleVolumeChange = (text: string) => {
    setVolume(text);
    const v = parseFloat(text);
    const p = parseFloat(pricePerUnit);
    if (!isNaN(v) && !isNaN(p) && v > 0 && p > 0) {
      setTotalCost((v * p).toFixed(2));
    }
  };

  const handlePricePerUnitChange = (text: string) => {
    setPricePerUnit(text);
    const p = parseFloat(text);
    const v = parseFloat(volume);
    if (!isNaN(v) && !isNaN(p) && v > 0 && p > 0) {
      setTotalCost((v * p).toFixed(2));
    }
  };

  const resetForm = () => {
    setRefuelDate(today);
    setMileage(currentVehicleMileage ? String(currentVehicleMileage) : '');
    setVolume('');
    setTotalCost('');
    setPricePerUnit('');
    setSelectedFuelType('gasoline_98');
  };

  const handleSubmit = async () => {
    const mileageNum = parseInt(mileage, 10);
    const volumeNum = parseFloat(volume);
    const totalCostNum = parseFloat(totalCost);
    const unitPriceNum = pricePerUnit ? parseFloat(pricePerUnit) : null;

    if (isNaN(mileageNum) || mileageNum < 0) {
      Alert.alert(t('common.status.error'), t('fuel.validation.mileageRequired'));
      return;
    }

    if (isNaN(volumeNum) || volumeNum <= 0) {
      Alert.alert(t('common.status.error'), t('fuel.validation.volumePositive'));
      return;
    }

    if (isNaN(totalCostNum) || totalCostNum < 0) {
      Alert.alert(t('common.status.error'), t('fuel.validation.costPositive'));
      return;
    }

    try {
      await addRefuelMutation.mutateAsync({
        vehicle_id: vehicleId,
        refuel_date: refuelDate.trim() || today,
        mileage: mileageNum,
        volume: volumeNum,
        total_cost: totalCostNum,
        price_per_unit: unitPriceNum,
        fuel_type: selectedFuelType,
      });

      Alert.alert(t('common.status.success'), t('fuel.validation.saveSuccess', { volume: volumeNum }));
      resetForm();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('fuel.validation.saveFailed');
      Alert.alert(t('common.status.error'), message);
    }
  };

  const modalBody = (
    <View className="flex-1 bg-black/80 justify-end" style={{ paddingBottom: androidKeyboardInset }}>
      <View className="bg-garage-card rounded-t-3xl border-t border-white/10 p-6 max-h-[88%] flex-1 justify-between">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between pb-4 border-b border-white/[0.08]">
              <View>
                <Text className="text-[10px] font-mono tracking-[0.2em] text-racing-blue uppercase font-bold">
                  TELEMETRY LOG
                </Text>
                <Text className="text-xl font-bold text-white tracking-tight mt-0.5">
                  {t('fuel.addRefuel')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                className="w-8 h-8 rounded-full bg-white/10 items-center justify-center"
              >
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView
              className="flex-1 mt-4"
              contentContainerStyle={{ paddingBottom: 60 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* 油品選擇器 (Horizontal Pill Selector) */}
              <View className="mb-4">
                <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-2">
                  {t('fuel.fields.fuelType')}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {FUEL_TYPES.map((fType) => {
                    const isSelected = selectedFuelType === fType;
                    return (
                      <TouchableOpacity
                        key={fType}
                        onPress={() => setSelectedFuelType(fType)}
                        className={`px-3 py-1.5 rounded-lg border ${
                          isSelected
                            ? 'bg-racing-blue/20 border-racing-blue'
                            : 'bg-zinc-950 border-white/10'
                        }`}
                      >
                        <Text
                          className={`text-xs font-mono font-bold ${
                            isSelected ? 'text-racing-blue' : 'text-metal-400'
                          }`}
                        >
                          {t(`fuel.types.${fType}`)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* 日期與加油當前里程 */}
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
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    {t('fuel.fields.odometer')} *
                  </Text>
                  <TextInput
                    value={mileage}
                    onChangeText={setMileage}
                    placeholder={t('fuel.fields.odometerPlaceholder')}
                    placeholderTextColor="#52525b"
                    keyboardType="numeric"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>
              </View>

              {/* 加油公升數與每公升單價 */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    {t('fuel.fields.volume')} *
                  </Text>
                  <TextInput
                    value={volume}
                    onChangeText={handleVolumeChange}
                    placeholder={t('fuel.fields.volumePlaceholder')}
                    placeholderTextColor="#52525b"
                    keyboardType="decimal-pad"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>

                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    {t('fuel.fields.pricePerUnit')}
                  </Text>
                  <TextInput
                    value={pricePerUnit}
                    onChangeText={handlePricePerUnitChange}
                    placeholder={t('fuel.fields.pricePerUnitPlaceholder')}
                    placeholderTextColor="#52525b"
                    keyboardType="decimal-pad"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>
              </View>

              {/* 總費用 */}
              <View className="mb-6">
                <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                  {t('fuel.fields.totalCost')} *
                </Text>
                <TextInput
                  value={totalCost}
                  onChangeText={setTotalCost}
                  placeholder={t('fuel.fields.totalCostPlaceholder')}
                  placeholderTextColor="#52525b"
                  keyboardType="decimal-pad"
                  className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-racing-blue font-mono font-bold text-base"
                />
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-3 mb-4">
                <TouchableOpacity
                  onPress={onClose}
                  className="flex-1 py-3.5 rounded-full bg-white/[0.06] border border-white/10 items-center justify-center"
                >
                  <Text className="text-metal-300 font-mono text-xs">{t('common.actions.cancel')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={addRefuelMutation.isPending}
                  className="flex-2 flex-row items-center justify-center rounded-full bg-racing-blue px-6 py-3.5 flex-1"
                >
                  {addRefuelMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Text className="text-white font-bold font-mono text-xs mr-2">
                        {t('fuel.actions.saveRefuel')}
                      </Text>
                      <View className="w-5 h-5 rounded-full bg-white/20 items-center justify-center">
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
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
