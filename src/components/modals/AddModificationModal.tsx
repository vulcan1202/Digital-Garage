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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAddModification } from '../../hooks/queries/useModifications';
import { ModificationCategory } from '../../types/database';
import { storageService } from '../../services/storageService';
import { modificationService } from '../../services/modificationService';
import { PhotoPickerSection, SelectedPhoto } from '../PhotoPickerSection';

interface AddModificationModalProps {
  visible: boolean;
  vehicleId: number;
  currentVehicleMileage?: number;
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

export const AddModificationModal: React.FC<AddModificationModalProps> = ({
  visible,
  vehicleId,
  currentVehicleMileage,
  onClose,
}) => {
  const today = new Date().toISOString().split('T')[0];
  const [category, setCategory] = useState<ModificationCategory>('suspension');
  const [itemName, setItemName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [installDate, setInstallDate] = useState(today);
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [installMileage, setInstallMileage] = useState(
    currentVehicleMileage ? String(currentVehicleMileage) : ''
  );
  const [purchasePrice, setPurchasePrice] = useState('');
  const [installPrice, setInstallPrice] = useState('');
  const [shopName, setShopName] = useState('');
  const [note, setNote] = useState('');

  // 改裝套件相片選取
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedPhoto[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);

  const addModMutation = useAddModification();

  const resetForm = () => {
    setCategory('suspension');
    setItemName('');
    setBrand('');
    setModel('');
    setInstallDate(today);
    setPurchaseDate(today);
    setInstallMileage(currentVehicleMileage ? String(currentVehicleMileage) : '');
    setPurchasePrice('');
    setInstallPrice('');
    setShopName('');
    setNote('');
    setSelectedPhotos([]);
  };

  const handleSubmit = async () => {
    if (!itemName.trim()) {
      Alert.alert('資料不齊全', '改裝品項目名稱 (Item Name) 為必填。');
      return;
    }

    const installMileageNum = installMileage ? parseInt(installMileage, 10) : null;
    if (installMileage && (isNaN(installMileageNum!) || installMileageNum! < 0)) {
      Alert.alert('里程數格式錯誤', '安裝里程數必須為大於或等於 0 之整數。');
      return;
    }

    const pPriceNum = purchasePrice ? parseFloat(purchasePrice) : 0;
    const iPriceNum = installPrice ? parseFloat(installPrice) : 0;
    if (isNaN(pPriceNum) || pPriceNum < 0 || isNaN(iPriceNum) || iPriceNum < 0) {
      Alert.alert('費用格式錯誤', '購買金額與安裝工資必須為大於或等於 0 之數字。');
      return;
    }

    try {
      setIsUploadingPhotos(true);
      const createdMod = await addModMutation.mutateAsync({
        vehicle_id: vehicleId,
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
      });

      // 若有選取相片，上傳至 Storage 並寫入 ModificationPhotos
      if (selectedPhotos.length > 0 && createdMod) {
        const photoPayload: Array<{ url: string; photo_type?: string }> = [];
        for (const photo of selectedPhotos) {
          try {
            const res = await storageService.uploadLocalUri(vehicleId, 'modifications', photo.uri);
            photoPayload.push({ url: res.publicUrl });
          } catch (uploadErr) {
            console.warn('上傳改裝套件相片失敗:', uploadErr);
          }
        }
        if (photoPayload.length > 0) {
          await modificationService.addModificationPhotos(createdMod.id, photoPayload);
        }
      }

      Alert.alert('改裝品登錄成功', `「${itemName.trim()}」已加入改裝庫！`);
      resetForm();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '改裝品新增失敗';
      Alert.alert('新增失敗', message);
    } finally {
      setIsUploadingPhotos(false);
    }
  };

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
                <Text className="text-[10px] font-mono tracking-[0.2em] text-purple-400 uppercase font-bold">
                  PERFORMANCE UPGRADE
                </Text>
                <Text className="text-xl font-bold text-white tracking-tight mt-0.5">
                  登錄改裝套件
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
              {/* 改裝類別選擇器 (Horizontal Pill Selector) */}
              <View className="mb-4">
                <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-2">
                  改裝類別 CATEGORY
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {MOD_CATEGORIES.map((c) => {
                    const isSelected = category === c.value;
                    return (
                      <TouchableOpacity
                        key={c.value}
                        onPress={() => setCategory(c.value)}
                        className={`px-3 py-1.5 rounded-lg border ${
                          isSelected
                            ? 'bg-purple-500/20 border-purple-500'
                            : 'bg-zinc-950 border-white/10'
                        }`}
                      >
                        <Text
                          className={`text-xs font-mono font-bold ${
                            isSelected ? 'text-purple-400' : 'text-metal-400'
                          }`}
                        >
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* 項目名稱 */}
              <View className="mb-4">
                <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                  改裝項目 ITEM NAME *
                </Text>
                <TextInput
                  value={itemName}
                  onChangeText={setItemName}
                  placeholder="例: KW V3 雙向阻尼可調避震器"
                  placeholderTextColor="#52525b"
                  className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                />
              </View>

              {/* 品牌與型號 */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    廠牌 BRAND
                  </Text>
                  <TextInput
                    value={brand}
                    onChangeText={setBrand}
                    placeholder="例: KW Suspensions"
                    placeholderTextColor="#52525b"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>

                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    型號 MODEL
                  </Text>
                  <TextInput
                    value={model}
                    onChangeText={setModel}
                    placeholder="例: Variant 3"
                    placeholderTextColor="#52525b"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>
              </View>

              {/* 安裝日與安裝里程 (嚴格區分 install_date) */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    安裝日期 INSTALL DATE
                  </Text>
                  <TextInput
                    value={installDate}
                    onChangeText={setInstallDate}
                    placeholder="2024-03-20"
                    placeholderTextColor="#52525b"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>

                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    安裝里程 (KM)
                  </Text>
                  <TextInput
                    value={installMileage}
                    onChangeText={setInstallMileage}
                    placeholder="例: 15000"
                    placeholderTextColor="#52525b"
                    keyboardType="numeric"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                  />
                </View>
              </View>

              {/* 料資與工資 */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    套件價格 PURCHASE ($)
                  </Text>
                  <TextInput
                    value={purchasePrice}
                    onChangeText={setPurchasePrice}
                    placeholder="0"
                    placeholderTextColor="#52525b"
                    keyboardType="decimal-pad"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-purple-400 font-mono font-bold text-base"
                  />
                </View>

                <View className="flex-1">
                  <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                    安裝工資 INSTALL ($)
                  </Text>
                  <TextInput
                    value={installPrice}
                    onChangeText={setInstallPrice}
                    placeholder="0"
                    placeholderTextColor="#52525b"
                    keyboardType="decimal-pad"
                    className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-purple-400 font-mono font-bold text-base"
                  />
                </View>
              </View>

              {/* 施工店家與備註 */}
              <View className="mb-4">
                <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                  施工改裝廠 SHOP NAME
                </Text>
                <TextInput
                  value={shopName}
                  onChangeText={setShopName}
                  placeholder="例: 狂暴輪速底盤專業工程"
                  placeholderTextColor="#52525b"
                  className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm"
                />
              </View>

              <View className="mb-6">
                <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
                  備註說明 NOTE
                </Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="包含前後高低配重調整、四輪定位設定完成"
                  placeholderTextColor="#52525b"
                  multiline
                  numberOfLines={2}
                  className="bg-zinc-950 border border-white/10 rounded-xl p-3 text-white font-mono text-sm"
                />
              </View>

              {/* Modification Photos Picker */}
              <PhotoPickerSection
                photos={selectedPhotos}
                onChangePhotos={setSelectedPhotos}
                maxPhotos={5}
                title="改裝實品/安裝相片"
                subtitle="上傳配件開箱或上車照片（等比壓縮至1920px）"
              />

              {/* Action Buttons */}
              <View className="flex-row gap-3 mb-4">
                <TouchableOpacity
                  onPress={onClose}
                  disabled={addModMutation.isPending || isUploadingPhotos}
                  className="flex-1 py-3.5 rounded-full bg-white/[0.06] border border-white/10 items-center justify-center"
                >
                  <Text className="text-metal-300 font-mono text-xs">取消</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={addModMutation.isPending || isUploadingPhotos}
                  className="flex-2 flex-row items-center justify-center rounded-full bg-purple-600 px-6 py-3.5 flex-1"
                >
                  {addModMutation.isPending || isUploadingPhotos ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Text className="text-white font-bold font-mono text-xs mr-2">
                        入庫改裝套件
                      </Text>
                      <View className="w-5 h-5 rounded-full bg-white/20 items-center justify-center">
                        <Ionicons name="checkmark" size={12} color="#fff" />
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
