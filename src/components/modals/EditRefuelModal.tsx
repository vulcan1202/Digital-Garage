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
import { Ionicons } from '@expo/vector-icons';
import { useUpdateRefuel } from '../../hooks/queries/useFuel';
import { FuelType, RefuelRow } from '../../types/database';

interface EditRefuelModalProps {
  visible: boolean;
  refuel: RefuelRow | null;
  onClose: () => void;
}

const FUEL_TYPES: { label: string; value: FuelType }[] = [
  { label: '98 無鉛', value: 'gasoline_98' },
  { label: '95 無鉛', value: 'gasoline_95' },
  { label: '92 無鉛', value: 'gasoline_92' },
  { label: '超級柴油', value: 'diesel' },
  { label: '頂級柴油', value: 'premium_diesel' },
  { label: '純電充電', value: 'electric' },
  { label: '油電複合', value: 'hybrid' },
  { label: '其他', value: 'other' },
];

export const EditRefuelModal: React.FC<EditRefuelModalProps> = ({
  visible,
  refuel,
  onClose,
}) => {
  const [refuelDate, setRefuelDate] = useState('');
  const [mileage, setMileage] = useState('');
  const [volume, setVolume] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [selectedFuelType, setSelectedFuelType] = useState<FuelType>('gasoline_98');

  const updateRefuelMutation = useUpdateRefuel();

  useEffect(() => {
    if (refuel) {
      setRefuelDate(refuel.refuel_date || '');
      setMileage(typeof refuel.mileage === 'number' ? String(refuel.mileage) : '');
      setVolume(refuel.volume !== null && refuel.volume !== undefined ? String(refuel.volume) : '');
      setTotalCost(
        refuel.total_cost !== null && refuel.total_cost !== undefined ? String(refuel.total_cost) : ''
      );
      setPricePerUnit(
        refuel.price_per_unit !== null && refuel.price_per_unit !== undefined
          ? String(refuel.price_per_unit)
          : ''
      );
      setSelectedFuelType(refuel.fuel_type || 'gasoline_98');
    }
  }, [refuel]);

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

  const handleSubmit = async () => {
    if (!refuel) return;

    const mileageNum = parseInt(mileage, 10);
    const volumeNum = parseFloat(volume);
    const totalCostNum = parseFloat(totalCost);
    const unitPriceNum = pricePerUnit.trim() ? parseFloat(pricePerUnit) : null;

    if (isNaN(mileageNum) || mileageNum < 0) {
      Alert.alert('里程數格式錯誤', '請輸入加油時的車輛總里程數 (公里)。');
      return;
    }

    if (isNaN(volumeNum) || volumeNum <= 0) {
      Alert.alert('加油量格式錯誤', '加油量必須大於 0 公升。');
      return;
    }

    if (isNaN(totalCostNum) || totalCostNum < 0) {
      Alert.alert('總金額格式錯誤', '總金額必須大於或等於 0 元。');
      return;
    }

    try {
      await updateRefuelMutation.mutateAsync({
        id: refuel.id,
        data: {
          refuel_date: refuelDate.trim() || refuel.refuel_date,
          mileage: mileageNum,
          volume: volumeNum,
          total_cost: totalCostNum,
          price_per_unit: unitPriceNum,
          fuel_type: selectedFuelType,
        },
      });

      Alert.alert('紀錄更新成功', '已成功更新加油日誌！\n車輛里程與統計數據已同步計算。');
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '加油紀錄更新失敗';
      Alert.alert('更新失敗', message);
    }
  };

  if (!refuel) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/80 justify-end">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="w-full"
        >
          <View className="bg-garage-card rounded-t-3xl border-t border-white/10 p-6 max-h-[90vh]">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between pb-4 border-b border-white/[0.08]">
              <View>
                <Text className="text-[10px] font-mono tracking-[0.2em] text-racing-blue uppercase font-bold">
                  EDIT FUEL LOG
                </Text>
                <Text className="text-xl font-bold text-white tracking-tight mt-0.5">
                  編輯加油紀錄
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
              className="mt-4"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* 油品種類選擇 Pills */}
              <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-2">
                油品種類 FUEL TYPE
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {FUEL_TYPES.map((t) => {
                  const isSelected = selectedFuelType === t.value;
                  return (
                    <TouchableOpacity
                      key={t.value}
                      onPress={() => setSelectedFuelType(t.value)}
                      className={`px-3 py-1.5 rounded-full border ${
                        isSelected
                          ? 'bg-racing-blue/20 border-racing-blue'
                          : 'bg-zinc-950 border-white/10'
                      }`}
                    >
                      <Text
                        className={`text-xs font-mono ${
                          isSelected ? 'text-racing-blue font-bold' : 'text-metal-400'
                        }`}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 加油日期與總里程數 */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    加油日期 DATE
                  </Text>
                  <TextInput
                    value={refuelDate}
                    onChangeText={setRefuelDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#52525b"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>

                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    加油時總里程 KM *
                  </Text>
                  <TextInput
                    value={mileage}
                    onChangeText={setMileage}
                    placeholder="例: 10500"
                    placeholderTextColor="#52525b"
                    keyboardType="number-pad"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>
              </View>

              {/* 加油量與單價 */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    加油量 VOLUME (L) *
                  </Text>
                  <TextInput
                    value={volume}
                    onChangeText={handleVolumeChange}
                    placeholder="例: 45.5"
                    placeholderTextColor="#52525b"
                    keyboardType="decimal-pad"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>

                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    每公升單價 ($/L)
                  </Text>
                  <TextInput
                    value={pricePerUnit}
                    onChangeText={handlePricePerUnitChange}
                    placeholder="例: 32.8"
                    placeholderTextColor="#52525b"
                    keyboardType="decimal-pad"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>
              </View>

              {/* 總花費金額 */}
              <View className="mb-6">
                <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                  總金額 TOTAL COST ($) *
                </Text>
                <TextInput
                  value={totalCost}
                  onChangeText={setTotalCost}
                  placeholder="例: 1500"
                  placeholderTextColor="#52525b"
                  keyboardType="decimal-pad"
                  className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-racing-blue font-mono font-bold text-lg"
                />
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-3 mb-4">
                <TouchableOpacity
                  onPress={onClose}
                  className="flex-1 py-3.5 rounded-full bg-white/[0.06] border border-white/10 items-center justify-center"
                >
                  <Text className="text-metal-300 font-mono text-xs">取消</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={updateRefuelMutation.isPending}
                  className="flex-2 flex-row items-center justify-center rounded-full bg-racing-blue px-6 py-3.5 flex-1"
                >
                  {updateRefuelMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Text className="text-white font-bold font-mono text-xs mr-2">
                        更新加油日誌
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
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};
