import { useKeyboardBottomInset } from '../../hooks/useKeyboardBottomInset';
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
import { useAddReminder } from '../../hooks/queries/useReminders';

interface AddReminderModalProps {
  visible: boolean;
  vehicleId: number;
  currentVehicleMileage?: number;
  onClose: () => void;
}

export const AddReminderModal: React.FC<AddReminderModalProps> = ({
  visible,
  vehicleId,
  currentVehicleMileage,
  onClose,
}) => {
  const today = new Date().toISOString().split('T')[0];
  const [itemName, setItemName] = useState('');
  const [intervalKm, setIntervalKm] = useState('5000');
  const [intervalMonths, setIntervalMonths] = useState('6');
  const [baseMileage, setBaseMileage] = useState(
    currentVehicleMileage ? String(currentVehicleMileage) : ''
  );
  const [baseDate, setBaseDate] = useState(today);

  const addReminderMutation = useAddReminder();
  const rawKeyboardInset = useKeyboardBottomInset();
  const androidKeyboardInset = Platform.OS === 'android' ? rawKeyboardInset : 0;

  const resetForm = () => {
    setItemName('');
    setIntervalKm('5000');
    setIntervalMonths('6');
    setBaseMileage(currentVehicleMileage ? String(currentVehicleMileage) : '');
    setBaseDate(today);
  };

  const handleSubmit = async () => {
    if (!itemName.trim()) {
      Alert.alert('資料不齊全', '請填寫保養提醒項目名稱 (例: 更換機油、煞車油檢驗)。');
      return;
    }

    const kmNum = intervalKm ? parseInt(intervalKm, 10) : null;
    const monthsNum = intervalMonths ? parseInt(intervalMonths, 10) : null;

    // 前端表單驗證與 SQL 中既有 interval CHECK constraint 保持一致
    const hasValidKm = typeof kmNum === 'number' && kmNum > 0;
    const hasValidMonths = typeof monthsNum === 'number' && monthsNum > 0;

    if (!hasValidKm && !hasValidMonths) {
      Alert.alert(
        '週期限制不符',
        '依資料庫約束，至少必須提供一種正整數週期：「週期公里數」或「週期月數」大於 0。'
      );
      return;
    }

    const baseKmNum = baseMileage ? parseInt(baseMileage, 10) : null;
    if (baseMileage && (isNaN(baseKmNum!) || baseKmNum! < 0)) {
      Alert.alert('基準里程錯誤', '基準里程必須為大於或等於 0 之整數。');
      return;
    }

    try {
      await addReminderMutation.mutateAsync({
        vehicle_id: vehicleId,
        item_name: itemName.trim(),
        interval_km: hasValidKm ? kmNum : null,
        interval_months: hasValidMonths ? monthsNum : null,
        base_mileage: baseKmNum,
        base_date: baseDate.trim() || null,
        status: 'active',
      });

      Alert.alert('提醒雷達設定完成', `「${itemName.trim()}」保養雷達已啟動！`);
      resetForm();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '提醒設定失敗';
      Alert.alert('設定失敗', message);
    }
  };

  const modalBody = (
    <View className="flex-1 bg-black/80 justify-end" style={{ paddingBottom: androidKeyboardInset }}>
      <View className="bg-garage-card rounded-t-3xl border-t border-white/10 p-6 max-h-[88%] flex-1 justify-between">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between pb-4 border-b border-white/[0.08]">
              <View>
                <Text className="text-[10px] font-mono tracking-[0.2em] text-racing-orange uppercase font-bold">
                  RADAR CRON MONITOR
                </Text>
                <Text className="text-xl font-bold text-white tracking-tight mt-0.5">
                  設定保養週期雷達
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
              {/* 提醒項目名稱 */}
              <View className="mb-4">
                <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                  保養提醒項目 ITEM NAME *
                </Text>
                <TextInput
                  value={itemName}
                  onChangeText={setItemName}
                  placeholder="例: 機油更換 / 變速箱油 / 火星塞檢測"
                  placeholderTextColor="#52525b"
                  className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                />
              </View>

              {/* 週期 (公里數 vs 月份) - 至少填一項 */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    週期公里 INTERVAL (KM)
                  </Text>
                  <TextInput
                    value={intervalKm}
                    onChangeText={setIntervalKm}
                    placeholder="5000"
                    placeholderTextColor="#52525b"
                    keyboardType="numeric"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>

                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    週期月數 INTERVAL (MONTHS)
                  </Text>
                  <TextInput
                    value={intervalMonths}
                    onChangeText={setIntervalMonths}
                    placeholder="6"
                    placeholderTextColor="#52525b"
                    keyboardType="numeric"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>
              </View>

              {/* 起算基準里程與基準日期 */}
              <View className="flex-row gap-3 mb-6">
                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    起算基準里程 BASE (KM)
                  </Text>
                  <TextInput
                    value={baseMileage}
                    onChangeText={setBaseMileage}
                    placeholder="例: 10000"
                    placeholderTextColor="#52525b"
                    keyboardType="numeric"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>

                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    起算基準日期 (YYYY-MM-DD)
                  </Text>
                  <TextInput
                    value={baseDate}
                    onChangeText={setBaseDate}
                    placeholder="2024-01-01"
                    placeholderTextColor="#52525b"
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
                  onPress={handleSubmit}
                  disabled={addReminderMutation.isPending}
                  className="flex-2 flex-row items-center justify-center rounded-full bg-racing-orange px-6 py-3.5 flex-1"
                >
                  {addReminderMutation.isPending ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <>
                      <Text className="text-black font-bold font-mono text-xs mr-2">
                        啟動雷達監測
                      </Text>
                      <View className="w-5 h-5 rounded-full bg-black/20 items-center justify-center">
                        <Ionicons name="pulse-outline" size={12} color="#000" />
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
