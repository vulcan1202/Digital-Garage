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
import { useKeyboardBottomInset } from '../../hooks/useKeyboardBottomInset';
import { useUpdateSettingSet } from '../../hooks/queries/useModifications';
import { ModificationSettingSetRow, ModificationSettingRow } from '../../types/database';
import { DatePickerInput } from '../common/DatePickerInput';

interface EditSettingSetModalProps {
  visible: boolean;
  modificationId: number;
  settingSet: (ModificationSettingSetRow & { settings: ModificationSettingRow[] }) | null;
  onClose: () => void;
}

interface SettingParamInput {
  name: string;
  value: string;
  unit: string;
}

export const EditSettingSetModal: React.FC<EditSettingSetModalProps> = ({
  visible,
  modificationId,
  settingSet,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [recordedDate, setRecordedDate] = useState('');
  const [mileage, setMileage] = useState('');
  const [note, setNote] = useState('');
  const [params, setParams] = useState<SettingParamInput[]>([]);

  const updateMutation = useUpdateSettingSet();
  const rawKeyboardInset = useKeyboardBottomInset();
  const androidKeyboardInset = Platform.OS === 'android' ? rawKeyboardInset : 0;

  useEffect(() => {
    if (settingSet) {
      setName(settingSet.name || '');
      setRecordedDate(settingSet.recorded_date || '');
      setMileage(settingSet.mileage !== null && settingSet.mileage !== undefined ? String(settingSet.mileage) : '');
      setNote(settingSet.note || '');
      setParams(
        settingSet.settings?.map((s) => ({
          name: s.setting_name,
          value: s.setting_value,
          unit: s.unit || '',
        })) || []
      );
    }
  }, [settingSet, visible]);

  const handleAddParam = () => {
    setParams([...params, { name: '', value: '', unit: '' }]);
  };

  const handleRemoveParam = (index: number) => {
    setParams(params.filter((_, i) => i !== index));
  };

  const handleUpdateParam = (index: number, field: keyof SettingParamInput, val: string) => {
    const updated = [...params];
    updated[index][field] = val;
    setParams(updated);
  };

  const handleSubmit = async () => {
    if (!settingSet) return;

    if (!name.trim()) {
      Alert.alert('資料不齊全', '設定組名稱 (Profile Name) 為必填。');
      return;
    }

    const mileageNum = mileage.trim() ? parseInt(mileage.trim(), 10) : null;
    if (mileage.trim() && (isNaN(mileageNum!) || mileageNum! < 0)) {
      Alert.alert('里程數格式錯誤', '調校里程數必須為大於或等於 0 之整數。');
      return;
    }

    const validParams = params
      .filter((p) => p.name.trim() && p.value.trim())
      .map((p) => ({
        setting_name: p.name.trim(),
        setting_value: p.value.trim(),
        unit: p.unit.trim() || null,
      }));

    try {
      await updateMutation.mutateAsync({
        modificationId,
        setId: settingSet.id,
        setData: {
          name: name.trim(),
          recorded_date: recordedDate.trim() || new Date().toISOString().split('T')[0],
          mileage: mileageNum,
          note: note.trim() || null,
        },
        settings: validParams,
      });

      Alert.alert('更新成功', `調校設定組「${name.trim()}」已儲存！`);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '更新失敗';
      Alert.alert('更新失敗', message);
    }
  };

  if (!settingSet) return null;

  const modalBody = (
    <View
      className="flex-1 bg-black/80 justify-end"
      style={{ paddingBottom: androidKeyboardInset }}
    >
      <View className="bg-garage-card rounded-t-3xl border-t border-white/10 p-6 max-h-[90%]">
        {/* Modal Header */}
        <View className="flex-row items-center justify-between pb-4 border-b border-white/[0.08]">
          <View>
            <Text className="text-[10px] font-mono tracking-[0.2em] text-racing-blue uppercase font-bold">
              PROFILE CONFIGURATION
            </Text>
            <Text className="text-xl font-bold text-white tracking-tight mt-0.5">
              編輯調校版本
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            className="w-8 h-8 rounded-full bg-white/10 items-center justify-center"
          >
            <Ionicons name="close" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} className="mt-4">
          {/* 設定組名稱 */}
          <View className="mb-4">
            <Text className="text-xs font-mono text-metal-300 mb-1.5 uppercase">
              版本名稱 (Profile Name) *
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="例：麗寶賽道熱熔胎阻尼設定"
              placeholderTextColor="#52525b"
              className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm"
            />
          </View>

          {/* 紀錄日期與里程 */}
          <View className="flex-row gap-3 mb-4">
            <DatePickerInput
              label="紀錄日期 (YYYY-MM-DD)"
              required
              value={recordedDate}
              onChange={setRecordedDate}
              maximumDate={new Date()}
              containerClassName="flex-1"
            />

            <View className="flex-1">
              <Text className="text-xs font-mono text-metal-300 mb-1.5 uppercase">
                調校時里程 (KM)
              </Text>
              <TextInput
                value={mileage}
                onChangeText={setMileage}
                keyboardType="numeric"
                placeholder="例：1500"
                placeholderTextColor="#52525b"
                className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm"
              />
            </View>
          </View>

          {/* 備忘說明 */}
          <View className="mb-5">
            <Text className="text-xs font-mono text-metal-300 mb-1.5 uppercase">
              備註說明 (Notes)
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="例：賽道日專用，氣溫 32°C，前胎壓冷胎 28 PSI"
              placeholderTextColor="#52525b"
              multiline
              numberOfLines={2}
              className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm h-20 text-top"
            />
          </View>

          {/* 細項參數清單 */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xs font-mono tracking-wider text-metal-300 uppercase">
                TUNING PARAMETERS ({params.length})
              </Text>
              <TouchableOpacity
                onPress={handleAddParam}
                className="flex-row items-center bg-white/10 px-2.5 py-1 rounded-full border border-white/20"
              >
                <Ionicons name="add" size={13} color="#fff" />
                <Text className="text-[11px] font-mono text-white ml-1 font-semibold">
                  增加參數
                </Text>
              </TouchableOpacity>
            </View>

            {params.map((item, idx) => (
              <View
                key={idx}
                className="flex-row items-center gap-2 mb-2 bg-zinc-900/60 p-2.5 rounded-xl border border-white/[0.06]"
              >
                <TextInput
                  value={item.name}
                  onChangeText={(v) => handleUpdateParam(idx, 'name', v)}
                  placeholder="參數名稱 (例: 前阻尼)"
                  placeholderTextColor="#52525b"
                  className="flex-[2] bg-black/40 border border-white/10 rounded-lg px-2.5 py-2 text-white font-mono text-xs"
                />
                <TextInput
                  value={item.value}
                  onChangeText={(v) => handleUpdateParam(idx, 'value', v)}
                  placeholder="數值 (例: 12)"
                  placeholderTextColor="#52525b"
                  className="flex-[1.5] bg-black/40 border border-white/10 rounded-lg px-2.5 py-2 text-racing-orange font-mono text-xs font-bold"
                />
                <TextInput
                  value={item.unit}
                  onChangeText={(v) => handleUpdateParam(idx, 'unit', v)}
                  placeholder="單位"
                  placeholderTextColor="#52525b"
                  className="flex-[1] bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-metal-300 font-mono text-xs"
                />
                <TouchableOpacity
                  onPress={() => handleRemoveParam(idx)}
                  className="w-7 h-7 rounded-lg bg-red-500/20 items-center justify-center"
                >
                  <Ionicons name="trash-outline" size={14} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* 儲存送出按鈕 */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={updateMutation.isPending}
            className="bg-racing-blue py-3.5 rounded-xl items-center mb-8 flex-row justify-center"
          >
            {updateMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text className="text-white font-mono font-bold text-sm ml-2">
                  儲存修改
                </Text>
              </>
            )}
          </TouchableOpacity>
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
