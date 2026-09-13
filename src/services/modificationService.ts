import { supabase, requireUser } from '../lib/supabase';
import { localStore } from '../lib/localStore';
import {
  ModificationRow,
  ModificationInsert,
  ModificationUpdate,
  ModificationWithDetails,
  ModificationPhotoRow,
  ModificationSettingSetRow,
  ModificationSettingSetInsert,
  ModificationSettingRow,
  ModificationSettingInsert,
} from '../types/database';
import { handleServiceCall, AppError } from './errors/AppError';
import { vehicleService } from './vehicleService';

export const modificationService = {
  /**
   * 獲取指定車輛的改裝品清單 (依安裝日/建檔日排序)
   */
  async getModifications(vehicleId: number): Promise<ModificationRow[]> {
    return handleServiceCall(async () => {
      await requireUser();

      try {
        const { data, error } = await supabase
          .from('Modifications')
          .select('*')
          .eq('vehicle_id', vehicleId)
          .order('install_date', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) return data;
      } catch {
        // Fallback
      }

      return await localStore.getModifications(vehicleId);
    });
  },

  /**
   * 取得單一改裝品的完整詳細資訊 (包含照片、所有設定組與細項調校參數)
   */
  async getModificationDetails(modId: number): Promise<ModificationWithDetails> {
    return handleServiceCall(async () => {
      await requireUser();

      try {
        const { data: mod, error: modError } = await supabase
          .from('Modifications')
          .select('*')
          .eq('id', modId)
          .single();

        if (!modError && mod) {
          const { data: photos } = await supabase
            .from('ModificationPhotos')
            .select('*')
            .eq('modification_id', modId)
            .order('sort_order', { ascending: true });

          const { data: settingSets } = await supabase
            .from('ModificationSettingSets')
            .select(`
              *,
              settings:ModificationSettings(*)
            `)
            .eq('modification_id', modId)
            .order('recorded_date', { ascending: false })
            .order('created_at', { ascending: false });

          const formattedSets = (settingSets || []).map((set) => ({
            ...set,
            settings: (set.settings || []) as ModificationSettingRow[],
          }));

          return {
            ...mod,
            photos: (photos || []) as ModificationPhotoRow[],
            setting_sets: formattedSets,
          };
        }
      } catch {
        // Fallback
      }

      const localDetail = await localStore.getModificationDetails(modId);
      if (!localDetail) throw AppError.notFound('查無此改裝品資料');
      return localDetail;
    });
  },

  /**
   * 新增改裝品紀錄
   */
  async addModification(modData: ModificationInsert): Promise<ModificationRow> {
    return handleServiceCall(async () => {
      await requireUser();

      const now = new Date().toISOString();
      try {
        const { data, error } = await supabase
          .from('Modifications')
          .insert({
            ...modData,
            created_at: modData.created_at ?? now,
            updated_at: modData.updated_at ?? now,
          })
          .select()
          .single();

        if (!error && data) {
          await vehicleService.syncVehicleMaxMileage(data.vehicle_id);
          return data;
        }
      } catch {
        // Fallback
      }

      const localRec = await localStore.addModification(modData);
      await vehicleService.syncVehicleMaxMileage(modData.vehicle_id);
      return localRec;
    });
  },

  /**
   * 更新改裝品本體資訊
   */
  async updateModification(id: number, modData: ModificationUpdate): Promise<ModificationRow> {
    return handleServiceCall(async () => {
      await requireUser();

      try {
        const { data, error } = await supabase
          .from('Modifications')
          .update({
            ...modData,
            updated_at: modData.updated_at ?? new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();

        if (!error && data) {
          await vehicleService.syncVehicleMaxMileage(data.vehicle_id);
          return data;
        }
      } catch {
        // Fallback
      }

      const localRec = await localStore.updateModification(id, modData);
      await vehicleService.syncVehicleMaxMileage(localRec.vehicle_id);
      return localRec;
    });
  },

  /**
   * 寫入改裝品照片至 ModificationPhotos 資料表
   */
  async addModificationPhoto(
    modificationId: number,
    url: string,
    sortOrder = 0,
    photoType: string | null = null
  ): Promise<ModificationPhotoRow> {
    return handleServiceCall(async () => {
      await requireUser();

      try {
        const { data, error } = await supabase
          .from('ModificationPhotos')
          .insert({
            modification_id: modificationId,
            url,
            sort_order: sortOrder,
            photo_type: photoType,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (!error && data) return data;
      } catch {
        // Fallback
      }

      return {
        id: Math.floor(Math.random() * 10000),
        modification_id: modificationId,
        url,
        sort_order: sortOrder,
        photo_type: photoType,
        created_at: new Date().toISOString(),
      };
    });
  },

  /**
   * 建立一組新的調校設定組 (ModificationSettingSet) 與其對應之細項通用參數
   */
  async createSettingSet(
    modificationId: number,
    setData: Omit<ModificationSettingSetInsert, 'modification_id'>,
    settings: Omit<ModificationSettingInsert, 'setting_set_id'>[] = []
  ): Promise<ModificationSettingSetRow & { settings: ModificationSettingRow[] }> {
    return handleServiceCall(async () => {
      await requireUser();

      const now = new Date().toISOString();

      try {
        if (setData.is_current) {
          await supabase
            .from('ModificationSettingSets')
            .update({ is_current: false, updated_at: now })
            .eq('modification_id', modificationId)
            .eq('is_current', true);
        }

        const { data: setRecord, error: setError } = await supabase
          .from('ModificationSettingSets')
          .insert({
            ...setData,
            modification_id: modificationId,
            created_at: setData.created_at ?? now,
            updated_at: setData.updated_at ?? now,
          })
          .select()
          .single();

        if (!setError && setRecord) {
          const createdSettings: ModificationSettingRow[] = [];
          if (settings.length > 0) {
            const settingsToInsert = settings.map((s) => ({
              setting_set_id: setRecord.id,
              setting_name: s.setting_name,
              setting_value: s.setting_value,
              unit: s.unit ?? null,
              created_at: now,
              updated_at: now,
            }));

            const { data: insertedSettings } = await supabase
              .from('ModificationSettings')
              .insert(settingsToInsert)
              .select();

            if (insertedSettings) createdSettings.push(...insertedSettings);
          }

          return {
            ...setRecord,
            settings: createdSettings,
          };
        }
      } catch {
        // Fallback
      }

      return await localStore.createSettingSet(
        {
          ...setData,
          modification_id: modificationId,
        },
        settings
      );
    });
  },

  /**
   * 切換目前使用中的調校設定組 (is_current = true)
   */
  async setCurrentSettingSet(modificationId: number, setId: number): Promise<void> {
    return handleServiceCall(async () => {
      await requireUser();

      const now = new Date().toISOString();

      try {
        await supabase
          .from('ModificationSettingSets')
          .update({ is_current: false, updated_at: now })
          .eq('modification_id', modificationId)
          .eq('is_current', true);

        await supabase
          .from('ModificationSettingSets')
          .update({ is_current: true, updated_at: now })
          .eq('id', setId)
          .eq('modification_id', modificationId);
      } catch {
        // Fallback
      }

      await localStore.setCurrentSettingSet(modificationId, setId);
    });
  },

  /**
   * 刪除改裝品
   */
  async deleteModification(id: number, vehicleId?: number): Promise<void> {
    return handleServiceCall(async () => {
      await requireUser();

      let targetVehicleId = vehicleId;
      if (!targetVehicleId) {
        try {
          const { data } = await supabase
            .from('Modifications')
            .select('vehicle_id')
            .eq('id', id)
            .single();
          if (data) targetVehicleId = data.vehicle_id;
        } catch {
          // ignore
        }
      }

      try {
        await supabase
          .from('Modifications')
          .delete()
          .eq('id', id);
      } catch {
        // Fallback
      }

      await localStore.deleteModification(id);

      if (targetVehicleId) {
        await vehicleService.syncVehicleMaxMileage(targetVehicleId);
      }
    });
  },
};
