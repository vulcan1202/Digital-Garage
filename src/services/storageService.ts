import * as Crypto from 'expo-crypto';
import { supabase, requireUser } from '../lib/supabase';
import { handleServiceCall, AppError } from './errors/AppError';

export interface StorageUploadResult {
  path: string;
  publicUrl: string;
}

/**
 * 專職 Storage 服務層
 * 負責：產生 UUID 檔名、儲存至 public: true 之 vehicle-media bucket、呼叫 getPublicUrl
 * 注意：嚴禁在此建立 DB Photo Records（由各業務 Service 專職負責）
 */
export const storageService = {
  /**
   * 上傳車輛相關圖片 (支援車輛照片、保養照片、改裝照片)
   * 儲存路徑符合 RLS ownership 規範: ${auth.uid()}/vehicles/${vehicleId}/${folder}/${uuid}.${ext}
   * @param vehicleId 車輛 ID
   * @param folder 子資料夾 ('covers' | 'maintenance' | 'modifications')
   * @param fileBody 檔案二進位資料 (Blob / ArrayBuffer / FormData)
   * @param fileExtension 副檔名 (例如 'jpg', 'png', 'webp')
   * @param contentType MIME type (例如 'image/jpeg')
   */
  async uploadVehicleMedia(
    vehicleId: number,
    folder: 'covers' | 'maintenance' | 'modifications',
    fileBody: ArrayBuffer | Blob | FormData,
    fileExtension = 'jpg',
    contentType = 'image/jpeg'
  ): Promise<StorageUploadResult> {
    return handleServiceCall(async () => {
      const user = await requireUser();
      const uniqueId = Crypto.randomUUID();
      const cleanExt = fileExtension.replace(/^\./, '');
      const storagePath = `${user.id}/vehicles/${vehicleId}/${folder}/${uniqueId}.${cleanExt}`;

      const { data, error } = await supabase.storage
        .from('vehicle-media')
        .upload(storagePath, fileBody, {
          contentType,
          upsert: false,
        });

      if (error || !data) {
        throw AppError.storage('上傳車輛圖片至 storage 失敗', error);
      }

      // 依 SQL 第 7 節鐵律：vehicle-media 為 public: true，一律使用 getPublicUrl，嚴禁呼叫 createSignedUrl
      const { data: urlData } = supabase.storage
        .from('vehicle-media')
        .getPublicUrl(data.path);

      if (!urlData || !urlData.publicUrl) {
        throw AppError.storage('取得圖片公開網址失敗');
      }

      return {
        path: data.path,
        publicUrl: urlData.publicUrl,
      };
    });
  },

  /**
   * 直接傳入本機圖片 URI (例如 ImagePicker 或 ImageManipulator 產出之路徑)，
   * 自動透過 fetch 轉換為 Blob 並呼叫 uploadVehicleMedia
   */
  async uploadLocalUri(
    vehicleId: number,
    folder: 'covers' | 'maintenance' | 'modifications',
    localUri: string,
    fileExtension = 'jpg',
    contentType = 'image/jpeg'
  ): Promise<StorageUploadResult> {
    const response = await fetch(localUri);
    const blob = await response.blob();
    return this.uploadVehicleMedia(vehicleId, folder, blob, fileExtension, contentType);
  },

  /**
   * 從 Supabase Storage 刪除檔案 (支援傳入完整 public URL 或 storagePath)
   */
  async deleteVehicleMedia(storagePathOrUrl: string): Promise<void> {
    return handleServiceCall(async () => {
      await requireUser();

      let targetPath = storagePathOrUrl;
      // 若傳入的是公開 URL，解析出 bucket 內部路徑 (在 vehicle-media/ 之後的部分)
      const bucketIndicator = '/vehicle-media/';
      if (storagePathOrUrl.includes(bucketIndicator)) {
        targetPath = storagePathOrUrl.split(bucketIndicator)[1];
      }

      const { error } = await supabase.storage
        .from('vehicle-media')
        .remove([targetPath]);

      if (error) {
        // 若找不到檔案或已刪除，視為成功或警告即可，不中斷業務流程
        console.warn('刪除 Storage 檔案警告:', error.message);
      }
    });
  },
};
