import { supabase, requireUser } from '../lib/supabase';
import {
  MaintenanceRecordRow,
  MaintenanceRecordInsert,
  MaintenancePhotoRow,
} from '../types/database';
import { handleServiceCall, AppError } from './errors/AppError';

export interface MaintenanceRecordWithPhotos extends MaintenanceRecordRow {
  photos: MaintenancePhotoRow[];
}

export const maintenanceService = {
  /**
   * 取得車輛保養與維修紀錄 (依日期由新至舊排序，包含照片)
   */
  async getMaintenanceRecords(vehicleId: number): Promise<MaintenanceRecordWithPhotos[]> {
    return handleServiceCall(async () => {
      await requireUser();

      const { data, error } = await supabase
        .from('MaintenanceRecords')
        .select(`
          *,
          photos:MaintenancePhotos(*)
        `)
        .eq('vehicle_id', vehicleId)
        .order('service_date', { ascending: false })
        .order('mileage', { ascending: false });

      if (error) throw error;
      if (!data) return [];

      return data.map((record) => ({
        ...record,
        photos: (record.photos || []) as MaintenancePhotoRow[],
      }));
    });
  },

  /**
   * 建立保養維修紀錄，並將已由 storageService 上傳之圖片 URL 寫入 MaintenancePhotos
   * 職責劃分明確：storageService 負責 Storage 傳檔，maintenanceService 負責寫入 DB
   */
  async createRecordWithPhotos(
    recordData: MaintenanceRecordInsert,
    photoUrls: string[] = []
  ): Promise<MaintenanceRecordWithPhotos> {
    return handleServiceCall(async () => {
      await requireUser();

      // 1. 寫入主表 MaintenanceRecords
      const now = new Date().toISOString();
      const { data: record, error: recordError } = await supabase
        .from('MaintenanceRecords')
        .insert({
          ...recordData,
          created_at: recordData.created_at ?? now,
          updated_at: recordData.updated_at ?? now,
        })
        .select()
        .single();

      if (recordError || !record) {
        throw AppError.database('建立保養維修紀錄失敗', recordError);
      }

      // 2. 若有照片，寫入關聯子表 MaintenancePhotos
      const photos: MaintenancePhotoRow[] = [];
      if (photoUrls.length > 0) {
        const photoInserts = photoUrls.map((url, index) => ({
          maintenance_record_id: record.id,
          url,
          sort_order: index,
          created_at: now,
        }));

        const { data: photosData, error: photoError } = await supabase
          .from('MaintenancePhotos')
          .insert(photoInserts)
          .select();

        if (photoError) {
          // 不中斷主表記錄，但記錄錯誤
          console.error('寫入保養照片資料表失敗', photoError);
        } else if (photosData) {
          photos.push(...photosData);
        }
      }

      return {
        ...record,
        photos,
      };
    });
  },

  /**
   * 刪除保養紀錄 (底層由 SQL ON DELETE CASCADE 級聯清除 MaintenancePhotos)
   */
  async deleteMaintenanceRecord(id: number): Promise<void> {
    return handleServiceCall(async () => {
      await requireUser();

      const { error } = await supabase
        .from('MaintenanceRecords')
        .delete()
        .eq('id', id);

      if (error) throw error;
    });
  },
};
