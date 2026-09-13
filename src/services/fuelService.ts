import { supabase, requireUser } from '../lib/supabase';
import { localStore } from '../lib/localStore';
import { RefuelRow, RefuelInsert, RefuelUpdate } from '../types/database';
import { handleServiceCall } from './errors/AppError';
import { vehicleService } from './vehicleService';

export const fuelService = {
  /**
   * 獲取指定車輛的加油紀錄 (依日期由新至舊排序)
   */
  async getRefuels(vehicleId: number): Promise<RefuelRow[]> {
    return handleServiceCall(async () => {
      await requireUser();

      try {
        const { data, error } = await supabase
          .from('Refuels')
          .select('*')
          .eq('vehicle_id', vehicleId)
          .order('refuel_date', { ascending: false })
          .order('mileage', { ascending: false });

        if (!error && data && data.length > 0) return data;
      } catch {
        // Fallback
      }

      return await localStore.getRefuels(vehicleId);
    });
  },

  /**
   * 新增加油紀錄
   */
  async addRefuel(refuelData: RefuelInsert): Promise<RefuelRow> {
    return handleServiceCall(async () => {
      await requireUser();

      const now = new Date().toISOString();
      let created: RefuelRow | null = null;
      try {
        const { data, error } = await supabase
          .from('Refuels')
          .insert({
            ...refuelData,
            created_at: refuelData.created_at ?? now,
            updated_at: refuelData.updated_at ?? now,
          })
          .select()
          .single();

        if (!error && data) created = data;
      } catch {
        // Fallback
      }

      if (!created) {
        created = await localStore.addRefuel(refuelData);
      }

      await vehicleService.syncVehicleMaxMileage(refuelData.vehicle_id);
      return created;
    });
  },

  /**
   * 更新加油紀錄
   */
  async updateRefuel(id: number, refuelData: RefuelUpdate): Promise<RefuelRow> {
    return handleServiceCall(async () => {
      await requireUser();

      const now = new Date().toISOString();
      let updated: RefuelRow | null = null;
      try {
        const { data, error } = await supabase
          .from('Refuels')
          .update({
            ...refuelData,
            updated_at: refuelData.updated_at ?? now,
          })
          .eq('id', id)
          .select()
          .single();

        if (!error && data) updated = data;
      } catch {
        // Fallback
      }

      if (!updated) {
        updated = await localStore.updateRefuel(id, refuelData);
      }

      if (updated.vehicle_id) {
        await vehicleService.syncVehicleMaxMileage(updated.vehicle_id);
      }

      return updated;
    });
  },

  /**
   * 刪除加油紀錄 (不回退車輛最高里程)
   */
  async deleteRefuel(id: number): Promise<void> {
    return handleServiceCall(async () => {
      await requireUser();

      try {
        await supabase
          .from('Refuels')
          .delete()
          .eq('id', id);
      } catch {
        // Fallback
      }

      await localStore.deleteRefuel(id);
    });
  },
};
