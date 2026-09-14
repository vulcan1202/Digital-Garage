import { requestApi } from './apiClient';
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
import { handleServiceCall } from './errors/AppError';
import { storageService } from './storageService';

export const modificationService = {
  /**
   * 獲取指定車輛的改裝品清單 (依安裝日/建檔日排序)
   */
  async getModifications(vehicleId: number): Promise<ModificationRow[]> {
    return handleServiceCall(async () => {
      return await requestApi<ModificationRow[]>(`/vehicles/${vehicleId}/modifications`);
    });
  },

  /**
   * 取得單一改裝品的完整詳細資訊 (包含照片、所有設定組與細項調校參數)
   */
  async getModificationDetails(modId: number): Promise<ModificationWithDetails> {
    return handleServiceCall(async () => {
      return await requestApi<ModificationWithDetails>(`/modifications/${modId}`);
    });
  },

  /**
   * 新增改裝品紀錄 (Go 端事務自動執行 SQL GREATEST 里程防污染更新)
   */
  async addModification(modData: ModificationInsert): Promise<ModificationRow> {
    return handleServiceCall(async () => {
      return await requestApi<ModificationRow>(`/vehicles/${modData.vehicle_id}/modifications`, {
        method: 'POST',
        body: JSON.stringify(modData),
      });
    });
  },

  /**
   * 更新改裝品本體資訊 (Go 端事務自動執行 SQL GREATEST 里程防污染更新)
   */
  async updateModification(id: number, modData: ModificationUpdate): Promise<ModificationRow> {
    return handleServiceCall(async () => {
      return await requestApi<ModificationRow>(`/modifications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(modData),
      });
    });
  },

  /**
   * 寫入改裝品照片至 ModificationPhotos 資料表 (支援單張)
   */
  async addModificationPhoto(
    modificationId: number,
    url: string,
    sortOrder = 0,
    photoType: string | null = null
  ): Promise<ModificationPhotoRow> {
    return handleServiceCall(async () => {
      const photos = await this.addModificationPhotos(modificationId, [{ url, photo_type: photoType ?? undefined }]);
      return photos[0] || {
        id: 0,
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
   * Go 端事務處理：若 is_current = true 自動將其他設定組重設為 false
   */
  async createSettingSet(
    modificationId: number,
    setData: Omit<ModificationSettingSetInsert, 'modification_id'>,
    settings: Omit<ModificationSettingInsert, 'setting_set_id'>[] = []
  ): Promise<ModificationSettingSetRow & { settings: ModificationSettingRow[] }> {
    return handleServiceCall(async () => {
      const payload = {
        name: setData.name,
        recorded_date: setData.recorded_date,
        mileage: setData.mileage ?? null,
        note: setData.note ?? null,
        is_current: !!setData.is_current,
        settings: settings.map((s) => ({
          setting_name: s.setting_name,
          setting_value: s.setting_value,
          unit: s.unit ?? null,
        })),
      };

      return await requestApi<ModificationSettingSetRow & { settings: ModificationSettingRow[] }>(
        `/modifications/${modificationId}/setting-sets`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
    });
  },

  /**
   * 切換目前使用中的調校設定組 (is_current = true，Go 端以互斥事務保證唯一性)
   */
  async setCurrentSettingSet(modificationId: number, setId: number): Promise<void> {
    return handleServiceCall(async () => {
      await requestApi<{ status: string }>(
        `/modifications/${modificationId}/setting-sets/${setId}/current`,
        {
          method: 'PUT',
        }
      );
    });
  },

  /**
   * 刪除改裝品 (Go 端事務自動安全回滾最高里程，SQL CASCADE 自動刪除照片與設定組)
   */
  async deleteModification(id: number, _vehicleId?: number): Promise<void> {
    return handleServiceCall(async () => {
      await requestApi<void>(`/modifications/${id}`, {
        method: 'DELETE',
      });
    });
  },

  /**
   * 為既有的改裝品追加相片
   */
  async addModificationPhotos(
    modificationId: number,
    photos: Array<{ url: string; photo_type?: string }>
  ): Promise<ModificationPhotoRow[]> {
    return handleServiceCall(async () => {
      if (!photos.length) return [];

      return await requestApi<ModificationPhotoRow[]>(`/modifications/${modificationId}/photos`, {
        method: 'POST',
        body: JSON.stringify({ photos }),
      });
    });
  },

  /**
   * 刪除單張改裝照片，並同步清除 Storage 檔案
   */
  async deleteModificationPhoto(photoId: number): Promise<void> {
    return handleServiceCall(async () => {
      const res = await requestApi<{ photo_url: string }>(`/modifications/photos/${photoId}`, {
        method: 'DELETE',
      });

      if (res?.photo_url) {
        storageService.deleteVehicleMedia(res.photo_url).catch((err) => {
          console.warn('非同步清除改裝照片 Storage 實體失敗:', err);
        });
      }
    });
  },
};

