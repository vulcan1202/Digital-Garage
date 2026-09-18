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
import { DatePickerInput } from '../common/DatePickerInput';
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
  const [manufactureDate, setManufactureDate] = useState('');
  const [registrationDate, setRegistrationDate] = useState('');
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
      // 若車輛有 manufacture_date，取前 7 碼 YYYY-MM；若只有 year 則回退 `${year}-01`
      const initManufactureDate = vehicle.manufacture_date 
        ? vehicle.manufacture_date.slice(0, 7)
        : (vehicle.year ? `${vehicle.year}-01` : '');
      setManufactureDate(initManufactureDate);
      setRegistrationDate(vehicle.registration_date || '');
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

    // 由出廠日期自動解析西元年份，或沿用車輛既有年份
    const derivedYear = manufactureDate.trim()
      ? parseInt(manufactureDate.split('-')[0], 10)
      : (vehicle.year || null);
    const yearNum = derivedYear && !isNaN(derivedYear) ? derivedYear : null;

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
          manufacture_date: manufactureDate.trim() || null,
          registration_date: registrationDate.trim() || null,
          purchase_date: purchaseDate.trim() || null,
          purchase_price: priceNum,
          fuel_type: fuelType,
          engine_displacement_cc: ccNum,
          license_plate: licensePlate.trim() || null,
          current_mileage: !isNaN(mileageNum) ? mileageNum : vehicle.current_mileage,
        },
      });

      Alert.alert('更新成功', '愛車資料已成功保存！');
      onClose();
    } catch (err: unknown) {
      let message = err instanceof Error ? err.message : '車輛更新失敗';
      if (message.includes('vehicle_type') || message.includes('not-null') || message.includes('not null')) {
        message = '請選擇車輛類型（汽車、機車或其他）';
      } else if (message.includes('failed to') || message.includes('SQLSTATE') || message.includes('ERROR:')) {
        message = '系統處理資料時發生異常，請稍後再試';
      }
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

          {/* Manufacture Date (出廠年月，自動解析年份) */}
          <DatePickerInput
            label="行照出廠年月 MANUFACTURE YEAR/MONTH"
            mode="month"
            value={manufactureDate}
            onChange={setManufactureDate}
            maximumDate={new Date()}
            placeholder="YYYY-MM (點擊選取出廠年月)"
            helperText={manufactureDate ? `已自動解析出廠年份：${manufactureDate.split('-')[0]} 年` : '選填，選擇後系統將自動解析年份'}
            containerClassName="mb-4"
          />

          {/* Registration Date (行照原發照日，推算定檢視窗) */}
          <DatePickerInput
            label="行照原發照日 REGISTRATION DATE"
            mode="date"
            value={registrationDate}
            onChange={setRegistrationDate}
            maximumDate={new Date()}
            placeholder="YYYY-MM-DD (點擊選取原發照日期)"
            helperText="選填，定檢日期依原發照日計算，前後各一個月有效"
            containerClassName="mb-4"
          />

          {/* Current Mileage */}
          <View className="mb-4">
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
            <DatePickerInput
              label="購入入庫日期 PURCHASE DATE"
              value={purchaseDate}
              onChange={setPurchaseDate}
              maximumDate={new Date()}
              placeholder="點擊選取購入日期"
              containerClassName="flex-1"
            />

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
