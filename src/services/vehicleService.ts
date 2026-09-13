import { supabase, requireUser } from '../lib/supabase';
import { localStore } from '../lib/localStore';
import {
  VehicleRow,
  VehicleInsert,
  VehicleUpdate,
  VehiclePhotoRow,
  VehicleWithCover,
} from '../types/database';
import { handleServiceCall, AppError } from './errors/AppError';

export const vehicleService = {
  /**
   * 獲取使用者的所有車輛清單
   * 統一回傳包含封面照片 (is_cover = true) 的整合資料，UI 不得發起兩次 fetch 手動 merge
   */
  async getVehicles(): Promise<VehicleWithCover[]> {
    return handleServiceCall(async () => {
      const user = await requireUser();

      // 查詢車輛及其照片關聯
      try {
        const { data, error } = await supabase
          .from('Vehicles')
          .select(`
            *,
            photos:VehiclePhotos(id, url, is_cover, sort_order)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          return data.map((v) => {
            const photos = (v.photos || []) as VehiclePhotoRow[];
            const coverPhoto = photos.find((p) => p.is_cover);
            const firstPhoto = photos[0];

            return {
              id: v.id,
              user_id: v.user_id,
              brand: v.brand,
              model: v.model,
              year: v.year,
              purchase_date: v.purchase_date,
              initial_mileage: v.initial_mileage ?? v.current_mileage ?? 0,
              current_mileage: v.current_mileage,
              created_at: v.created_at,
              updated_at: v.updated_at,
              cover_url: coverPhoto ? coverPhoto.url : (firstPhoto ? firstPhoto.url : null),
            };
          });
        }
      } catch {
        // Fallback
      }

      return await localStore.getVehicles(user.id);
    });
  },

  /**
   * 依 ID 取得單一車輛詳細資料 (包含所有照片)
   */
  async getVehicleById(id: number): Promise<VehicleRow & { photos: VehiclePhotoRow[] }> {
    return handleServiceCall(async () => {
      await requireUser();

      const { data, error } = await supabase
        .from('Vehicles')
        .select(`
          *,
          photos:VehiclePhotos(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) throw AppError.notFound('查無此車輛');

      return {
        ...data,
        photos: (data.photos || []) as VehiclePhotoRow[],
      };
    });
  },

  /**
   * 建立新車輛
   */
  async createVehicle(vehicleData: Omit<VehicleInsert, 'user_id'>): Promise<VehicleRow> {
    return handleServiceCall(async () => {
      const user = await requireUser();
      const now = new Date().toISOString();
      const initMileage = vehicleData.initial_mileage ?? vehicleData.current_mileage ?? 0;
      const payload = {
        ...vehicleData,
        initial_mileage: initMileage,
        current_mileage: vehicleData.current_mileage ?? initMileage,
        user_id: user.id,
        created_at: vehicleData.created_at ?? now,
        updated_at: vehicleData.updated_at ?? now,
      };

      try {
        const { data, error } = await supabase
          .from('Vehicles')
          .insert(payload)
          .select()
          .single();

        if (!error && data) return data;
      } catch {
        // Fallback
      }

      return await localStore.createVehicle(payload);
    });
  },

  /**
   * 更新車輛資訊
   */
  async updateVehicle(id: number, vehicleData: VehicleUpdate): Promise<VehicleRow> {
    return handleServiceCall(async () => {
      await requireUser();

      try {
        const { data, error } = await supabase
          .from('Vehicles')
          .update({
            ...vehicleData,
            updated_at: vehicleData.updated_at ?? new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();

        if (!error && data) {
          if (vehicleData.initial_mileage !== undefined || vehicleData.current_mileage !== undefined) {
            await this.syncVehicleMaxMileage(id);
          }
          return data;
        }
      } catch {
        // Fallback
      }

      return await localStore.updateVehicle(id, vehicleData);
    });
  },

  /**
   * 重新掃描現存所有紀錄與初始建檔里程，取最高里程同步至 Vehicles.current_mileage
   */
  async syncVehicleMaxMileage(vehicleId: number): Promise<void> {
    return handleServiceCall(async () => {
      let initialMileage = 0;
      let currentMileage = 0;
      try {
        const { data: vehicle } = await supabase
          .from('Vehicles')
          .select('initial_mileage, current_mileage')
          .eq('id', vehicleId)
          .single();

        if (vehicle) {
          initialMileage = vehicle.initial_mileage ?? 0;
          currentMileage = vehicle.current_mileage ?? 0;
        }

        const [refuelsRes, maintenanceRes, modsRes] = await Promise.all([
          supabase.from('Refuels').select('mileage').eq('vehicle_id', vehicleId),
          supabase.from('MaintenanceRecords').select('mileage').eq('vehicle_id', vehicleId),
          supabase.from('Modifications').select('install_mileage').eq('vehicle_id', vehicleId).not('install_mileage', 'is', null),
        ]);

        const refuelMileages = (refuelsRes.data || []).map((r: { mileage: number }) => r.mileage);
        const maintMileages = (maintenanceRes.data || []).map((m: { mileage: number }) => m.mileage);
        const modMileages = (modsRes.data || [])
          .map((mo: { install_mileage: number | null }) => mo.install_mileage)
          .filter((m): m is number => typeof m === 'number');

        const allMileages = [initialMileage, ...refuelMileages, ...maintMileages, ...modMileages];
        const maxMileage = Math.max(...allMileages, 0);

        if (currentMileage !== maxMileage) {
          await supabase
            .from('Vehicles')
            .update({
              current_mileage: maxMileage,
              updated_at: new Date().toISOString(),
            })
            .eq('id', vehicleId);
        }
      } catch (err) {
        // 同步失敗容錯保護
        console.warn('syncVehicleMaxMileage remote sync error:', err);
      }

      // 本地同步確保離線一致性
      await localStore.syncVehicleMaxMileage(vehicleId);
    });
  },

  /**
   * 刪除車輛 (底層由 SQL ON DELETE CASCADE 級聯清除所有子表記錄)
   */
  async deleteVehicle(id: number): Promise<void> {
    return handleServiceCall(async () => {
      await requireUser();

      try {
        await supabase
          .from('Vehicles')
          .delete()
          .eq('id', id);
      } catch {
        // Fallback
      }

      await localStore.deleteVehicle(id);
    });
  },

  /**
   * 寫入車輛照片至 VehiclePhotos 資料表
   */
  async addVehiclePhoto(
    vehicleId: number,
    url: string,
    isCover = false,
    sortOrder = 0
  ): Promise<VehiclePhotoRow> {
    return handleServiceCall(async () => {
      await requireUser();

      // 若新照片直接指定為封面，先將現有封面取消 (兩步操作)
      if (isCover) {
        await supabase
          .from('VehiclePhotos')
          .update({ is_cover: false })
          .eq('vehicle_id', vehicleId)
          .eq('is_cover', true);
      }

      const { data, error } = await supabase
        .from('VehiclePhotos')
        .insert({
          vehicle_id: vehicleId,
          url,
          is_cover: isCover,
          sort_order: sortOrder,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    });
  },

  /**
   * 設定車輛封面照片
   * 注意：此兩步式 UPDATE 不具備 Database Transaction 原子性！
   * 由 SQL Partial Unique Index idx_vehicle_single_cover 保證資料庫約束。
   * 若並發造成 23505 違例，handleServiceCall 會自動轉換為 AppError.conflict(...)。
   */
  async setCoverPhoto(vehicleId: number, photoId: number): Promise<void> {
    return handleServiceCall(async () => {
      await requireUser();

      // 步驟 1: 將該車輛所有目前的封面照片更新為 false
      const { error: unsetError } = await supabase
        .from('VehiclePhotos')
        .update({ is_cover: false })
        .eq('vehicle_id', vehicleId)
        .eq('is_cover', true);

      if (unsetError) throw unsetError;

      // 步驟 2: 將目標照片更新為 is_cover = true
      const { error: setError } = await supabase
        .from('VehiclePhotos')
        .update({ is_cover: true })
        .eq('id', photoId)
        .eq('vehicle_id', vehicleId);

      if (setError) throw setError;
    });
  },
};
