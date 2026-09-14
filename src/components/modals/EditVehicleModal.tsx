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
import { useKeyboardBottomInset } from '../../hooks/useKeyboardBottomInset';
import { VehicleType, FuelType, VehicleWithCover } from '../../types/database';

interface EditVehicleModalProps {
  visible: boolean;
  vehicle: VehicleWithCover | null;
  onClose: () => void;
}

const FUEL_TYPES: { label: string; value: FuelType }[] = [
  { label: '92 無鉛汽油', value: 'gasoline_92' },
  { label: '95 無鉛汽油', value: 'gasoline_95' },
  { label: '98 無鉛汽油', value: 'gasoline_98' },
  { label: '一般柴油', value: 'diesel' },
  { label: '頂級柴油', value: 'premium_diesel' },
  { label: '純電 (Electric)', value: 'electric' },
  { label: '油電混合 (Hybrid)', value: 'hybrid' },
  { label: '其他動力', value: 'other' },
];

export const EditVehicleModal: React.FC<EditVehicleModalProps> = ({
  visible,
  vehicle,
  onClose,
}) => {
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('car');
  const [year, setYear] = useState('');
  const [currentMileage, setCurrentMileage] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [fuelType, setFuelType] = useState<FuelType | null>(null);
  const [engineDisplacement, setEngineDisplacement] = useState('');
  const [licensePlate, setLicensePlate] = useState('');

  const updateVehicleMutation = useUpdateVehicle();
  const rawKeyboardInset = useKeyboardBottomInset();
  const androidKeyboardInset = Platform.OS === 'android' ? rawKeyboardInset : 0;

  useEffect(() => {
    if (vehicle) {
      setBrand(vehicle.brand);
      setModel(vehicle.model);
      setVehicleType(vehicle.vehicle_type || 'car');
      setYear(vehicle.year ? String(vehicle.year) : '');
      setCurrentMileage(String(vehicle.current_mileage));
      setPurchaseDate(vehicle.purchase_date || '');
      setPurchasePrice(vehicle.purchase_price !== null && vehicle.purchase_price !== undefined ? String(vehicle.purchase_price) : '');
      setFuelType(vehicle.fuel_type || null);
      setEngineDisplacement(vehicle.engine_displacement_cc ? String(vehicle.engine_displacement_cc) : '');
      setLicensePlate(vehicle.license_plate || '');
    }
  }, [vehicle]);

  const handleUpdate = async () => {
    if (!vehicle) return;
    if (!brand.trim() || !model.trim()) {
      Alert.alert('資料不齊全', '車輛廠牌與車型名稱為必填。');
      return;
    }

    const mileageNum = parseInt(currentMileage, 10);
    if (currentMileage && (isNaN(mileageNum) || mileageNum < 0)) {
      Alert.alert('里程數格式錯誤', '當前里程數必須為大於或等於 0 之整數。');
      return;
    }

    if (!isNaN(mileageNum) && mileageNum < vehicle.initial_mileage) {
      Alert.alert('里程數邏輯錯誤', `當前里程 (${mileageNum} KM) 不得小於入庫基準里程 (${vehicle.initial_mileage} KM)。`);
      return;
    }

    const yearNum = year ? parseInt(year, 10) : null;
    if (year && (isNaN(yearNum!) || yearNum! < 1886 || yearNum! > 2100)) {
      Alert.alert('年份格式錯誤', '請輸入有效的年份 (1886 至 2100)。');
      return;
    }

    let priceNum: number | null = null;
    if (purchasePrice.trim()) {
      const parsed = parseFloat(purchasePrice.trim());
      if (isNaN(parsed) || parsed < 0) {
        Alert.alert('購車價格格式錯誤', '購車金額必須為大於或等於 0 之數值。');
        return;
      }
      priceNum = parsed;
    }

    let ccNum: number | null = null;
    if (engineDisplacement.trim()) {
      const parsed = parseInt(engineDisplacement.trim(), 10);
      if (isNaN(parsed) || parsed <= 0) {
        Alert.alert('排氣量格式錯誤', '排氣量 (c.c.) 必須為大於 0 之正整數。');
        return;
      }
      ccNum = parsed;
    }

    try {
      await updateVehicleMutation.mutateAsync({
        id: vehicle.id,
        data: {
          brand: brand.trim(),
          model: model.trim(),
          vehicle_type: vehicleType,
          year: yearNum,
          current_mileage: isNaN(mileageNum) ? vehicle.current_mileage : mileageNum,
          purchase_date: purchaseDate.trim() || null,
          purchase_price: priceNum,
          fuel_type: fuelType,
          engine_displacement_cc: ccNum,
          license_plate: licensePlate.trim() || null,
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

  const modalBody = (
    <View
      className="flex-1 bg-black/80 justify-end"
      style={{ paddingBottom: androidKeyboardInset }}
    >
      <View className="bg-garage-card rounded-t-3xl border-t border-white/10 p-6 max-h-[88%]">
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
          className="mt-4"
          contentContainerStyle={{ paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Vehicle Type Selector */}
          <View className="mb-4">
            <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-2">
              車輛類型 VEHICLE TYPE *
            </Text>
            <View className="flex-row gap-2">
              {(
                [
                  { type: 'car', label: '汽車 Car', icon: 'car-sport' },
                  { type: 'motorcycle', label: '機車 Moto', icon: 'bicycle' },
                  { type: 'other', label: '其他 Other', icon: 'grid' },
                ] as const
              ).map((item) => {
                const isSelected = vehicleType === item.type;
                return (
                  <TouchableOpacity
                    key={item.type}
                    onPress={() => setVehicleType(item.type)}
                    className={`flex-1 py-3 px-2 rounded-xl border flex-row items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-racing-orange/15 border-racing-orange'
                        : 'bg-zinc-950 border-white/10'
                    }`}
                  >
                    <Ionicons
                      name={item.icon as any}
                      size={16}
                      color={isSelected ? '#ff4d00' : '#a1a1aa'}
                    />
                    <Text
                      className={`text-xs font-mono font-bold ${
                        isSelected ? 'text-racing-orange' : 'text-zinc-400'
                      }`}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

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

          {/* License Plate & Displacement */}
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1">
              <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                車牌號碼 PLATE
              </Text>
              <TextInput
                value={licensePlate}
                onChangeText={setLicensePlate}
                placeholder="例: RAC-8888"
                placeholderTextColor="#52525b"
                autoCapitalize="characters"
                className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
              />
            </View>

            <View className="flex-1">
              <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                排氣量 DISPLACEMENT (CC)
              </Text>
              <TextInput
                value={engineDisplacement}
                onChangeText={setEngineDisplacement}
                placeholder="例: 3996"
                placeholderTextColor="#52525b"
                keyboardType="numeric"
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

          {/* Fuel Type */}
          <View className="mb-4">
            <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-2">
              預設動力油品 FUEL TYPE
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
              {FUEL_TYPES.map((ft) => {
                const isSelected = fuelType === ft.value;
                return (
                  <TouchableOpacity
                    key={ft.value}
                    onPress={() => setFuelType(isSelected ? null : ft.value)}
                    className={`py-2 px-3 rounded-lg border ${
                      isSelected
                        ? 'bg-racing-orange/20 border-racing-orange'
                        : 'bg-zinc-950 border-white/10'
                    }`}
                  >
                    <Text
                      className={`text-xs font-mono ${
                        isSelected ? 'text-racing-orange font-bold' : 'text-zinc-400'
                      }`}
                    >
                      {ft.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Purchase Date & Price */}
          <View className="flex-row gap-3 mb-6">
            <View className="flex-1">
              <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                購入日期 (YYYY-MM-DD)
              </Text>
              <TextInput
                value={purchaseDate}
                onChangeText={setPurchaseDate}
                placeholder="例: 2023-08-15"
                placeholderTextColor="#52525b"
                className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
              />
            </View>

            <View className="flex-1">
              <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                購車價格 PRICE ($)
              </Text>
              <TextInput
                value={purchasePrice}
                onChangeText={setPurchasePrice}
                placeholder="例: 1500000"
                placeholderTextColor="#52525b"
                keyboardType="numeric"
                className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
              />
            </View>
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
