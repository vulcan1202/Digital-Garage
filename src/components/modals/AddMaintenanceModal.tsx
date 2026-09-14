import React, { useState, useEffect, useRef } from 'react';
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
import { useKeyboardBottomInset } from '../../hooks/useKeyboardBottomInset';
import { useCreateMaintenanceRecord } from '../../hooks/queries/useMaintenance';
import { MaintenanceRecordType } from '../../types/database';
import { reminderService } from '../../services/reminderService';
import { storageService } from '../../services/storageService';
import { PhotoPickerSection, SelectedPhoto } from '../PhotoPickerSection';

interface AddMaintenanceModalProps {
  visible: boolean;
  vehicleId: number;
  currentVehicleMileage?: number;
  initialRecordType?: MaintenanceRecordType;
  onClose: () => void;
}

export const AddMaintenanceModal: React.FC<AddMaintenanceModalProps> = ({
  visible,
  vehicleId,
  currentVehicleMileage,
  initialRecordType,
  onClose,
}) => {
  const today = new Date().toISOString().split('T')[0];
  const [recordType, setRecordType] = useState<MaintenanceRecordType>(initialRecordType || 'maintenance');
  const [itemName, setItemName] = useState('');
  const [serviceDate, setServiceDate] = useState(today);
  const [mileage, setMileage] = useState(currentVehicleMileage ? String(currentVehicleMileage) : '');
  const [cost, setCost] = useState('');
  const [shopName, setShopName] = useState('');
  const [note, setNote] = useState('');

  // 下次保養提示設定
  const [setNextReminder, setSetNextReminder] = useState(false);
  const [intervalKm, setIntervalKm] = useState('5000');
  const [intervalMonths, setIntervalMonths] = useState('6');

  // 工單相片選取
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedPhoto[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);

  const prevVisibleRef = useRef(visible);
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      setRecordType(initialRecordType || 'maintenance');
    }
    prevVisibleRef.current = visible;
  }, [visible, initialRecordType]);

  const createMaintenanceMutation = useCreateMaintenanceRecord();
  const rawKeyboardInset = useKeyboardBottomInset();
  const androidKeyboardInset = Platform.OS === 'android' ? rawKeyboardInset : 0;

  const resetForm = () => {
    setRecordType(initialRecordType || 'maintenance');
    setItemName('');
    setServiceDate(today);
    setMileage(currentVehicleMileage ? String(currentVehicleMileage) : '');
    setCost('');
    setShopName('');
    setNote('');
    setSetNextReminder(false);
    setIntervalKm('5000');
    setIntervalMonths('6');
    setSelectedPhotos([]);
  };

  const handleSubmit = async () => {
    if (!itemName.trim()) {
      Alert.alert('資料不齊全', '請填寫保養或維修項目名稱 (Item Name)。');
      return;
    }

    const mileageNum = parseInt(mileage, 10);
    if (isNaN(mileageNum) || mileageNum < 0) {
      Alert.alert('里程數格式錯誤', '請輸入施作時的車輛總里程數 (公里)。');
      return;
    }

    const costNum = cost ? parseFloat(cost) : 0;
    if (isNaN(costNum) || costNum < 0) {
      Alert.alert('費用格式錯誤', '費用必須大於或等於 0 元。');
      return;
    }

    try {
      setIsUploadingPhotos(true);

      // 1. 若有選擇工單相片，先上傳至 Supabase Storage
      const uploadedUrls: string[] = [];
      for (const photo of selectedPhotos) {
        try {
          const res = await storageService.uploadLocalUri(vehicleId, 'maintenance', photo.uri);
          uploadedUrls.push(res.publicUrl);
        } catch (uploadErr) {
          console.warn('上傳保養照片失敗:', uploadErr);
        }
      }

      const createdRecord = await createMaintenanceMutation.mutateAsync({
        recordData: {
          vehicle_id: vehicleId,
          record_type: recordType,
          item_name: itemName.trim(),
          service_date: serviceDate.trim() || today,
          mileage: mileageNum,
          cost: costNum,
          shop_name: shopName.trim() || null,
          note: note.trim() || null,
        },
        photoUrls: uploadedUrls,
      });

      // 同步建立下次保養提醒
      if (setNextReminder) {
        const kmNum = intervalKm.trim() ? parseInt(intervalKm, 10) : null;
        const monthsNum = intervalMonths.trim() ? parseInt(intervalMonths, 10) : null;
        if ((kmNum && kmNum > 0) || (monthsNum && monthsNum > 0)) {
          try {
            await reminderService.createMaintenanceReminder({
              vehicleId,
              itemName: `下次${itemName.trim()}`,
              baseMileage: mileageNum,
              baseDate: serviceDate.trim() || today,
              intervalKm: kmNum && kmNum > 0 ? kmNum : null,
              intervalMonths: monthsNum && monthsNum > 0 ? monthsNum : null,
              maintenanceRecordId: createdRecord.id,
            });
          } catch (remErr) {
            console.warn('建立下次保養提醒失敗:', remErr);
          }
        }
      }

      Alert.alert(
        '紀錄儲存成功',
        `已成功建立 ${recordType === 'maintenance' ? '定期保養' : '維修工單'}：「${itemName.trim()}」！`
      );
      resetForm();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '保養紀錄新增失敗';
      Alert.alert('新增失敗', message);
    } finally {
      setIsUploadingPhotos(false);
    }
  };

  const modalBody = (
    <View className="flex-1 bg-black/80 justify-end" style={{ paddingBottom: androidKeyboardInset }}>
      <View className="bg-garage-card rounded-t-3xl border-t border-white/10 p-6 max-h-[88%] flex-1 justify-between">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between pb-4 border-b border-white/[0.08]">
              <View>
                <Text className="text-[10px] font-mono tracking-[0.2em] text-racing-orange uppercase font-bold">
                  SERVICE & REPAIR LOG
                </Text>
                <Text className="text-xl font-bold text-white tracking-tight mt-0.5">
                  登錄保養 / 維修日誌
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
              {/* 工單性質切換 (Regular Maintenance vs Repair) */}
              <View className="flex-row bg-zinc-950 p-1 rounded-xl border border-white/10 mb-4">
                <TouchableOpacity
                  onPress={() => setRecordType('maintenance')}
                  className={`flex-1 py-2.5 rounded-lg items-center ${
                    recordType === 'maintenance' ? 'bg-racing-orange/20 border border-racing-orange/40' : ''
                  }`}
                >
                  <Text
                    className={`text-xs font-mono font-bold ${
                      recordType === 'maintenance' ? 'text-racing-orange' : 'text-metal-400'
                    }`}
                  >
                    定期保養 (Maintenance)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setRecordType('repair')}
                  className={`flex-1 py-2.5 rounded-lg items-center ${
                    recordType === 'repair' ? 'bg-racing-red/20 border border-racing-red/40' : ''
                  }`}
                >
                  <Text
                    className={`text-xs font-mono font-bold ${
                      recordType === 'repair' ? 'text-racing-red' : 'text-metal-400'
                    }`}
                  >
                    維修排除 (Repair)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 項目名稱 */}
              <View className="mb-4">
                <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                  施作項目 ITEM NAME *
                </Text>
                <TextInput
                  value={itemName}
                  onChangeText={setItemName}
                  placeholder={recordType === 'maintenance' ? '例: 10,000 公里定期大保養 + 機油芯' : '例: 前三角架襯套異音更換'}
                  placeholderTextColor="#52525b"
                  className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                />
              </View>

              {/* 日期與里程 */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    工單日期 SERVICE DATE *
                  </Text>
                  <TextInput
                    value={serviceDate}
                    onChangeText={setServiceDate}
                    placeholder="2024-03-20"
                    placeholderTextColor="#52525b"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>

                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    施作里程 ODOMETER (KM) *
                  </Text>
                  <TextInput
                    value={mileage}
                    onChangeText={setMileage}
                    placeholder="例: 20500"
                    placeholderTextColor="#52525b"
                    keyboardType="numeric"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>
              </View>

              {/* 費用與保養廠 */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    總花費 COST ($)
                  </Text>
                  <TextInput
                    value={cost}
                    onChangeText={setCost}
                    placeholder="0"
                    placeholderTextColor="#52525b"
                    keyboardType="decimal-pad"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-racing-orange font-mono font-bold text-base"
                  />
                </View>

                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    施作店家 / 保養廠
                  </Text>
                  <TextInput
                    value={shopName}
                    onChangeText={setShopName}
                    placeholder="例: 原廠授權中心"
                    placeholderTextColor="#52525b"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>
              </View>

              {/* 備註 */}
              <View className="mb-4">
                <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                  技師備註 / 工單內容 NOTE
                </Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="更換 5W-40 全合成機油 4.5L、螺絲墊片更新、胎壓檢查 36 PSI"
                  placeholderTextColor="#52525b"
                  multiline
                  numberOfLines={3}
                  className="bg-zinc-950 border border-white/10 rounded-xl p-3 text-white font-mono text-sm"
                />
              </View>

              {/* 下次保養提醒設定 (選填) */}
              <View className="mb-6 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                <TouchableOpacity
                  onPress={() => setSetNextReminder(!setNextReminder)}
                  activeOpacity={0.8}
                  className="flex-row items-center justify-between"
                >
                  <View className="flex-row items-center flex-1 mr-2">
                    <View className="w-7 h-7 rounded-lg bg-amber-500/20 items-center justify-center mr-2.5">
                      <Ionicons name="pulse" size={15} color="#f59e0b" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-mono font-bold text-xs">
                        同步設定下次保養提醒
                      </Text>
                      <Text className="text-[10px] text-metal-500 font-mono">
                        依照里程數、時間月份或雙軌預警
                      </Text>
                    </View>
                  </View>
                  <View
                    className={`w-5 h-5 rounded border items-center justify-center ${
                      setNextReminder
                        ? 'bg-amber-500 border-amber-500'
                        : 'border-white/30 bg-black/40'
                    }`}
                  >
                    {setNextReminder && <Ionicons name="checkmark" size={14} color="#000" />}
                  </View>
                </TouchableOpacity>

                {setNextReminder && (
                  <View className="mt-4 pt-3 border-t border-white/[0.06]">
                    {/* 里程間隔 */}
                    <View className="mb-3.5">
                      <Text className="text-[11px] font-mono text-metal-400 mb-1.5">
                        下次保養間隔里程 (KM)
                      </Text>
                      <View className="flex-row gap-2 mb-2">
                        {['3000', '5000', '10000'].map((km) => (
                          <TouchableOpacity
                            key={km}
                            onPress={() => setIntervalKm(km)}
                            className={`px-3 py-1 rounded-full border ${
                              intervalKm === km
                                ? 'bg-amber-500/20 border-amber-500'
                                : 'bg-black/30 border-white/10'
                            }`}
                          >
                            <Text
                              className={`text-[10px] font-mono ${
                                intervalKm === km ? 'text-amber-400 font-bold' : 'text-metal-400'
                              }`}
                            >
                              +{parseInt(km).toLocaleString()} KM
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TextInput
                        value={intervalKm}
                        onChangeText={setIntervalKm}
                        placeholder="例: 5000 (留空則不依里程)"
                        placeholderTextColor="#52525b"
                        keyboardType="numeric"
                        className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2 text-white font-mono text-sm"
                      />
                    </View>

                    {/* 時間間隔 */}
                    <View>
                      <Text className="text-[11px] font-mono text-metal-400 mb-1.5">
                        下次保養間隔時間 (月份)
                      </Text>
                      <View className="flex-row gap-2 mb-2">
                        {['3', '6', '12'].map((m) => (
                          <TouchableOpacity
                            key={m}
                            onPress={() => setIntervalMonths(m)}
                            className={`px-3 py-1 rounded-full border ${
                              intervalMonths === m
                                ? 'bg-amber-500/20 border-amber-500'
                                : 'bg-black/30 border-white/10'
                            }`}
                          >
                            <Text
                              className={`text-[10px] font-mono ${
                                intervalMonths === m ? 'text-amber-400 font-bold' : 'text-metal-400'
                              }`}
                            >
                              +{m} 個月
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TextInput
                        value={intervalMonths}
                        onChangeText={setIntervalMonths}
                        placeholder="例: 6 (留空則不依時間)"
                        placeholderTextColor="#52525b"
                        keyboardType="numeric"
                        className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2 text-white font-mono text-sm"
                      />
                    </View>

                    <Text className="text-[10px] text-metal-500 font-mono mt-3">
                      * 雙軌提示：保養雷達將自動比對里程與月份，兩者先到者先進行即期/過期警示。
                    </Text>
                  </View>
                )}
              </View>

              {/* Maintenance Photos Picker */}
              <PhotoPickerSection
                photos={selectedPhotos}
                onChangePhotos={setSelectedPhotos}
                maxPhotos={5}
                title="維修工單/發票照片"
                subtitle="上傳工單證明或零件施作照片（等比壓縮至1920px）"
              />

              {/* Action Buttons */}
              <View className="flex-row gap-3 mb-4">
                <TouchableOpacity
                  onPress={onClose}
                  disabled={createMaintenanceMutation.isPending || isUploadingPhotos}
                  className="flex-1 py-3.5 rounded-full bg-white/[0.06] border border-white/10 items-center justify-center"
                >
                  <Text className="text-metal-300 font-mono text-xs">取消</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={createMaintenanceMutation.isPending || isUploadingPhotos}
                  className="flex-2 flex-row items-center justify-center rounded-full bg-racing-orange px-6 py-3.5 flex-1"
                >
                  {createMaintenanceMutation.isPending || isUploadingPhotos ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <>
                      <Text className="text-black font-bold font-mono text-xs mr-2">
                        儲存保修日誌
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
