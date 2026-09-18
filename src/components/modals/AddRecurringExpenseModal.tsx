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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCreateRecurringExpenseMutation } from '../../hooks/queries/useRecurringExpenses';
import { RecurringExpenseCategory } from '../../types/recurringExpense';
import { getSmartPreFill } from '../../utils/calculators/recurringCalculator';
import { useKeyboardBottomInset } from '../../hooks/useKeyboardBottomInset';
import { VehicleWithCover } from '../../types/database';

interface AddRecurringExpenseModalProps {
  visible: boolean;
  vehicle: VehicleWithCover | null;
  onClose: () => void;
}

const CATEGORIES: { key: RecurringExpenseCategory; label: string; icon: string }[] = [
  { key: 'license_tax', label: '牌照稅', icon: 'card-bulleted-outline' },
  { key: 'road_maintenance_fee', label: '公路養管費', icon: 'road-variant' },
  { key: 'inspection', label: '定期檢驗', icon: 'shield-check-outline' },
  { key: 'compulsory_insurance', label: '強制險', icon: 'file-certificate-outline' },
  { key: 'liability_insurance', label: '任意險', icon: 'security' },
  { key: 'other', label: '其他規費', icon: 'dots-horizontal-circle-outline' },
];

export const AddRecurringExpenseModal: React.FC<AddRecurringExpenseModalProps> = ({
  visible,
  vehicle,
  onClose,
}) => {
  const vehicleId = vehicle ? vehicle.id : 0;
  const createMutation = useCreateRecurringExpenseMutation(vehicleId);

  const [category, setCategory] = useState<RecurringExpenseCategory>('license_tax');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidDate, setPaidDate] = useState('');
  const [coverageStartDate, setCoverageStartDate] = useState('');
  const [coverageEndDate, setCoverageEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [notice, setNotice] = useState<string | undefined>('');
  const [syncAsManufactureDate, setSyncAsManufactureDate] = useState(false);

  const rawKeyboardInset = useKeyboardBottomInset();
  const androidKeyboardInset = Platform.OS === 'android' ? rawKeyboardInset : 0;

  // 當開啟或切換類別時，觸發 Smart Pre-fill 自動帶入
  const applySmartPreFill = (targetCat: RecurringExpenseCategory) => {
    if (!vehicle) return;
    const prefill = getSmartPreFill(targetCat, vehicle);
    setTitle(prefill.title);
    setAmount(prefill.defaultAmount > 0 ? String(prefill.defaultAmount) : '');
    setPaidDate(prefill.paidDate);
    setCoverageStartDate(prefill.coverageStartDate);
    setCoverageEndDate(prefill.coverageEndDate);
    setNotice(prefill.notice);
    setSyncAsManufactureDate(false);
  };

  useEffect(() => {
    if (visible && vehicle) {
      applySmartPreFill(category);
    }
  }, [visible, vehicle]);

  const handleSelectCategory = (cat: RecurringExpenseCategory) => {
    setCategory(cat);
    applySmartPreFill(cat);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('資料不完整', '請輸入規費或檢驗項目名稱。');
      return;
    }

    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum < 0) {
      Alert.alert('金額無效', '請輸入合法的非負數金額 (0 元亦可)。');
      return;
    }

    if (!paidDate.trim() || !coverageStartDate.trim() || !coverageEndDate.trim()) {
      Alert.alert('日期不完整', '付款日期與有效起訖日皆為必填。');
      return;
    }

    if (coverageEndDate < coverageStartDate) {
      Alert.alert('日期邏輯錯誤', '到期截止日不得早於生效起始日。');
      return;
    }

    try {
      let syncDate: string | null = null;
      if (category === 'inspection' && syncAsManufactureDate) {
        // 使用覆蓋期間的起始日前推一個月，或直接以當前設定推算出的出廠日為準
        // 最直覺：如果車輛未填出廠日，將本檢驗窗口之起始日的前一個月或當期基準日回填
        // 檢驗窗口 start 是基準日前一個月，因此基準日 = start + 1 month
        syncDate = coverageStartDate;
      }

      await createMutation.mutateAsync({
        vehicle_id: vehicleId,
        category,
        title: title.trim(),
        amount: amtNum,
        paid_date: paidDate.trim(),
        coverage_start_date: coverageStartDate.trim(),
        coverage_end_date: coverageEndDate.trim(),
        notes: notes.trim() ? notes.trim() : null,
        sync_as_manufacture_date: syncDate,
      });

      Alert.alert('登記成功', `已成功新增「${title}」紀錄！`);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '儲存失敗，請檢查資料輸入';
      Alert.alert('登記失敗', msg);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/80"
      >
        <View
          style={{ paddingBottom: Math.max(androidKeyboardInset, 20) }}
          className="bg-zinc-900 border-t border-white/10 rounded-t-3xl max-h-[90%] overflow-hidden"
        >
          {/* Header */}
          <View className="px-5 py-4 border-b border-white/[0.08] flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="w-8 h-8 rounded-lg bg-racing-orange/20 items-center justify-center border border-racing-orange/40">
                <Ionicons name="calendar-outline" size={18} color="#ff6b00" />
              </View>
              <View>
                <Text className="text-white font-bold text-base">登記週期規費 / 定檢</Text>
                <Text className="text-metal-400 text-xs font-mono">
                  {vehicle ? `${vehicle.brand} ${vehicle.model}` : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} className="p-1">
              <Ionicons name="close" size={22} color="#888" />
            </TouchableOpacity>
          </View>

          <ScrollView className="px-5 py-3" showsVerticalScrollIndicator={false}>
            {/* 類別選擇器 */}
            <Text className="text-metal-400 text-xs font-mono mb-2 uppercase tracking-wider">
              規費與檢驗類別 (CATEGORIES)
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <View className="flex-row gap-2">
                {CATEGORIES.map((c) => {
                  const isSelected = category === c.key;
                  return (
                    <TouchableOpacity
                      key={c.key}
                      onPress={() => handleSelectCategory(c.key)}
                      className={`px-3 py-2 rounded-xl border flex-row items-center gap-1.5 ${
                        isSelected
                          ? 'bg-racing-orange/20 border-racing-orange'
                          : 'bg-zinc-800/80 border-white/10'
                      }`}
                    >
                      <MaterialCommunityIcons
                        name={c.icon as any}
                        size={16}
                        color={isSelected ? '#ff6b00' : '#888'}
                      />
                      <Text
                        className={`text-xs font-mono font-bold ${
                          isSelected ? 'text-racing-orange' : 'text-metal-300'
                        }`}
                      >
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* 法規智慧提示卡片 */}
            {notice && (
              <View className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl mb-4 flex-row items-start gap-2">
                <Ionicons name="information-circle-outline" size={18} color="#f59e0b" className="mt-0.5" />
                <Text className="text-amber-300/90 text-xs flex-1 leading-relaxed">
                  {notice}
                </Text>
              </View>
            )}

            {/* 標題欄位 */}
            <View className="mb-3.5">
              <Text className="text-metal-400 text-xs font-mono mb-1.5">項目名稱 *</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="例: 2026年 牌照稅"
                placeholderTextColor="#555"
                className="bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
              />
            </View>

            {/* 金額欄位 */}
            <View className="mb-3.5">
              <Text className="text-metal-400 text-xs font-mono mb-1.5">繳納金額 (NTD) *</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                keyboardType="numeric"
                placeholderTextColor="#555"
                className="bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
              />
            </View>

            {/* 付款/檢驗日 */}
            <View className="mb-3.5">
              <Text className="text-metal-400 text-xs font-mono mb-1.5">繳費 / 施作檢驗日期 (YYYY-MM-DD) *</Text>
              <TextInput
                value={paidDate}
                onChangeText={setPaidDate}
                placeholder="2026-04-15"
                placeholderTextColor="#555"
                className="bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
              />
            </View>

            {/* 有效起訖期間 */}
            <View className="flex-row gap-3 mb-3.5">
              <View className="flex-1">
                <Text className="text-metal-400 text-xs font-mono mb-1.5">生效起始日 *</Text>
                <TextInput
                  value={coverageStartDate}
                  onChangeText={setCoverageStartDate}
                  placeholder="2026-01-01"
                  placeholderTextColor="#555"
                  className="bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                />
              </View>
              <View className="flex-1">
                <Text className="text-metal-400 text-xs font-mono mb-1.5">到期截止日 *</Text>
                <TextInput
                  value={coverageEndDate}
                  onChangeText={setCoverageEndDate}
                  placeholder="2026-12-31"
                  placeholderTextColor="#555"
                  className="bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                />
              </View>
            </View>

            {/* 若為定期檢驗且車輛無出廠日，顯示同步出廠日 Checkbox */}
            {category === 'inspection' && vehicle && !vehicle.manufacture_date && (
              <TouchableOpacity
                onPress={() => setSyncAsManufactureDate(!syncAsManufactureDate)}
                activeOpacity={0.7}
                className="flex-row items-center gap-2.5 p-3 rounded-xl bg-zinc-800/80 border border-white/10 mb-3.5"
              >
                <Ionicons
                  name={syncAsManufactureDate ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={syncAsManufactureDate ? '#ff6b00' : '#888'}
                />
                <View className="flex-1">
                  <Text className="text-white text-xs font-medium">
                    同步將此檢驗基準日儲存為愛車行照出廠日
                  </Text>
                  <Text className="text-metal-400 text-[10px] mt-0.5">
                    出廠日設定後，未來將全自動計算每年檢驗視窗與頻率
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* 備註 */}
            <View className="mb-6">
              <Text className="text-metal-400 text-xs font-mono mb-1.5">備註 (選填)</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="繳費收據編號、代驗廠名稱等..."
                placeholderTextColor="#555"
                multiline
                numberOfLines={2}
                className="bg-black/60 border border-white/10 rounded-xl px-3.5 py-2 text-white font-mono text-sm min-h-[50px]"
              />
            </View>

            {/* 儲存確認按鈕 */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={createMutation.isPending}
              className="bg-racing-orange py-3.5 rounded-xl items-center justify-center mb-6 shadow-lg shadow-orange-500/20"
              activeOpacity={0.8}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text className="text-black font-bold text-sm tracking-wider font-mono">
                  確認登記規費 (SAVE RECORD)
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
