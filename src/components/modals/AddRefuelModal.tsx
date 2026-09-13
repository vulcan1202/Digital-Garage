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
import { useAddRefuel } from '../../hooks/queries/useFuel';
import { FuelType } from '../../types/database';

interface AddRefuelModalProps {
  visible: boolean;
  vehicleId: number;
  currentVehicleMileage?: number;
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

export const AddRefuelModal: React.FC<AddRefuelModalProps> = ({
  visible,
  vehicleId,
  currentVehicleMileage,
  onClose,
}) => {
  const today = new Date().toISOString().split('T')[0];
  const [refuelDate, setRefuelDate] = useState(today);
  const [mileage, setMileage] = useState(currentVehicleMileage ? String(currentVehicleMileage) : '');
  const [volume, setVolume] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [selectedFuelType, setSelectedFuelType] = useState<FuelType>('gasoline_98');

  const addRefuelMutation = useAddRefuel();

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
      await addRefuelMutation.mutateAsync({
        vehicle_id: vehicleId,
        refuel_date: refuelDate.trim() || today,
        mileage: mileageNum,
        volume: volumeNum,
        total_cost: totalCostNum,
        price_per_unit: unitPriceNum,
        fuel_type: selectedFuelType,
      });

      Alert.alert('加油紀錄已儲存', `已成功建立 ${volumeNum}L 加油遙測數據！`);
      resetForm();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '加油紀錄新增失敗';
      Alert.alert('新增失敗', message);
    }
  };

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
                  TELEMETRY LOG
                </Text>
                <Text className="text-xl font-bold text-white tracking-tight mt-0.5">
                  登錄加油日誌
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
              {/* 油品選擇器 (Horizontal Pill Selector) */}
              <View className="mb-4">
                <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-2">
                  燃料種類 FUEL TYPE
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {FUEL_TYPES.map((t) => {
                    const isSelected = selectedFuelType === t.value;
                    return (
                      <TouchableOpacity
                        key={t.value}
                        onPress={() => setSelectedFuelType(t.value)}
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
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* 日期與加油當前里程 */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    加油日期 DATE (YYYY-MM-DD) *
                  </Text>
                  <TextInput
                    value={refuelDate}
                    onChangeText={setRefuelDate}
                    placeholder="2024-03-20"
                    placeholderTextColor="#52525b"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>

                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    加油當下里程 ODOMETER (KM) *
                  </Text>
                  <TextInput
                    value={mileage}
                    onChangeText={setMileage}
                    placeholder="例: 15420"
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
                    加油容量 VOLUME (L) *
                  </Text>
                  <TextInput
                    value={volume}
                    onChangeText={handleVolumeChange}
                    placeholder="例: 45.2"
                    placeholderTextColor="#52525b"
                    keyboardType="decimal-pad"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>

                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    每公升單價 PRICE/L
                  </Text>
                  <TextInput
                    value={pricePerUnit}
                    onChangeText={handlePricePerUnitChange}
                    placeholder="例: 34.5"
                    placeholderTextColor="#52525b"
                    keyboardType="decimal-pad"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>
              </View>

              {/* 總費用 */}
              <View className="mb-6">
                <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                  總花費 TOTAL COST ($) *
                </Text>
                <TextInput
                  value={totalCost}
                  onChangeText={setTotalCost}
                  placeholder="例: 1560"
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
                  <Text className="text-metal-300 font-mono text-xs">取消</Text>
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
                        儲存加油紀錄
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
