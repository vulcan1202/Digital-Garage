import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { useTranslation } from 'react-i18next';
import { useKeyboardBottomInset } from '../../hooks/useKeyboardBottomInset';
import { useCreateMaintenanceRecord } from '../../hooks/queries/useMaintenance';
import { MaintenanceRecordType } from '../../types/database';
import { reminderService } from '../../services/reminderService';
import { storageService } from '../../services/storageService';
import { networkMonitor } from '../../services/networkMonitor';
import { PhotoPickerSection, SelectedPhoto } from '../PhotoPickerSection';
import { DatePickerInput } from '../common/DatePickerInput';
import {
  validateMaintenanceItem,
  calculateValidTotalCost,
  MaintenanceItemInput,
  ValidatedMaintenanceItem,
} from '../../utils/validators/maintenanceItemValidator';

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
  const { t } = useTranslation();
  const today = new Date().toISOString().split('T')[0];
  const [recordType, setRecordType] = useState<MaintenanceRecordType>(initialRecordType || 'maintenance');

  // 多項目清單狀態
  const [items, setItems] = useState<MaintenanceItemInput[]>([
    { id: '1', name: '', cost: '' },
  ]);

  // 共用欄位
  const [serviceDate, setServiceDate] = useState(today);
  const [mileage, setMileage] = useState(currentVehicleMileage ? String(currentVehicleMileage) : '');
  const [shopName, setShopName] = useState('');
  const [note, setNote] = useState('');

  // 下次保養提示設定
  const [setNextReminder, setSetNextReminder] = useState(false);
  const [intervalKm, setIntervalKm] = useState('5000');
  const [intervalMonths, setIntervalMonths] = useState('6');

  // 工單相片選取
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedPhoto[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // 即時計算有效總計金額
  const totalCost = useMemo(() => calculateValidTotalCost(items), [items]);

  const resetForm = () => {
    setRecordType(initialRecordType || 'maintenance');
    setItems([{ id: Date.now().toString(), name: '', cost: '' }]);
    setServiceDate(today);
    setMileage(currentVehicleMileage ? String(currentVehicleMileage) : '');
    setShopName('');
    setNote('');
    setSetNextReminder(false);
    setIntervalKm('5000');
    setIntervalMonths('6');
    setSelectedPhotos([]);
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, { id: Date.now().toString(), name: '', cost: '' }]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleUpdateItem = (id: string, field: 'name' | 'cost', value: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  const executeSubmission = async (uploadPhotosToUse: boolean) => {
    const mileageNum = parseInt(mileage, 10);
    if (isNaN(mileageNum) || mileageNum < 0) {
      Alert.alert(t('common.status.error'), t('maintenance.validation.mileageRequired'));
      return;
    }

    // 1. 本地純函式驗證所有項目 (TC-04, TC-05, TC-12)
    const validItemList: { originalItem: MaintenanceItemInput; validated: ValidatedMaintenanceItem }[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const res = validateMaintenanceItem(item);
      if (res.type === 'ERROR') {
        Alert.alert(
          t('common.status.error'),
          t('maintenance.validation.itemError', {
            index: i + 1,
            reason: t(res.reasonKey),
          })
        );
        return;
      }
      if (res.type === 'VALID') {
        validItemList.push({ originalItem: item, validated: res.data });
      }
    }

    if (validItemList.length === 0) {
      Alert.alert(t('common.status.error'), t('maintenance.validation.emptyItems'));
      return;
    }

    // 鎖定按鈕避免連點
    setIsSubmitting(true);

    try {
      // 2. 處理照片上傳 (僅在允許且有照片時執行)
      let uploadedUrls: string[] = [];
      if (uploadPhotosToUse && selectedPhotos.length > 0) {
        setIsUploadingPhotos(true);
        for (const photo of selectedPhotos) {
          try {
            const res = await storageService.uploadLocalUri(vehicleId, 'maintenance', photo.uri);
            uploadedUrls.push(res.publicUrl);
          } catch (uploadErr) {
            console.warn('上傳保養照片失敗:', uploadErr);
          }
        }
        setIsUploadingPhotos(false);
      }

      // 3. 依序執行各項目 mutation (逐筆記錄結果)
      const successItemIds: string[] = [];
      let firstSuccessfulRecord: any = null;
      let photoAssigned = false;

      for (let idx = 0; idx < validItemList.length; idx++) {
        const { originalItem, validated } = validItemList[idx];
        // 照片歸屬規則：首個成功建立的項目掛載照片 (TC-08, TC-14)
        const photoUrlsForThisItem = !photoAssigned && uploadedUrls.length > 0 ? uploadedUrls : [];

        try {
          const created = await createMaintenanceMutation.mutateAsync({
            recordData: {
              vehicle_id: vehicleId,
              record_type: recordType,
              item_name: validated.name,
              service_date: serviceDate.trim() || today,
              mileage: mileageNum,
              cost: validated.cost,
              shop_name: shopName.trim() || null,
              note: note.trim() || null,
            },
            photoUrls: photoUrlsForThisItem,
          });

          successItemIds.push(originalItem.id);
          if (!photoAssigned && photoUrlsForThisItem.length > 0) {
            photoAssigned = true;
          }
          if (!firstSuccessfulRecord) {
            firstSuccessfulRecord = created;
          }
        } catch (itemErr) {
          console.warn(`項目 [${validated.name}] 寫入失敗:`, itemErr);
        }
      }

      // 4. 處理提醒建立 (P1: 若首筆成功且在線上)
      let reminderFailed = false;
      if (setNextReminder && firstSuccessfulRecord && firstSuccessfulRecord.id > 0) {
        const kmNum = intervalKm.trim() ? parseInt(intervalKm, 10) : null;
        const monthsNum = intervalMonths.trim() ? parseInt(intervalMonths, 10) : null;
        if ((kmNum && kmNum > 0) || (monthsNum && monthsNum > 0)) {
          try {
            await reminderService.createMaintenanceReminder({
              vehicleId,
              itemName: `下次${validItemList[0].validated.name}`,
              baseMileage: mileageNum,
              baseDate: serviceDate.trim() || today,
              intervalKm: kmNum && kmNum > 0 ? kmNum : null,
              intervalMonths: monthsNum && monthsNum > 0 ? monthsNum : null,
              maintenanceRecordId: firstSuccessfulRecord.id,
            });
          } catch (remErr) {
            console.warn('建立下次保養提醒失敗 (不影響工單紀錄):', remErr);
            reminderFailed = true; // TC-15: 記錄提醒失敗，不回滾紀錄
          }
        }
      }

      // 5. 彙整執行成果並提供細緻 UI 反饋 (TC-06, TC-07, TC-15)
      const successCount = successItemIds.length;
      const totalAttempted = validItemList.length;
      const isOnline = networkMonitor.getIsOnline();

      if (successCount === 0) {
        // 全部失敗
        Alert.alert(t('common.status.error'), t('maintenance.validation.saveFailed'));
      } else if (successCount === totalAttempted) {
        // 全部成功
        resetForm();
        onClose();

        if (!isOnline) {
          Alert.alert(
            t('common.status.success'),
            t('maintenance.validation.batchOfflineQueued', { count: successCount })
          );
        } else if (reminderFailed) {
          Alert.alert(
            t('common.status.success'),
            `${t('maintenance.validation.batchAllSuccess', { count: successCount })}\n\n${t(
              'maintenance.validation.reminderFailedNotice'
            )}`
          );
        } else {
          Alert.alert(
            t('common.status.success'),
            t('maintenance.validation.batchAllSuccess', { count: successCount })
          );
        }
      } else {
        // 部分成功 (TC-06)：從表單中移除已成功的項目，保留失敗項目供車主重試
        setItems((prev) => prev.filter((it) => !successItemIds.includes(it.id)));

        const failCount = totalAttempted - successCount;
        Alert.alert(
          '部分儲存完成',
          t('maintenance.validation.batchPartialSuccess', {
            successCount,
            failCount,
          })
        );
      }
    } finally {
      setIsSubmitting(false);
      setIsUploadingPhotos(false);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || createMaintenanceMutation.isPending || isUploadingPhotos) {
      return; // TC-09: 提交鎖防止重複點擊
    }

    const isOnline = networkMonitor.getIsOnline();

    // 離線方案 A 檢查 (TC-13)
    if (!isOnline && selectedPhotos.length > 0) {
      Alert.alert(
        '離線照片上傳提示',
        t('maintenance.validation.offlinePhotoWarning'),
        [
          { text: t('common.actions.cancel'), style: 'cancel' },
          {
            text: '僅儲存文字',
            onPress: () => executeSubmission(false),
          },
        ]
      );
      return;
    }

    await executeSubmission(true);
  };

  const isFormLocked = isSubmitting || createMaintenanceMutation.isPending || isUploadingPhotos;

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
              {recordType === 'maintenance' ? t('maintenance.addMaintenance') : t('maintenance.addRepair')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            disabled={isFormLocked}
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
              disabled={isFormLocked}
              className={`flex-1 py-2.5 rounded-lg items-center ${
                recordType === 'maintenance' ? 'bg-racing-orange/20 border border-racing-orange/40' : ''
              }`}
            >
              <Text
                className={`text-xs font-mono font-bold ${
                  recordType === 'maintenance' ? 'text-racing-orange' : 'text-metal-400'
                }`}
              >
                {t('maintenance.types.maintenanceTab')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setRecordType('repair')}
              disabled={isFormLocked}
              className={`flex-1 py-2.5 rounded-lg items-center ${
                recordType === 'repair' ? 'bg-racing-red/20 border border-racing-red/40' : ''
              }`}
            >
              <Text
                className={`text-xs font-mono font-bold ${
                  recordType === 'repair' ? 'text-racing-red' : 'text-metal-400'
                }`}
              >
                {t('maintenance.types.repairTab')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 多項目動態輸入區塊 (Dynamic Multi-Item Section) */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider">
                {t('maintenance.fields.itemName')} ({items.length})
              </Text>
              <TouchableOpacity
                onPress={handleAddItem}
                disabled={isFormLocked}
                className="flex-row items-center bg-racing-orange/20 px-2.5 py-1 rounded-full border border-racing-orange/30"
              >
                <Ionicons name="add" size={14} color="#ff6b00" />
                <Text className="text-[11px] font-mono font-bold text-racing-orange ml-1">
                  {t('maintenance.fields.addItem')}
                </Text>
              </TouchableOpacity>
            </View>

            {items.map((item, idx) => (
              <View
                key={item.id}
                className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-3 mb-2.5"
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-[10px] font-mono font-bold text-racing-orange">
                    {t('maintenance.fields.itemIndex', { index: idx + 1 })}
                  </Text>
                  {items.length > 1 && (
                    <TouchableOpacity
                      onPress={() => handleRemoveItem(item.id)}
                      disabled={isFormLocked}
                      className="p-1"
                    >
                      <Ionicons name="trash-outline" size={14} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* 項目名稱輸入 */}
                <TextInput
                  value={item.name}
                  onChangeText={(txt) => handleUpdateItem(item.id, 'name', txt)}
                  placeholder={
                    recordType === 'maintenance'
                      ? t('maintenance.fields.itemNamePlaceholder')
                      : '例: 前三角架襯套異音更換'
                  }
                  placeholderTextColor="#52525b"
                  editable={!isFormLocked}
                  className="bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs mb-2"
                />

                {/* 個別金額輸入 */}
                <View className="flex-row items-center bg-zinc-950 border border-white/10 rounded-lg px-3 py-1.5">
                  <Text className="text-xs font-mono text-metal-400 mr-2">NT$</Text>
                  <TextInput
                    value={item.cost}
                    onChangeText={(txt) => handleUpdateItem(item.id, 'cost', txt)}
                    placeholder="0"
                    placeholderTextColor="#52525b"
                    keyboardType="decimal-pad"
                    editable={!isFormLocked}
                    className="flex-1 text-racing-orange font-mono font-bold text-sm"
                  />
                </View>
              </View>
            ))}

            {/* 即時總計看板 (Live Total Cost Header) */}
            <View className="flex-row items-center justify-between bg-zinc-950 px-3.5 py-2.5 rounded-xl border border-racing-orange/30 mt-1">
              <Text className="text-xs font-mono text-metal-300">
                {t('maintenance.fields.totalEstimatedCost')}
              </Text>
              <Text className="text-base font-mono font-bold text-racing-orange">
                NT$ {totalCost.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* 日期與里程 (共用) */}
          <View className="flex-row gap-3 mb-4">
            <DatePickerInput
              label={t('maintenance.fields.serviceDate')}
              required
              value={serviceDate}
              onChange={setServiceDate}
              maximumDate={new Date()}
              containerClassName="flex-1"
            />

            <View className="flex-1">
              <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                {t('maintenance.fields.serviceMileage')} *
              </Text>
              <TextInput
                value={mileage}
                onChangeText={setMileage}
                placeholder={t('maintenance.fields.serviceMileagePlaceholder')}
                placeholderTextColor="#52525b"
                keyboardType="numeric"
                editable={!isFormLocked}
                className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
              />
            </View>
          </View>

          {/* 保養廠 (共用) */}
          <View className="mb-4">
            <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
              {t('maintenance.fields.shopName')}
            </Text>
            <TextInput
              value={shopName}
              onChangeText={setShopName}
              placeholder={t('maintenance.fields.shopNamePlaceholder')}
              placeholderTextColor="#52525b"
              editable={!isFormLocked}
              className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
            />
          </View>

          {/* 備註 (共用) */}
          <View className="mb-4">
            <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
              {t('maintenance.fields.notes')}
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={t('maintenance.fields.notesPlaceholder')}
              placeholderTextColor="#52525b"
              multiline
              numberOfLines={3}
              editable={!isFormLocked}
              className="bg-zinc-950 border border-white/10 rounded-xl p-3 text-white font-mono text-sm"
            />
          </View>

          {/* 下次保養提醒設定 (選填，第一版綁定首筆有效項目) */}
          <View className="mb-6 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
            <TouchableOpacity
              onPress={() => setSetNextReminder(!setNextReminder)}
              disabled={isFormLocked}
              activeOpacity={0.8}
              className="flex-row items-center justify-between"
            >
              <View className="flex-row items-center flex-1 mr-2">
                <View className="w-7 h-7 rounded-lg bg-amber-500/20 items-center justify-center mr-2.5">
                  <Ionicons name="pulse" size={15} color="#f59e0b" />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-mono font-bold text-xs">
                    {t('maintenance.reminderSettings.syncNext')}
                  </Text>
                  <Text className="text-[10px] text-metal-500 font-mono">
                    {t('maintenance.reminderSettings.subtitle')}
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
                    {t('maintenance.reminderSettings.intervalKm')}
                  </Text>
                  <View className="flex-row gap-2 mb-2">
                    {['3000', '5000', '10000'].map((km) => (
                      <TouchableOpacity
                        key={km}
                        onPress={() => setIntervalKm(km)}
                        disabled={isFormLocked}
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
                    placeholder={t('maintenance.reminderSettings.intervalKmPlaceholder')}
                    placeholderTextColor="#52525b"
                    keyboardType="numeric"
                    editable={!isFormLocked}
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2 text-white font-mono text-sm"
                  />
                </View>

                {/* 時間間隔 */}
                <View>
                  <Text className="text-[11px] font-mono text-metal-400 mb-1.5">
                    {t('maintenance.reminderSettings.intervalMonths')}
                  </Text>
                  <View className="flex-row gap-2 mb-2">
                    {['3', '6', '12'].map((m) => (
                      <TouchableOpacity
                        key={m}
                        onPress={() => setIntervalMonths(m)}
                        disabled={isFormLocked}
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
                    placeholder={t('maintenance.reminderSettings.intervalMonthsPlaceholder')}
                    placeholderTextColor="#52525b"
                    keyboardType="numeric"
                    editable={!isFormLocked}
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2 text-white font-mono text-sm"
                  />
                </View>

                <Text className="text-[10px] text-metal-500 font-mono mt-3">
                  {t('maintenance.reminderSettings.dualTrackNotice')}
                </Text>
              </View>
            )}
          </View>

          {/* Maintenance Photos Picker (共用工單相片) */}
          <View className="mb-2">
            <PhotoPickerSection
              photos={selectedPhotos}
              onChangePhotos={setSelectedPhotos}
              maxPhotos={5}
              title={t('maintenance.fields.photosTitle')}
              subtitle={t('maintenance.fields.photosSubtitle')}
            />
            <Text className="text-[10px] text-metal-500 font-mono mt-1 px-1">
              {t('maintenance.fields.photosSharedNotice')}
            </Text>
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3 mb-4 mt-4">
            <TouchableOpacity
              onPress={onClose}
              disabled={isFormLocked}
              className="flex-1 py-3.5 rounded-full bg-white/[0.06] border border-white/10 items-center justify-center"
            >
              <Text className="text-metal-300 font-mono text-xs">{t('common.actions.cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isFormLocked}
              className="flex-2 flex-row items-center justify-center rounded-full bg-racing-orange px-6 py-3.5 flex-1"
            >
              {isFormLocked ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Text className="text-black font-bold font-mono text-xs mr-2">
                    {t('maintenance.fields.saveBtn')}
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
