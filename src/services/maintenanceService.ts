import { requestApi } from './apiClient';
import {
  MaintenanceRecordRow,
  MaintenanceRecordInsert,
  MaintenanceRecordUpdate,
  MaintenancePhotoRow,
} from '../types/database';
import { handleServiceCall } from './errors/AppError';
import { storageService } from './storageService';
import { reminderService } from './reminderService';

export interface MaintenanceRecordWithPhotos extends MaintenanceRecordRow {
  photos: MaintenancePhotoRow[];
}

export const maintenanceService = {
  /**
   * 取得車輛保養與維修紀錄 (依日期由新至舊排序，包含照片)
   */
  async getMaintenanceRecords(vehicleId: number): Promise<MaintenanceRecordWithPhotos[]> {
    return handleServiceCall(async () => {
      return await requestApi<MaintenanceRecordWithPhotos[]>(`/vehicles/${vehicleId}/maintenance`);
    });
  },

  /**
   * 建立保養維修紀錄，並將已由 storageService 上傳之圖片 URL 關聯寫入 MaintenancePhotos
   * 職責劃分明確：storageService 負責 Storage 傳檔，Go API 負責在事務中原子寫入 DB 及更新車輛里程
   */
  async createRecordWithPhotos(
    recordData: MaintenanceRecordInsert,
    photoUrls: string[] = []
  ): Promise<MaintenanceRecordWithPhotos> {
    return handleServiceCall(async () => {
      const payload = {
        ...recordData,
        photo_urls: photoUrls,
      };

      return await requestApi<MaintenanceRecordWithPhotos>(
        `/vehicles/${recordData.vehicle_id}/maintenance`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
    });
  },

  /**
   * 更新保養維修紀錄 (Go 端事務自動執行 SQL GREATEST 里程防污染更新)
   */
  async updateMaintenanceRecord(
    id: number,
    updateData: MaintenanceRecordUpdate
  ): Promise<MaintenanceRecordRow> {
    return handleServiceCall(async () => {
      const record = await requestApi<MaintenanceRecordRow>(`/maintenance/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });

      // 同步更新關聯之保養提醒基準
      if (updateData.mileage !== undefined || updateData.service_date !== undefined) {
        await reminderService.syncReminderBaseFromMaintenance(
          id,
          updateData.mileage,
          updateData.service_date
        );
      }

      return record;
    });
  },

  /**
   * 刪除保養紀錄 (Go 端事務自動安全回滾車輛最高里程，SQL CASCADE 自動刪除關聯相片紀錄)
   */
  async deleteMaintenanceRecord(id: number, _vehicleId?: number): Promise<void> {
    return handleServiceCall(async () => {
      await requestApi<void>(`/maintenance/${id}`, {
        method: 'DELETE',
      });
    });
  },

  /**
   * 為既有的保養維修紀錄追加照片
   */
  async addMaintenancePhotos(
    maintenanceRecordId: number,
    photoUrls: string[]
  ): Promise<MaintenancePhotoRow[]> {
    return handleServiceCall(async () => {
      if (!photoUrls.length) return [];

      return await requestApi<MaintenancePhotoRow[]>(`/maintenance/${maintenanceRecordId}/photos`, {
        method: 'POST',
        body: JSON.stringify({ photo_urls: photoUrls }),
      });
    });
  },

  /**
   * 刪除單張保養照片，並同步清除 Storage 檔案
   */
  async deleteMaintenancePhoto(photoId: number): Promise<void> {
    return handleServiceCall(async () => {
      const res = await requestApi<{ photo_url: string }>(`/maintenance/photos/${photoId}`, {
        method: 'DELETE',
      });

      if (res?.photo_url) {
        storageService.deleteVehicleMedia(res.photo_url).catch((err) => {
          console.warn('非同步清除保養照片 Storage 實體失敗:', err);
        });
      }
    });
  },
};
