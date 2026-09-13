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

        if (!error && data) {
          await vehicleService.syncVehicleMaxMileage(data.vehicle_id);
          return data;
        }
      } catch {
        // Fallback
      }

      const localRec = await localStore.addRefuel(refuelData);
      await vehicleService.syncVehicleMaxMileage(refuelData.vehicle_id);
      return localRec;
    });
  },

  /**
   * 更新加油紀錄
   */
  async updateRefuel(id: number, updateData: RefuelUpdate): Promise<RefuelRow> {
    return handleServiceCall(async () => {
      await requireUser();

      const now = new Date().toISOString();
      try {
        const { data, error } = await supabase
          .from('Refuels')
          .update({
            ...updateData,
            updated_at: updateData.updated_at ?? now,
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

      const localRec = await localStore.updateRefuel(id, updateData);
      await vehicleService.syncVehicleMaxMileage(localRec.vehicle_id);
      return localRec;
    });
  },

  /**
   * 刪除加油紀錄
   */
  async deleteRefuel(id: number, vehicleId?: number): Promise<void> {
    return handleServiceCall(async () => {
      await requireUser();

      let targetVehicleId = vehicleId;
      if (!targetVehicleId) {
        try {
          const { data } = await supabase.from('Refuels').select('vehicle_id').eq('id', id).single();
          if (data) targetVehicleId = data.vehicle_id;
        } catch {
          // ignore
        }
      }

      try {
        await supabase
          .from('Refuels')
          .delete()
          .eq('id', id);
      } catch {
        // Fallback
      }

      await localStore.deleteRefuel(id);

      if (targetVehicleId) {
        await vehicleService.syncVehicleMaxMileage(targetVehicleId);
      }
    });
  },
};
