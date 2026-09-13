import { supabase, requireUser } from '../lib/supabase';
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

export const modificationService = {
  /**
   * 獲取指定車輛的改裝品清單 (依安裝日/建檔日排序)
   */
  async getModifications(vehicleId: number): Promise<ModificationRow[]> {
    return handleServiceCall(async () => {
      await requireUser();

      const { data, error } = await supabase
        .from('Modifications')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('install_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    });
  },

  /**
   * 取得單一改裝品的完整詳細資訊 (包含照片、所有設定組與細項調校參數)
   */
  async getModificationDetails(modId: number): Promise<ModificationWithDetails> {
    return handleServiceCall(async () => {
      await requireUser();

      // 查詢改裝品本體
      const { data: mod, error: modError } = await supabase
        .from('Modifications')
        .select('*')
        .eq('id', modId)
        .single();

      if (modError || !mod) {
        throw AppError.notFound('查無此改裝品資料', modError);
      }

      // 查詢改裝照片 (photo_type 為 varchar)
      const { data: photos, error: photoError } = await supabase
        .from('ModificationPhotos')
        .select('*')
        .eq('modification_id', modId)
        .order('sort_order', { ascending: true });

      if (photoError) throw photoError;

      // 查詢設定組 (SettingSets) 及各組之參數 (Settings)
      const { data: settingSets, error: setError } = await supabase
        .from('ModificationSettingSets')
        .select(`
          *,
          settings:ModificationSettings(*)
        `)
        .eq('modification_id', modId)
        .order('recorded_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (setError) throw setError;

      const formattedSets = (settingSets || []).map((set) => ({
        ...set,
        settings: (set.settings || []) as ModificationSettingRow[],
      }));

      return {
        ...mod,
        photos: (photos || []) as ModificationPhotoRow[],
        setting_sets: formattedSets,
      };
    });
  },

  /**
   * 新增改裝品紀錄
   */
  async addModification(modData: ModificationInsert): Promise<ModificationRow> {
    return handleServiceCall(async () => {
      await requireUser();

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('Modifications')
        .insert({
          ...modData,
          created_at: modData.created_at ?? now,
          updated_at: modData.updated_at ?? now,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    });
  },

  /**
   * 更新改裝品本體資訊
   */
  async updateModification(id: number, modData: ModificationUpdate): Promise<ModificationRow> {
    return handleServiceCall(async () => {
      await requireUser();

      const { data, error } = await supabase
        .from('Modifications')
        .update({
          ...modData,
          updated_at: modData.updated_at ?? new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
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

      if (error) throw error;
      return data;
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

      // 若新設定組指定為 is_current = true，先將既有的 current 設為 false (兩步更新)
      if (setData.is_current) {
        await supabase
          .from('ModificationSettingSets')
          .update({ is_current: false, updated_at: now })
          .eq('modification_id', modificationId)
          .eq('is_current', true);
      }

      // 1. 寫入 ModificationSettingSets
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

      if (setError || !setRecord) {
        throw setError;
      }

      // 2. 寫入通用參數 ModificationSettings
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

        const { data: insertedSettings, error: paramError } = await supabase
          .from('ModificationSettings')
          .insert(settingsToInsert)
          .select();

        if (paramError) throw paramError;
        if (insertedSettings) createdSettings.push(...insertedSettings);
      }

      return {
        ...setRecord,
        settings: createdSettings,
      };
    });
  },

  /**
   * 切換目前使用中的調校設定組 (is_current = true)
   * 鐵律宣告：此兩步式 UPDATE 不具備 Database Transaction 原子性！
   * 由 SQL Partial Unique Index idx_modification_single_current 保證單一使用中約束。
   * 若並發衝突觸發 23505，由 handleServiceCall 捕捉並映射為 AppError.conflict(...)。
   */
  async setCurrentSettingSet(modificationId: number, setId: number): Promise<void> {
    return handleServiceCall(async () => {
      await requireUser();

      const now = new Date().toISOString();

      // 步驟 1: 將該改裝品目前的 is_current 設為 false
      const { error: unsetError } = await supabase
        .from('ModificationSettingSets')
        .update({ is_current: false, updated_at: now })
        .eq('modification_id', modificationId)
        .eq('is_current', true);

      if (unsetError) throw unsetError;

      // 步驟 2: 將目標設定組設為 is_current = true
      const { error: setError } = await supabase
        .from('ModificationSettingSets')
        .update({ is_current: true, updated_at: now })
        .eq('id', setId)
        .eq('modification_id', modificationId);

      if (setError) throw setError;
    });
  },

  /**
   * 刪除改裝品 (底層由 SQL ON DELETE CASCADE 級聯清除 photos, setting_sets, settings)
   */
  async deleteModification(id: number): Promise<void> {
    return handleServiceCall(async () => {
      await requireUser();

      const { error } = await supabase
        .from('Modifications')
        .delete()
        .eq('id', id);

      if (error) throw error;
    });
  },
};
