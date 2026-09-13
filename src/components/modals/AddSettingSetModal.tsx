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
import { useKeyboardBottomInset } from '../../hooks/useKeyboardBottomInset';
import { useCreateSettingSet } from '../../hooks/queries/useModifications';

interface AddSettingSetModalProps {
  visible: boolean;
  modificationId: number;
  currentVehicleMileage?: number;
  onClose: () => void;
}

interface SettingParamInput {
  name: string;
  value: string;
  unit: string;
}

export const AddSettingSetModal: React.FC<AddSettingSetModalProps> = ({
  visible,
  modificationId,
  currentVehicleMileage,
  onClose,
}) => {
  const today = new Date().toISOString().split('T')[0];
  const [name, setName] = useState('');
  const [recordedDate, setRecordedDate] = useState(today);
  const [mileage, setMileage] = useState(
    currentVehicleMileage ? String(currentVehicleMileage) : ''
  );
  const [note, setNote] = useState('');
  const [isCurrent, setIsCurrent] = useState(true);

  // 通用調校參數 (Generic Parameters)
  const [params, setParams] = useState<SettingParamInput[]>([
    { name: '前伸側阻尼 (Rebound)', value: '9', unit: '段' },
    { name: '後壓側阻尼 (Compression)', value: '6', unit: '段' },
  ]);

  const createSettingSetMutation = useCreateSettingSet();
  const rawKeyboardInset = useKeyboardBottomInset();
  const androidKeyboardInset = Platform.OS === 'android' ? rawKeyboardInset : 0;

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

  const resetForm = () => {
    setName('');
    setRecordedDate(today);
    setMileage(currentVehicleMileage ? String(currentVehicleMileage) : '');
    setNote('');
    setIsCurrent(true);
    setParams([
      { name: '前伸側阻尼 (Rebound)', value: '9', unit: '段' },
      { name: '後壓側阻尼 (Compression)', value: '6', unit: '段' },
    ]);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('資料不齊全', '設定組名稱 (Profile Name) 為必填。');
      return;
    }

    const mileageNum = mileage ? parseInt(mileage, 10) : null;
    if (mileage && (isNaN(mileageNum!) || mileageNum! < 0)) {
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
      await createSettingSetMutation.mutateAsync({
        modificationId,
        setData: {
          name: name.trim(),
          recorded_date: recordedDate.trim() || today,
          mileage: mileageNum,
          note: note.trim() || null,
          is_current: isCurrent,
        },
        settings: validParams,
      });

      Alert.alert('調校設定組已建立', `「${name.trim()}」調校版本已保存！`);
      resetForm();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '調校版本建立失敗';
      Alert.alert('建立失敗', message);
    }
  };

  const modalBody = (
    <View className="flex-1 bg-black/80 justify-end" style={{ paddingBottom: androidKeyboardInset }}>
      <View className="bg-garage-card rounded-t-3xl border-t border-white/10 p-6 max-h-[88%] flex-1 justify-between">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between pb-4 border-b border-white/[0.08]">
              <View>
                <Text className="text-[10px] font-mono tracking-[0.2em] text-racing-orange uppercase font-bold">
                  VERSION PROFILE
                </Text>
                <Text className="text-xl font-bold text-white tracking-tight mt-0.5">
                  新增調校設定組
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
              {/* Profile Name */}
              <View className="mb-4">
                <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                  設定組名稱 PROFILE NAME *
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="例: 大鵬灣賽道設定 Stage 2 / 跑山街道舒適模式"
                  placeholderTextColor="#52525b"
                  className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                />
              </View>

              {/* Recorded Date & Mileage (嚴格區分 recorded_date 調校記錄日) */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    記錄日期 RECORDED DATE
                  </Text>
                  <TextInput
                    value={recordedDate}
                    onChangeText={setRecordedDate}
                    placeholder="2024-03-20"
                    placeholderTextColor="#52525b"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>

                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    調校當下里程 (KM)
                  </Text>
                  <TextInput
                    value={mileage}
                    onChangeText={setMileage}
                    placeholder="例: 16200"
                    placeholderTextColor="#52525b"
                    keyboardType="numeric"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>
              </View>

              {/* is_current Checkbox Switch */}
              <TouchableOpacity
                onPress={() => setIsCurrent(!isCurrent)}
                activeOpacity={0.8}
                className="flex-row items-center bg-zinc-950 p-3 rounded-xl border border-white/10 mb-4"
              >
                <View
                  className={`w-5 h-5 rounded-md items-center justify-center border mr-2.5 ${
                    isCurrent ? 'bg-racing-orange border-racing-orange' : 'border-white/30'
                  }`}
                >
                  {isCurrent && <Ionicons name="checkmark" size={14} color="#000" />}
                </View>
                <Text className="text-white font-mono text-xs">
                  設為目前生效版本 (Active Profile)
                </Text>
              </TouchableOpacity>

              {/* 通用調校參數 (Generic ModificationSettings) */}
              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider">
                    自訂細項參數 (DATA-DRIVEN PARAMETERS)
                  </Text>
                  <TouchableOpacity
                    onPress={handleAddParam}
                    className="flex-row items-center px-2 py-0.5 bg-white/10 rounded"
                  >
                    <Ionicons name="add" size={12} color="#ff6b00" />
                    <Text className="text-[10px] font-mono text-racing-orange ml-1">加參數</Text>
                  </TouchableOpacity>
                </View>

                {params.map((p, idx) => (
                  <View key={idx} className="flex-row gap-2 mb-2 items-center">
                    <TextInput
                      value={p.name}
                      onChangeText={(val) => handleUpdateParam(idx, 'name', val)}
                      placeholder="參數名稱 (例: 胎壓)"
                      placeholderTextColor="#52525b"
                      className="flex-3 bg-zinc-950 border border-white/10 rounded-lg px-2.5 py-2 text-white font-mono text-xs"
                    />
                    <TextInput
                      value={p.value}
                      onChangeText={(val) => handleUpdateParam(idx, 'value', val)}
                      placeholder="數值"
                      placeholderTextColor="#52525b"
                      className="flex-2 bg-zinc-950 border border-white/10 rounded-lg px-2.5 py-2 text-racing-orange font-mono text-xs"
                    />
                    <TextInput
                      value={p.unit}
                      onChangeText={(val) => handleUpdateParam(idx, 'unit', val)}
                      placeholder="單位"
                      placeholderTextColor="#52525b"
                      className="flex-1 bg-zinc-950 border border-white/10 rounded-lg px-2 py-2 text-metal-400 font-mono text-xs"
                    />
                    <TouchableOpacity
                      onPress={() => handleRemoveParam(idx)}
                      className="w-7 h-7 rounded bg-red-500/10 items-center justify-center border border-red-500/30"
                    >
                      <Ionicons name="trash-outline" size={14} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* Note */}
              <View className="mb-6">
                <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                  調校心得 / 備註 NOTE
                </Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="胎壓熱胎 32psi，大鵬灣 14 號彎動態非常穩定"
                  placeholderTextColor="#52525b"
                  multiline
                  numberOfLines={2}
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
                  disabled={createSettingSetMutation.isPending}
                  className="flex-2 flex-row items-center justify-center rounded-full bg-racing-orange px-6 py-3.5 flex-1"
                >
                  {createSettingSetMutation.isPending ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <>
                      <Text className="text-black font-bold font-mono text-xs mr-2">
                        建立版本
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
