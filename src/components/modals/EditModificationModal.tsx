import { useKeyboardBottomInset } from '../../hooks/useKeyboardBottomInset';
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
import { useUpdateModification } from '../../hooks/queries/useModifications';
import { ModificationCategory, ModificationRow } from '../../types/database';

interface EditModificationModalProps {
  visible: boolean;
  modification: ModificationRow | null;
  onClose: () => void;
}

const MOD_CATEGORIES: { label: string; value: ModificationCategory }[] = [
  { label: '底盤懸吊', value: 'suspension' },
  { label: '煞車制動', value: 'braking' },
  { label: '動力引擎', value: 'engine' },
  { label: '排氣系統', value: 'exhaust' },
  { label: '進氣系統', value: 'intake' },
  { label: '輪圈輪胎', value: 'wheels_tires' },
  { label: '外觀套件', value: 'exterior' },
  { label: '內裝部品', value: 'interior' },
  { label: '電系電裝', value: 'electronics' },
  { label: '其他配件', value: 'other' },
];

export const EditModificationModal: React.FC<EditModificationModalProps> = ({
  visible,
  modification,
  onClose,
}) => {
  const [category, setCategory] = useState<ModificationCategory>('suspension');
  const [itemName, setItemName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [installDate, setInstallDate] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [installMileage, setInstallMileage] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('0');
  const [installPrice, setInstallPrice] = useState('0');
  const [shopName, setShopName] = useState('');
  const [note, setNote] = useState('');

  const updateModMutation = useUpdateModification();
  const rawKeyboardInset = useKeyboardBottomInset();
  const androidKeyboardInset = Platform.OS === 'android' ? rawKeyboardInset : 0;

  useEffect(() => {
    if (modification) {
      setCategory(modification.category);
      setItemName(modification.item_name || '');
      setBrand(modification.brand || '');
      setModel(modification.model || '');
      setInstallDate(modification.install_date || '');
      setPurchaseDate(modification.purchase_date || '');
      setInstallMileage(
        modification.install_mileage !== null ? String(modification.install_mileage) : ''
      );
      setPurchasePrice(
        modification.purchase_price !== null ? String(modification.purchase_price) : '0'
      );
      setInstallPrice(
        modification.install_price !== null ? String(modification.install_price) : '0'
      );
      setShopName(modification.shop_name || '');
      setNote(modification.note || '');
    }
  }, [modification]);

  const handleSubmit = async () => {
    if (!modification) return;

    if (!itemName.trim()) {
      Alert.alert('資料不齊全', '改裝品項目名稱 (Item Name) 為必填。');
      return;
    }

    const installMileageNum = installMileage.trim() ? parseInt(installMileage, 10) : null;
    if (installMileage.trim() && (isNaN(installMileageNum!) || installMileageNum! < 0)) {
      Alert.alert('里程數格式錯誤', '安裝里程數必須為大於或等於 0 之整數。');
      return;
    }

    const pPriceNum = purchasePrice.trim() ? parseFloat(purchasePrice) : 0;
    const iPriceNum = installPrice.trim() ? parseFloat(installPrice) : 0;
    if (isNaN(pPriceNum) || pPriceNum < 0 || isNaN(iPriceNum) || iPriceNum < 0) {
      Alert.alert('費用格式錯誤', '購買金額與安裝工資必須為大於或等於 0 之數字。');
      return;
    }

    try {
      await updateModMutation.mutateAsync({
        id: modification.id,
        data: {
          category,
          item_name: itemName.trim(),
          brand: brand.trim() || null,
          model: model.trim() || null,
          install_date: installDate.trim() || null,
          purchase_date: purchaseDate.trim() || null,
          install_mileage: installMileageNum,
          purchase_price: pPriceNum,
          install_price: iPriceNum,
          shop_name: shopName.trim() || null,
          note: note.trim() || null,
        },
      });

      Alert.alert('更新成功', `改裝品「${itemName.trim()}」資料已成功儲存！`);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '改裝品更新失敗';
      Alert.alert('更新失敗', message);
    }
  };

  if (!modification) return null;

  const modalBody = (
    <View className="flex-1 bg-black/80 justify-end" style={{ paddingBottom: androidKeyboardInset }}>
      <View className="bg-garage-card rounded-t-3xl border-t border-white/10 p-6 max-h-[88%] flex-1 justify-between">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between pb-4 border-b border-white/[0.08]">
              <View>
                <Text className="text-[10px] font-mono tracking-[0.2em] text-purple-400 uppercase font-bold">
                  PERFORMANCE UPGRADE · EDIT
                </Text>
                <Text className="text-xl font-bold text-white tracking-tight mt-0.5">
                  編輯改裝套件
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
              {/* 改裝品名稱 (必填) */}
              <View className="mb-4">
                <Text className="text-xs font-mono text-metal-300 uppercase mb-1.5">
                  套件品項名稱 (ITEM NAME) *
                </Text>
                <TextInput
                  value={itemName}
                  onChangeText={setItemName}
                  placeholder="例如: KW V3 避震器 / Brembo GT6 卡鉗"
                  placeholderTextColor="#52525b"
                  className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-medium"
                />
              </View>

              {/* 改裝分類 (Category) */}
              <View className="mb-4">
                <Text className="text-xs font-mono text-metal-300 uppercase mb-2">
                  改裝分類 (CATEGORY) *
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                  {MOD_CATEGORIES.map((c) => {
                    const isSelected = category === c.value;
                    return (
                      <TouchableOpacity
                        key={c.value}
                        onPress={() => setCategory(c.value)}
                        className={`mr-2 px-3 py-1.5 rounded-lg border ${
                          isSelected
                            ? 'bg-purple-500/20 border-purple-500/60'
                            : 'bg-white/[0.03] border-white/10'
                        }`}
                      >
                        <Text
                          className={`text-xs font-mono ${
                            isSelected ? 'text-purple-400 font-bold' : 'text-metal-400'
                          }`}
                        >
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* 品牌與型號 (Brand & Model) */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-xs font-mono text-metal-300 uppercase mb-1.5">
                    品牌 (BRAND)
                  </Text>
                  <TextInput
                    value={brand}
                    onChangeText={setBrand}
                    placeholder="例如: KW, AP Racing"
                    placeholderTextColor="#52525b"
                    className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-medium"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-mono text-metal-300 uppercase mb-1.5">
                    型號 (MODEL)
                  </Text>
                  <TextInput
                    value={model}
                    onChangeText={setModel}
                    placeholder="例如: Clubsport 2-way"
                    placeholderTextColor="#52525b"
                    className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-medium"
                  />
                </View>
              </View>

              {/* 安裝日與購買日 (Install & Purchase Date) */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-xs font-mono text-metal-300 uppercase mb-1.5">
                    安裝日期 (YYYY-MM-DD)
                  </Text>
                  <TextInput
                    value={installDate}
                    onChangeText={setInstallDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#52525b"
                    className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-mono"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-mono text-metal-300 uppercase mb-1.5">
                    購買日期 (YYYY-MM-DD)
                  </Text>
                  <TextInput
                    value={purchaseDate}
                    onChangeText={setPurchaseDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#52525b"
                    className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-mono"
                  />
                </View>
              </View>

              {/* 安裝時里程 */}
              <View className="mb-4">
                <Text className="text-xs font-mono text-metal-300 uppercase mb-1.5">
                  安裝時車輛里程 (KM)
                </Text>
                <TextInput
                  value={installMileage}
                  onChangeText={setInstallMileage}
                  keyboardType="numeric"
                  placeholder="例如: 15000"
                  placeholderTextColor="#52525b"
                  className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-mono"
                />
              </View>

              {/* 購買金額與安裝工資 */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-xs font-mono text-metal-300 uppercase mb-1.5">
                    品項單價 (TWD)
                  </Text>
                  <TextInput
                    value={purchasePrice}
                    onChangeText={setPurchasePrice}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#52525b"
                    className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-mono"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-mono text-metal-300 uppercase mb-1.5">
                    安裝工資 (TWD)
                  </Text>
                  <TextInput
                    value={installPrice}
                    onChangeText={setInstallPrice}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#52525b"
                    className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-mono"
                  />
                </View>
              </View>

              {/* 店家名稱 */}
              <View className="mb-4">
                <Text className="text-xs font-mono text-metal-300 uppercase mb-1.5">
                  施工改裝店家 (SHOP NAME)
                </Text>
                <TextInput
                  value={shopName}
                  onChangeText={setShopName}
                  placeholder="例如: 極致賽道工坊"
                  placeholderTextColor="#52525b"
                  className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-medium"
                />
              </View>

              {/* 備註 (Notes) */}
              <View className="mb-6">
                <Text className="text-xs font-mono text-metal-300 uppercase mb-1.5">
                  備註與保固說明 (NOTE)
                </Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  multiline
                  numberOfLines={3}
                  placeholder="選填備註資訊、阻尼預設值或保固期..."
                  placeholderTextColor="#52525b"
                  textAlignVertical="top"
                  className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-medium min-h-[75px]"
                />
              </View>

              {/* 儲存按鈕 */}
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={updateModMutation.isPending}
                className="bg-purple-600 rounded-xl py-4 items-center mb-8"
              >
                {updateModMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-mono font-bold text-sm tracking-wider uppercase">
                    儲存改裝品變更
                  </Text>
                )}
              </TouchableOpacity>
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
