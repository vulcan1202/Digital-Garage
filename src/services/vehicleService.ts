import { requestApi } from './apiClient';
import {
  VehicleRow,
  VehicleInsert,
  VehicleUpdate,
  VehiclePhotoRow,
  VehicleWithCover,
} from '../types/database';
import { handleServiceCall } from './errors/AppError';
import { storageService } from './storageService';

export const vehicleService = {
  /**
   * 獲取使用者的所有車輛清單
   * 統一由 Go 後端聚合包含封面照片 (is_cover = true) 的整合資料
   */
  async getVehicles(): Promise<VehicleWithCover[]> {
    return handleServiceCall(async () => {
      return await requestApi<VehicleWithCover[]>('/vehicles');
    });
  },

  /**
   * 依 ID 取得單一車輛詳細資料 (包含所有照片)
   */
  async getVehicleById(id: number): Promise<VehicleRow & { photos: VehiclePhotoRow[] }> {
    return handleServiceCall(async () => {
      return await requestApi<VehicleRow & { photos: VehiclePhotoRow[] }>(`/vehicles/${id}`);
    });
  },

  /**
   * 建立新車輛
   */
  async createVehicle(vehicleData: Omit<VehicleInsert, 'user_id'>): Promise<VehicleRow> {
    return handleServiceCall(async () => {
      return await requestApi<VehicleRow>('/vehicles', {
        method: 'POST',
        body: JSON.stringify(vehicleData),
      });
    });
  },

  /**
   * 更新車輛資訊
   */
  async updateVehicle(id: number, vehicleData: VehicleUpdate): Promise<VehicleRow> {
    return handleServiceCall(async () => {
      return await requestApi<VehicleRow>(`/vehicles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(vehicleData),
      });
    });
  },

  /**
   * 重新掃描現存所有紀錄與初始建檔里程，取最高里程同步至 Vehicles.current_mileage
   */
  async syncVehicleMaxMileage(vehicleId: number): Promise<void> {
    return handleServiceCall(async () => {
      await requestApi<{ success: boolean }>(`/vehicles/${vehicleId}/sync-mileage`, {
        method: 'POST',
      });
    });
  },

  /**
   * 刪除車輛 (底層由 SQL ON DELETE CASCADE 級聯清除所有子表記錄)
   */
  async deleteVehicle(id: number): Promise<void> {
    return handleServiceCall(async () => {
      await requestApi<void>(`/vehicles/${id}`, {
        method: 'DELETE',
      });
    });
  },

  /**
   * 取得特定車輛的所有照片清單 (封面置頂，其次依 sort_order 排序)
   */
  async getVehiclePhotos(vehicleId: number): Promise<VehiclePhotoRow[]> {
    return handleServiceCall(async () => {
      return await requestApi<VehiclePhotoRow[]>(`/vehicles/${vehicleId}/photos`);
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
      return await requestApi<VehiclePhotoRow>(`/vehicles/${vehicleId}/photos`, {
        method: 'POST',
        body: JSON.stringify({
          url,
          is_cover: isCover,
          sort_order: sortOrder,
        }),
      });
    });
  },

  /**
   * 設定車輛封面照片 (Go 端事務自動將舊封面取消，新封面設定)
   */
  async setCoverPhoto(vehicleId: number, photoId: number): Promise<void> {
    return handleServiceCall(async () => {
      await requestApi<{ success: boolean }>(`/vehicles/${vehicleId}/photos/${photoId}/cover`, {
        method: 'PATCH',
      });
    });
  },

  /**
   * 刪除車輛照片
   * 規格：若刪除的照片為當前封面 (is_cover = true)：
   * - Go 後端事務自動推選下一張為新封面
   * - 前端非同步從 Supabase Storage 實體清理檔案
   */
  async deleteVehiclePhoto(photoId: number, vehicleId: number): Promise<void> {
    return handleServiceCall(async () => {
      // 嘗試獲取該照片之 URL 以便清理 Storage 實體檔案
      let photoUrl: string | null = null;
      try {
        const photos = await this.getVehiclePhotos(vehicleId);
        const target = photos.find((p) => p.id === photoId);
        if (target) {
          photoUrl = target.url;
        }
      } catch {
        // 忽略查詢失敗，直接執行刪除 API
      }

      await requestApi<void>(`/vehicles/${vehicleId}/photos/${photoId}`, {
        method: 'DELETE',
      });

      // 非同步非阻塞清理 Supabase Storage 實體檔案
      if (photoUrl) {
        storageService.deleteVehicleMedia(photoUrl).catch((err) => {
          console.warn('非同步清除車輛照片 Storage 實體失敗:', err);
        });
      }
    });
  },
};
