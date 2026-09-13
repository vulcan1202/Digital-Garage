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
import { useUpdateMaintenanceRecord } from '../../hooks/queries/useMaintenance';
import { MaintenanceRecordRow, MaintenanceRecordType } from '../../types/database';

interface EditMaintenanceModalProps {
  visible: boolean;
  record: MaintenanceRecordRow | null;
  onClose: () => void;
}

export const EditMaintenanceModal: React.FC<EditMaintenanceModalProps> = ({
  visible,
  record,
  onClose,
}) => {
  const [recordType, setRecordType] = useState<MaintenanceRecordType>('maintenance');
  const [itemName, setItemName] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [mileage, setMileage] = useState('');
  const [cost, setCost] = useState('');
  const [shopName, setShopName] = useState('');
  const [note, setNote] = useState('');

  const updateMaintenanceMutation = useUpdateMaintenanceRecord();

  useEffect(() => {
    if (record) {
      setRecordType(record.record_type);
      setItemName(record.item_name || '');
      setServiceDate(record.service_date || '');
      setMileage(typeof record.mileage === 'number' ? String(record.mileage) : '');
      setCost(record.cost !== null && record.cost !== undefined ? String(record.cost) : '0');
      setShopName(record.shop_name || '');
      setNote(record.note || '');
    }
  }, [record]);

  const handleSubmit = async () => {
    if (!record) return;

    if (!itemName.trim()) {
      Alert.alert('資料不齊全', '請填寫保養或維修項目名稱 (Item Name)。');
      return;
    }

    const mileageNum = parseInt(mileage, 10);
    if (isNaN(mileageNum) || mileageNum < 0) {
      Alert.alert('里程數格式錯誤', '請輸入施作時的車輛總里程數 (公里)。');
      return;
    }

    const costNum = cost.trim() ? parseFloat(cost) : 0;
    if (isNaN(costNum) || costNum < 0) {
      Alert.alert('費用格式錯誤', '費用必須大於或等於 0 元。');
      return;
    }

    try {
      await updateMaintenanceMutation.mutateAsync({
        id: record.id,
        data: {
          record_type: recordType,
          item_name: itemName.trim(),
          service_date: serviceDate.trim() || record.service_date,
          mileage: mileageNum,
          cost: costNum,
          shop_name: shopName.trim() || null,
          note: note.trim() || null,
        },
      });

      Alert.alert('紀錄更新成功', `已成功修改工單「${itemName.trim()}」！\n車輛里程與關聯保養提醒已同步更新。`);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '保養紀錄更新失敗';
      Alert.alert('更新失敗', message);
    }
  };

  if (!record) return null;

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
                  EDIT SERVICE LOG
                </Text>
                <Text className="text-xl font-bold text-white tracking-tight mt-0.5">
                  編輯保修工單
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
              {/* 工單性質切換 */}
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
                    定期保養 (REGULAR)
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
                    故障維修 (REPAIR)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 項目名稱 */}
              <View className="mb-4">
                <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                  項目名稱 ITEM NAME *
                </Text>
                <TextInput
                  value={itemName}
                  onChangeText={setItemName}
                  placeholder="例: 10,000 KM 定期大保養"
                  placeholderTextColor="#52525b"
                  className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                />
              </View>

              {/* 施作日期與里程數 */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    施作日期 DATE
                  </Text>
                  <TextInput
                    value={serviceDate}
                    onChangeText={setServiceDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#52525b"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>

                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    施作里程 KM *
                  </Text>
                  <TextInput
                    value={mileage}
                    onChangeText={setMileage}
                    placeholder="例: 12000"
                    placeholderTextColor="#52525b"
                    keyboardType="number-pad"
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
              <View className="mb-6">
                <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                  技師備註 / 工單內容 NOTE
                </Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="技師建議事項或備註"
                  placeholderTextColor="#52525b"
                  multiline
                  numberOfLines={3}
                  className="bg-zinc-950 border border-white/10 rounded-xl p-3 text-white font-mono text-sm"
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
                  disabled={updateMaintenanceMutation.isPending}
                  className="flex-2 flex-row items-center justify-center rounded-full bg-racing-orange px-6 py-3.5 flex-1"
                >
                  {updateMaintenanceMutation.isPending ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <>
                      <Text className="text-black font-bold font-mono text-xs mr-2">
                        更新保修紀錄
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
