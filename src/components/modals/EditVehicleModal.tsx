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
import { useUpdateVehicle } from '../../hooks/queries/useVehicles';
import { VehicleWithCover } from '../../types/database';


interface EditVehicleModalProps {
  visible: boolean;
  vehicle: VehicleWithCover | null;
  onClose: () => void;
}

export const EditVehicleModal: React.FC<EditVehicleModalProps> = ({
  visible,
  vehicle,
  onClose,
}) => {
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [currentMileage, setCurrentMileage] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');

  const updateVehicleMutation = useUpdateVehicle();

  useEffect(() => {
    if (vehicle) {
      setBrand(vehicle.brand || '');
      setModel(vehicle.model || '');
      setYear(vehicle.year ? String(vehicle.year) : '');
      setCurrentMileage(String(vehicle.initial_mileage ?? vehicle.current_mileage ?? 0));
      setPurchaseDate(vehicle.purchase_date || '');
    }
  }, [vehicle]);

  const handleUpdate = async () => {
    if (!vehicle) return;

    if (!brand.trim() || !model.trim()) {
      Alert.alert('資料不齊全', '車輛廠牌 (Brand) 與車型名稱 (Model) 為必填。');
      return;
    }

    const mileageNum = parseInt(currentMileage, 10);
    if (isNaN(mileageNum) || mileageNum < 0) {
      Alert.alert('里程數格式錯誤', '基準里程數必須為大於或等於 0 之整數。');
      return;
    }

    const yearNum = year ? parseInt(year, 10) : null;
    if (year && (isNaN(yearNum!) || yearNum! < 1900 || yearNum! > 2100)) {
      Alert.alert('年份格式錯誤', '請輸入有效的年份 (例如 2024)。');
      return;
    }

    try {
      await updateVehicleMutation.mutateAsync({
        id: vehicle.id,
        data: {
          brand: brand.trim(),
          model: model.trim(),
          year: yearNum,
          initial_mileage: mileageNum,
          purchase_date: purchaseDate.trim() || null,
        },
      });

      Alert.alert('更新成功', '愛車資料已成功保存！');
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '車輛更新失敗';
      Alert.alert('更新失敗', message);
    }
  };

  if (!vehicle) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-garage-card rounded-t-3xl border-t border-white/10 p-6 max-h-[90%] flex-1 justify-between">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between pb-4 border-b border-white/[0.08]">
              <View>
                <Text className="text-[10px] font-mono tracking-[0.2em] text-racing-orange uppercase font-bold">
                  FLEET MANAGEMENT
                </Text>
                <Text className="text-xl font-bold text-white tracking-tight mt-0.5">
                  編輯愛車資料
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
              {/* Brand & Model */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    廠牌 BRAND *
                  </Text>
                  <TextInput
                    value={brand}
                    onChangeText={setBrand}
                    placeholder="例: Porsche"
                    placeholderTextColor="#52525b"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>

                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    車型 MODEL *
                  </Text>
                  <TextInput
                    value={model}
                    onChangeText={setModel}
                    placeholder="例: 911 GT3"
                    placeholderTextColor="#52525b"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>
              </View>

              {/* Year & Current Mileage */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    出廠年份 YEAR
                  </Text>
                  <TextInput
                    value={year}
                    onChangeText={setYear}
                    placeholder="例: 2024"
                    placeholderTextColor="#52525b"
                    keyboardType="numeric"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>

                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    目前里程 ODOMETER (KM)
                  </Text>
                  <TextInput
                    value={currentMileage}
                    onChangeText={setCurrentMileage}
                    placeholder="例: 12500"
                    placeholderTextColor="#52525b"
                    keyboardType="numeric"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>
              </View>

              {/* Purchase Date */}
              <View className="mb-6">
                <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                  購入日期 PURCHASE DATE (YYYY-MM-DD)
                </Text>
                <TextInput
                  value={purchaseDate}
                  onChangeText={setPurchaseDate}
                  placeholder="例: 2023-08-15"
                  placeholderTextColor="#52525b"
                  className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
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
                  onPress={handleUpdate}
                  disabled={updateVehicleMutation.isPending}
                  className="flex-2 flex-row items-center justify-center rounded-full bg-racing-orange px-6 py-3.5 flex-1"
                >
                  {updateVehicleMutation.isPending ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <>
                      <Text className="text-black font-bold font-mono text-xs mr-2">
                        保存變更
                      </Text>
                      <View className="w-5 h-5 rounded-full bg-black/20 items-center justify-center">
                        <Ionicons name="checkmark" size={12} color="#000" />
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
