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
import { useQueryClient } from '@tanstack/react-query';
import { useCreateVehicle } from '../../hooks/queries/useVehicles';
import { queryKeys } from '../../hooks/queries/queryKeys';
import { useKeyboardBottomInset } from '../../hooks/useKeyboardBottomInset';
import { DoubleBezelCard } from '../DoubleBezelCard';
import { PhotoPickerSection, SelectedPhoto } from '../PhotoPickerSection';
import { storageService } from '../../services/storageService';
import { vehicleService } from '../../services/vehicleService';

import { VehicleType, FuelType } from '../../types/database';

interface AddVehicleModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: (newId: number) => void;
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

export const AddVehicleModal: React.FC<AddVehicleModalProps> = ({
  visible,
  onClose,
  onCreated,
}) => {
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [year, setYear] = useState('');
  const [manufactureDate, setManufactureDate] = useState('');
  const [currentMileage, setCurrentMileage] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [fuelType, setFuelType] = useState<FuelType | null>(null);
  const [engineDisplacement, setEngineDisplacement] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedPhoto[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);

  const createVehicleMutation = useCreateVehicle();
  const queryClient = useQueryClient();
  const rawKeyboardInset = useKeyboardBottomInset();
  const androidKeyboardInset = Platform.OS === 'android' ? rawKeyboardInset : 0;

  const resetForm = () => {
    setBrand('');
    setModel('');
    setVehicleType(null);
    setYear('');
    setManufactureDate('');
    setCurrentMileage('');
    setPurchaseDate('');
    setPurchasePrice('');
    setFuelType(null);
    setEngineDisplacement('');
    setLicensePlate('');
    setSelectedPhotos([]);
  };

  const handleCreate = async () => {
    if (!brand.trim() || !model.trim()) {
      Alert.alert('資料不齊全', '車輛廠牌 (Brand) 與車型名稱 (Model) 為必填。');
      return;
    }

    if (!vehicleType) {
      Alert.alert('請選擇車輛類型', '車輛類型 (汽車 / 機車 / 其他) 為必填項目，不可留空。');
      return;
    }

    const mileageNum = parseInt(currentMileage, 10);
    if (currentMileage && (isNaN(mileageNum) || mileageNum < 0)) {
      Alert.alert('里程數格式錯誤', '當前里程數必須為大於或等於 0 之整數。');
      return;
    }

    const yearNum = year ? parseInt(year, 10) : null;
    if (year && (isNaN(yearNum!) || yearNum! < 1886 || yearNum! > 2100)) {
      Alert.alert('年份格式錯誤', '請輸入有效的年份 (1886 至 2100)。');
      return;
    }

    const priceNum = purchasePrice ? parseFloat(purchasePrice) : null;
    if (purchasePrice && (isNaN(priceNum!) || priceNum! < 0)) {
      Alert.alert('購車金額格式錯誤', '購車金額必須為大於或等於 0 之數字。');
      return;
    }

    const ccNum = engineDisplacement ? parseInt(engineDisplacement, 10) : null;
    if (engineDisplacement && (isNaN(ccNum!) || ccNum! <= 0)) {
      Alert.alert('排氣量格式錯誤', '排氣量 (cc) 必須為大於 0 之正整數。');
      return;
    }

    try {
      setIsUploadingPhotos(true);
      const created = await createVehicleMutation.mutateAsync({
        brand: brand.trim(),
        model: model.trim(),
        vehicle_type: vehicleType,
        year: yearNum,
        manufacture_date: manufactureDate.trim() ? manufactureDate.trim() : null,
        current_mileage: !isNaN(mileageNum) ? mileageNum : 0,
        initial_mileage: !isNaN(mileageNum) ? mileageNum : 0,
        purchase_date: purchaseDate.trim() ? purchaseDate.trim() : null,
        purchase_price: priceNum,
        fuel_type: fuelType,
        engine_displacement_cc: ccNum,
        license_plate: licensePlate.trim() ? licensePlate.trim() : null,
      });

      // 若有選取相片，上傳至 vehicle-media 並寫入 VehiclePhotos (第一張自動為封面)
      if (selectedPhotos.length > 0) {
        for (let i = 0; i < selectedPhotos.length; i++) {
          try {
            const photo = selectedPhotos[i];
            const uploadResult = await storageService.uploadLocalUri(
              created.id,
              'covers',
              photo.uri
            );
            await vehicleService.addVehiclePhoto(
              created.id,
              uploadResult.publicUrl,
              i === 0, // 第一張設為封面
              i
            );
          } catch (photoErr) {
            console.warn('新增車輛時上傳相片失敗:', photoErr);
          }
        }
        // 上傳相片完畢後重新 invalidate 車庫列表，確保即時呈現封面圖
        await queryClient.invalidateQueries({ queryKey: queryKeys.vehicles });
        await queryClient.invalidateQueries({ queryKey: queryKeys.vehicle(created.id) });
      }

      Alert.alert('車輛登錄成功', `${created.brand} ${created.model} 已加入您的車庫！`);
      resetForm();
      onClose();
      if (onCreated) {
        onCreated(created.id);
      }
    } catch (err: unknown) {
      let message = err instanceof Error ? err.message : '車輛新增失敗';
      if (message.includes('vehicle_type') || message.includes('not-null') || message.includes('not null')) {
        message = '請選擇車輛類型（汽車、機車或其他）';
      } else if (message.includes('failed to') || message.includes('SQLSTATE') || message.includes('ERROR:')) {
        message = '系統處理資料時發生異常，請稍後再試';
      }
      Alert.alert('新增失敗', message);
    } finally {
      setIsUploadingPhotos(false);
    }
  };

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
          contentContainerStyle={{ paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Vehicle Type Selector (必填，無預設值) */}
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
                placeholder="例: Porsche / Ducati"
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
                placeholder="例: 911 GT3 / Panigale V4"
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
                placeholder="例: 3996 / 1103"
                placeholderTextColor="#52525b"
                keyboardType="numeric"
                className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
              />
            </View>
          </View>

          {/* Manufacture Date */}
          <View className="mb-4">
            <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
              行照出廠日期 MANUFACTURE DATE (選填，自動推算驗車視窗)
            </Text>
            <TextInput
              value={manufactureDate}
              onChangeText={(text) => {
                setManufactureDate(text);
                if (text.length >= 4 && !year) {
                  const y = text.substring(0, 4);
                  if (!isNaN(parseInt(y, 10))) setYear(y);
                }
              }}
              placeholder="YYYY-MM-DD (例: 2020-05-15)"
              placeholderTextColor="#52525b"
              className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
            />
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
          <View className="flex-row gap-3 mb-4">
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

          {/* Vehicle Photos Picker */}
          <PhotoPickerSection
            photos={selectedPhotos}
            onChangePhotos={setSelectedPhotos}
            maxPhotos={5}
            title="愛車相片 (第一張將作為封面)"
            subtitle="支援即時拍照或相簿多選（客戶端等比壓縮最佳化）"
          />

          {/* Action Buttons */}
          <View className="flex-row gap-3 mb-4">
            <TouchableOpacity
              onPress={onClose}
              disabled={createVehicleMutation.isPending || isUploadingPhotos}
              className="flex-1 py-3.5 rounded-full bg-white/[0.06] border border-white/10 items-center justify-center"
            >
              <Text className="text-metal-300 font-mono text-xs">取消</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCreate}
              disabled={createVehicleMutation.isPending || isUploadingPhotos}
              className="flex-2 flex-row items-center justify-center rounded-full bg-racing-orange px-6 py-3.5 flex-1"
            >
              {createVehicleMutation.isPending || isUploadingPhotos ? (
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
