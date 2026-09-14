import { requestApi } from './apiClient';
import { RefuelRow, RefuelInsert, RefuelUpdate } from '../types/database';
import { handleServiceCall } from './errors/AppError';

export const fuelService = {
  /**
   * 獲取指定車輛的加油紀錄 (依日期及里程降序排序)
   */
  async getRefuels(vehicleId: number): Promise<RefuelRow[]> {
    return handleServiceCall(async () => {
      return await requestApi<RefuelRow[]>(`/vehicles/${vehicleId}/refuels`);
    });
  },

  /**
   * 新增加油紀錄 (Go 端事務自動執行 SQL GREATEST 里程防污染更新)
   */
  async addRefuel(refuelData: RefuelInsert): Promise<RefuelRow> {
    return handleServiceCall(async () => {
      return await requestApi<RefuelRow>(`/vehicles/${refuelData.vehicle_id}/refuels`, {
        method: 'POST',
        body: JSON.stringify(refuelData),
      });
    });
  },

  /**
   * 更新加油紀錄 (Go 端事務自動執行 SQL GREATEST 里程防污染更新)
   */
  async updateRefuel(id: number, updateData: RefuelUpdate): Promise<RefuelRow> {
    return handleServiceCall(async () => {
      return await requestApi<RefuelRow>(`/refuels/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });
    });
  },

  /**
   * 刪除加油紀錄 (Go 端事務自動安全回滾車輛最高里程)
   */
  async deleteRefuel(id: number, _vehicleId?: number): Promise<void> {
    return handleServiceCall(async () => {
      await requestApi<void>(`/refuels/${id}`, {
        method: 'DELETE',
      });
    });
  },
};
