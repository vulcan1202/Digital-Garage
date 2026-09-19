import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useKeyboardBottomInset } from '../../hooks/useKeyboardBottomInset';
import { useUpdateMaintenanceRecord } from '../../hooks/queries/useMaintenance';
import { MaintenanceRecordRow, MaintenanceRecordType } from '../../types/database';
import { DatePickerInput } from '../common/DatePickerInput';

interface EditMaintenanceModalProps {
  visible: boolean;
  onClose: () => void;
  record: MaintenanceRecordRow | null;
  onSuccess?: () => void;
}

export const EditMaintenanceModal: React.FC<EditMaintenanceModalProps> = ({
  visible,
  onClose,
  record,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const updateMaintenance = useUpdateMaintenanceRecord();
  const rawKeyboardInset = useKeyboardBottomInset();
  const androidKeyboardInset = Platform.OS === 'android' ? rawKeyboardInset : 0;

  const [recordType, setRecordType] = useState<MaintenanceRecordType>('maintenance');
  const [itemName, setItemName] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [mileage, setMileage] = useState('');
  const [cost, setCost] = useState('');
  const [shopName, setShopName] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (record && visible) {
      setRecordType(record.record_type || 'maintenance');
      setItemName(record.item_name || '');
      setServiceDate(record.service_date ? record.service_date.substring(0, 10) : new Date().toISOString().substring(0, 10));
      setMileage(record.mileage != null ? String(record.mileage) : '');
      setCost(record.cost != null ? String(record.cost) : '');
      setShopName(record.shop_name || '');
      setNote(record.note || '');
    }
  }, [record, visible]);

  const handleSubmit = async () => {
    if (!record) return;

    const trimmedItemName = itemName.trim();
    const parsedMileage = parseInt(mileage, 10);
    const parsedCost = parseFloat(cost);

    if (!trimmedItemName) {
      Alert.alert(t('common.status.error'), t('maintenance.validation.itemNameRequired'));
      return;
    }
    if (isNaN(parsedMileage) || parsedMileage < 0) {
      Alert.alert(t('common.status.error'), t('maintenance.validation.mileageRequired'));
      return;
    }
    if (isNaN(parsedCost) || parsedCost < 0) {
      Alert.alert(t('common.status.error'), t('maintenance.validation.costInvalid'));
      return;
    }

    try {
      await updateMaintenance.mutateAsync({
        id: record.id,
        data: {
          item_name: trimmedItemName,
          record_type: recordType,
          service_date: serviceDate || new Date().toISOString().substring(0, 10),
          mileage: parsedMileage,
          cost: parsedCost,
          shop_name: shopName.trim() || null,
          note: note.trim() || null,
        },
      });

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('maintenance.validation.updateFailed');
      Alert.alert(t('common.status.error'), msg);
    }
  };

  const modalBody = (
    <View className="flex-1 justify-end bg-black/60" style={{ paddingBottom: androidKeyboardInset }}>
      <View className="bg-slate-900 border-t border-slate-800 rounded-t-3xl max-h-[88%] flex-1 justify-between p-6">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-4 border-b border-slate-800">
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-full bg-blue-500/10 items-center justify-center mr-3">
                <Ionicons name="construct-outline" size={20} color="#3B82F6" />
              </View>
              <Text className="text-xl font-bold text-white">{t('maintenance.editRecord')}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
            >
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView
            className="flex-1 mt-4"
            contentContainerStyle={{ paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* 類別切換 */}
            <View className="flex-row gap-2 mb-4">
              <TouchableOpacity
                onPress={() => setRecordType('maintenance')}
                className={`flex-1 py-2.5 rounded-xl items-center border flex-row justify-center gap-2 ${
                  recordType === 'maintenance'
                    ? 'bg-blue-500/20 border-blue-500'
                    : 'bg-slate-800/80 border-slate-700'
                }`}
              >
                <Ionicons
                  name="shield-checkmark"
                  size={16}
                  color={recordType === 'maintenance' ? '#3B82F6' : '#94A3B8'}
                />
                <Text
                  className={`text-xs font-semibold ${
                    recordType === 'maintenance' ? 'text-blue-400' : 'text-slate-400'
                  }`}
                >
                  {t('maintenance.types.maintenance')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setRecordType('repair')}
                className={`flex-1 py-2.5 rounded-xl items-center border flex-row justify-center gap-2 ${
                  recordType === 'repair'
                    ? 'bg-amber-500/20 border-amber-500'
                    : 'bg-slate-800/80 border-slate-700'
                }`}
              >
                <Ionicons
                  name="construct"
                  size={16}
                  color={recordType === 'repair' ? '#F59E0B' : '#94A3B8'}
                />
                <Text
                  className={`text-xs font-semibold ${
                    recordType === 'repair' ? 'text-amber-400' : 'text-slate-400'
                  }`}
                >
                  {t('maintenance.types.repair')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 項目名稱 */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-slate-400 mb-1.5">{t('maintenance.fields.itemName')} *</Text>
              <TextInput
                value={itemName}
                onChangeText={setItemName}
                placeholder={t('maintenance.fields.itemNamePlaceholder')}
                placeholderTextColor="#64748B"
                className="bg-slate-800/80 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm"
              />
            </View>

            {/* 日期與里程 */}
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
                <Text className="text-xs font-semibold text-slate-400 mb-1.5">{t('maintenance.fields.serviceMileage')} *</Text>
                <TextInput
                  value={mileage}
                  onChangeText={setMileage}
                  keyboardType="numeric"
                  placeholder={t('maintenance.fields.serviceMileagePlaceholder')}
                  placeholderTextColor="#64748B"
                  className="bg-slate-800/80 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm"
                />
              </View>
            </View>

            {/* 費用與店家 */}
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-xs font-semibold text-slate-400 mb-1.5">{t('maintenance.fields.cost')} *</Text>
                <TextInput
                  value={cost}
                  onChangeText={setCost}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#64748B"
                  className="bg-slate-800/80 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm"
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-slate-400 mb-1.5">{t('maintenance.fields.shopName')}</Text>
                <TextInput
                  value={shopName}
                  onChangeText={setShopName}
                  placeholder={t('maintenance.fields.shopNamePlaceholder')}
                  placeholderTextColor="#64748B"
                  className="bg-slate-800/80 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm"
                />
              </View>
            </View>

            {/* 備註 */}
            <View className="mb-6">
              <Text className="text-xs font-semibold text-slate-400 mb-1.5">{t('maintenance.fields.notes')}</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={t('maintenance.fields.notesPlaceholder')}
                placeholderTextColor="#64748B"
                multiline
                numberOfLines={3}
                className="bg-slate-800/80 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm min-h-[70px]"
              />
            </View>

            {/* Actions */}
            <View className="flex-row gap-3 mb-6">
              <TouchableOpacity
                onPress={onClose}
                className="flex-1 py-3.5 rounded-xl bg-slate-800 border border-slate-700 items-center justify-center"
              >
                <Text className="text-slate-300 font-semibold">{t('common.actions.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={updateMaintenance.isPending}
                className="flex-1 py-3.5 rounded-xl bg-blue-600 items-center justify-center flex-row gap-2 shadow-lg shadow-blue-900/30"
              >
                {updateMaintenance.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                    <Text className="text-white font-bold">{t('maintenance.fields.saveChanges')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
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
