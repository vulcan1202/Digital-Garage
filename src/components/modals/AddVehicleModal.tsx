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
import { useCreateVehicle } from '../../hooks/queries/useVehicles';
import { DoubleBezelCard } from '../DoubleBezelCard';


interface AddVehicleModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: (newId: number) => void;
}

export const AddVehicleModal: React.FC<AddVehicleModalProps> = ({
  visible,
  onClose,
  onCreated,
}) => {
  const [brand, setBrand] = useState('Porsche');
  const [model, setModel] = useState('911 GT3');
  const [year, setYear] = useState('2023');
  const [currentMileage, setCurrentMileage] = useState('15000');
  const [purchaseDate, setPurchaseDate] = useState('2023-08-15');

  const createVehicleMutation = useCreateVehicle();

  const resetForm = () => {
    setBrand('');
    setModel('');
    setYear('');
    setCurrentMileage('');
    setPurchaseDate('');
  };

  const handleCreate = async () => {
    if (!brand.trim() || !model.trim()) {
      Alert.alert('資料不齊全', '車輛廠牌 (Brand) 與車型名稱 (Model) 為必填。');
      return;
    }

    const mileageNum = parseInt(currentMileage, 10);
    if (currentMileage && (isNaN(mileageNum) || mileageNum < 0)) {
      Alert.alert('里程數格式錯誤', '當前里程數必須為大於或等於 0 之整數。');
      return;
    }

    const yearNum = year ? parseInt(year, 10) : null;
    if (year && (isNaN(yearNum!) || yearNum! < 1900 || yearNum! > 2100)) {
      Alert.alert('年份格式錯誤', '請輸入有效的年份 (例如 2024)。');
      return;
    }

    try {
      const created = await createVehicleMutation.mutateAsync({
        brand: brand.trim(),
        model: model.trim(),
        year: yearNum,
        current_mileage: isNaN(mileageNum) ? 0 : mileageNum,
        purchase_date: purchaseDate.trim() || null,
      });

      Alert.alert('車輛登錄成功', `${created.brand} ${created.model} 已加入您的車庫！`);
      resetForm();
      onClose();
      if (onCreated) {
        onCreated(created.id);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '車輛新增失敗';
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
                <Text className="text-[10px] font-mono tracking-[0.2em] text-racing-orange uppercase font-bold">
                  FLEET ONBOARDING
                </Text>
                <Text className="text-xl font-bold text-white tracking-tight mt-0.5">
                  新增愛車入庫
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
              {/* Brand & Model */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    廠牌 BRAND *
                  </Text>
                  <TextInput
                    value={brand}
                    onChangeText={setBrand}
                    placeholder="例: Porsche / Toyota"
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
                    placeholder="例: 911 GT3 / GR Yaris"
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
                  onPress={handleCreate}
                  disabled={createVehicleMutation.isPending}
                  className="flex-2 flex-row items-center justify-center rounded-full bg-racing-orange px-6 py-3.5 flex-1"
                >
                  {createVehicleMutation.isPending ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <>
                      <Text className="text-black font-bold font-mono text-xs mr-2">
                        確認入庫
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
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};
