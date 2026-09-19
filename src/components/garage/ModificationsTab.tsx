import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { DoubleBezelCard } from '../DoubleBezelCard';
import { ModificationRow } from '../../types/database';

interface ModificationsTabProps {
  modifications: ModificationRow[];
  onAddModification: () => void;
  onEditModification: (mod: ModificationRow) => void;
  onDeleteModification: (id: number, itemName: string) => void;
  onNavigateToModDetail: (modId: number) => void;
}

export const ModificationsTab: React.FC<ModificationsTabProps> = ({
  modifications,
  onAddModification,
  onEditModification,
  onDeleteModification,
  onNavigateToModDetail,
}) => {
  const { t } = useTranslation();
  const totalModInvestment = modifications.reduce(
    (sum, m) => sum + (Number(m.purchase_price) || 0) + (Number(m.install_price) || 0),
    0
  );

  return (
    <View className="gap-4">
      {/* 頂部改裝統計與新增按鈕 */}
      <View className="flex-row items-center justify-between">
        <View>
          <View className="flex-row items-center gap-2">
            <Text className="text-xs font-mono tracking-wider text-metal-400 uppercase">
              MODIFICATIONS LIST
            </Text>
            <View className="bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/40">
              <Text className="text-[10px] font-mono text-purple-300 font-bold">
                {t('modifications.itemsCount', { count: modifications.length })}
              </Text>
            </View>
          </View>
          <Text className="text-[11px] text-metal-500 font-mono mt-0.5">
            {t('modifications.totalInvestment', { cost: totalModInvestment.toLocaleString() })}
          </Text>
        </View>

        <TouchableOpacity
          onPress={onAddModification}
          className="flex-row items-center bg-purple-500/15 px-3 py-1.5 rounded-full border border-purple-500/30"
        >
          <Ionicons name="add" size={14} color="#c084fc" />
          <Text className="text-xs text-purple-300 font-bold ml-1 font-mono">
            {t('modifications.addModification')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 改裝清單 */}
      {modifications.length === 0 ? (
        <DoubleBezelCard innerClassName="py-8 items-center">
          <MaterialCommunityIcons name="car-wrench" size={36} color="#a855f7" />
          <Text className="text-metal-400 text-xs mt-2 font-mono">
            {t('modifications.emptySubtitle')}
          </Text>
        </DoubleBezelCard>
      ) : (
        <View className="gap-2.5">
          {modifications.map((mod) => {
            const totalModCost =
              (Number(mod.purchase_price) || 0) + (Number(mod.install_price) || 0);

            return (
              <View
                key={mod.id}
                className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02]"
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 mr-2">
                    <View className="flex-row items-center gap-2 mb-1">
                      <View className="px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/30">
                        <Text className="text-[10px] font-mono text-purple-400 font-bold uppercase">
                          {mod.category === 'suspension'
                            ? t('modifications.categories.suspension')
                            : mod.category === 'braking'
                            ? t('modifications.categories.braking')
                            : mod.category === 'engine'
                            ? t('modifications.categories.engine')
                            : mod.category === 'exhaust'
                            ? t('modifications.categories.exhaust')
                            : mod.category === 'intake'
                            ? t('modifications.categories.intake')
                            : mod.category === 'wheels_tires'
                            ? t('modifications.categories.wheels_tires')
                            : mod.category === 'exterior'
                            ? t('modifications.categories.exterior')
                            : mod.category === 'interior'
                            ? t('modifications.categories.interior')
                            : mod.category === 'electronics'
                            ? t('modifications.categories.electronics')
                            : t('modifications.categories.other')}
                        </Text>
                      </View>
                      {mod.shop_name ? (
                        <Text className="text-[10px] text-metal-500 font-mono" numberOfLines={1}>
                          {mod.shop_name}
                        </Text>
                      ) : null}
                    </View>

                    <Text className="text-white font-bold text-sm tracking-tight">
                      {mod.item_name}
                    </Text>

                    {(mod.brand || mod.model) && (
                      <Text className="text-[11px] text-metal-400 font-mono mt-0.5">
                        {[mod.brand, mod.model].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                  </View>

                  <View className="items-end">
                    <Text className="text-xs font-mono font-bold text-white">
                      ${totalModCost.toLocaleString()}
                    </Text>
                    <Text className="text-[9px] text-metal-500 font-mono">
                      {mod.install_date || mod.purchase_date || t('modifications.noDate')}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center justify-between mt-3 pt-2.5 border-t border-white/[0.06]">
                  <View className="flex-row items-center">
                    {mod.install_mileage !== null ? (
                      <Text className="text-[10px] font-mono text-metal-400">
                        @{mod.install_mileage.toLocaleString()} KM
                      </Text>
                    ) : (
                      <Text className="text-[10px] font-mono text-metal-500">
                        {t('modifications.stockConfig')}
                      </Text>
                    )}
                  </View>

                  <View className="flex-row items-center gap-1.5">
                    <TouchableOpacity
                      onPress={() => onEditModification(mod)}
                      className="px-2.5 py-1 bg-white/10 rounded-md border border-white/20 flex-row items-center"
                    >
                      <Ionicons name="pencil" size={11} color="#fff" />
                      <Text className="text-[10px] font-mono text-white ml-1 font-semibold">
                        {t('common.actions.edit')}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => onNavigateToModDetail(mod.id)}
                      className="px-2.5 py-1 bg-purple-500/20 rounded-md border border-purple-500/40 flex-row items-center"
                    >
                      <MaterialCommunityIcons name="tune-vertical" size={11} color="#c084fc" />
                      <Text className="text-[10px] font-mono text-purple-300 ml-1 font-semibold">
                        {t('modifications.tuningConfig')}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => onDeleteModification(mod.id, mod.item_name)}
                      className="p-1 rounded-md bg-red-500/10 border border-red-500/20"
                    >
                      <Ionicons name="trash-outline" size={12} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};
