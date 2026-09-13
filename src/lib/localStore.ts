import * as SecureStore from 'expo-secure-store';
import {
  VehicleRow,
  VehicleWithCover,
  VehicleInsert,
  VehicleUpdate,
  RefuelRow,
  RefuelInsert,
  MaintenanceRecordRow,
  MaintenanceRecordInsert,
  ReminderRow,
  ReminderInsert,
  ReminderUpdate,
  ModificationRow,
  ModificationInsert,
  ModificationUpdate,
  ModificationWithDetails,
  ModificationSettingSetRow,
  ModificationSettingSetInsert,
  ModificationSettingRow,
  VehicleTimelineRow,
} from '../types/database';

const LOCAL_STORE_KEY = 'DIGITAL_GARAGE_LOCAL_DB_V1';

interface LocalDBState {
  vehicles: VehicleRow[];
  refuels: RefuelRow[];
  maintenanceRecords: MaintenanceRecordRow[];
  reminders: ReminderRow[];
  modifications: ModificationRow[];
  modificationSettingSets: ModificationSettingSetRow[];
  modificationSettings: ModificationSettingRow[];
}

let inMemoryDB: LocalDBState = {
  vehicles: [],
  refuels: [],
  maintenanceRecords: [],
  reminders: [],
  modifications: [],
  modificationSettingSets: [],
  modificationSettings: [],
};

let isInitialized = false;

async function saveToStorage() {
  try {
    await SecureStore.setItemAsync(LOCAL_STORE_KEY, JSON.stringify(inMemoryDB));
  } catch (e) {
    // ignore
  }
}

async function loadFromStorage() {
  if (isInitialized) return;
  try {
    const raw = await SecureStore.getItemAsync(LOCAL_STORE_KEY);
    if (raw) {
      inMemoryDB = JSON.parse(raw);
    }
  } catch (e) {
    // ignore
  } finally {
    isInitialized = true;
  }
}

export const localStore = {
  async init() {
    await loadFromStorage();
  },

  // Vehicles
  async getVehicles(userId: string): Promise<VehicleWithCover[]> {
    await loadFromStorage();
    return inMemoryDB.vehicles
      .filter((v) => v.user_id === userId)
      .map((v) => ({
        ...v,
        cover_url: null,
      }));
  },

  async getVehicleById(id: number): Promise<VehicleRow | null> {
    await loadFromStorage();
    return inMemoryDB.vehicles.find((v) => v.id === id) || null;
  },

  async createVehicle(data: VehicleInsert): Promise<VehicleRow> {
    await loadFromStorage();
    const newId = inMemoryDB.vehicles.length > 0 
      ? Math.max(...inMemoryDB.vehicles.map((v) => v.id)) + 1 
      : 1;
    const now = new Date().toISOString();
    const vehicle: VehicleRow = {
      id: newId,
      user_id: data.user_id,
      brand: data.brand,
      model: data.model,
      year: data.year ?? null,
      purchase_date: data.purchase_date ?? null,
      current_mileage: data.current_mileage ?? 0,
      created_at: data.created_at ?? now,
      updated_at: data.updated_at ?? now,
    };
    inMemoryDB.vehicles.unshift(vehicle);
    await saveToStorage();
    return vehicle;
  },

  async updateVehicle(id: number, data: VehicleUpdate): Promise<VehicleRow> {
    await loadFromStorage();
    const index = inMemoryDB.vehicles.findIndex((v) => v.id === id);
    if (index === -1) throw new Error('Vehicle not found');
    const existing = inMemoryDB.vehicles[index];
    const updated: VehicleRow = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };
    inMemoryDB.vehicles[index] = updated;
    await saveToStorage();
    return updated;
  },

  async deleteVehicle(id: number): Promise<void> {
    await loadFromStorage();
    inMemoryDB.vehicles = inMemoryDB.vehicles.filter((v) => v.id !== id);
    inMemoryDB.refuels = inMemoryDB.refuels.filter((r) => r.vehicle_id !== id);
    inMemoryDB.maintenanceRecords = inMemoryDB.maintenanceRecords.filter((m) => m.vehicle_id !== id);
    inMemoryDB.reminders = inMemoryDB.reminders.filter((r) => r.vehicle_id !== id);
    inMemoryDB.modifications = inMemoryDB.modifications.filter((m) => m.vehicle_id !== id);
    await saveToStorage();
  },

  // Refuels
  async getRefuels(vehicleId: number): Promise<RefuelRow[]> {
    await loadFromStorage();
    return inMemoryDB.refuels
      .filter((r) => r.vehicle_id === vehicleId)
      .sort((a, b) => new Date(b.refuel_date).getTime() - new Date(a.refuel_date).getTime());
  },

  async addRefuel(data: RefuelInsert): Promise<RefuelRow> {
    await loadFromStorage();
    const newId = inMemoryDB.refuels.length > 0 
      ? Math.max(...inMemoryDB.refuels.map((r) => r.id)) + 1 
      : 1;
    const now = new Date().toISOString();
    const refuel: RefuelRow = {
      id: newId,
      vehicle_id: data.vehicle_id,
      refuel_date: data.refuel_date,
      mileage: data.mileage,
      volume: data.volume,
      price_per_unit: data.price_per_unit ?? null,
      total_cost: data.total_cost,
      fuel_type: data.fuel_type,
      created_at: now,
      updated_at: now,
    };
    inMemoryDB.refuels.unshift(refuel);

    const v = inMemoryDB.vehicles.find((veh) => veh.id === data.vehicle_id);
    if (v && data.mileage > v.current_mileage) {
      v.current_mileage = data.mileage;
      v.updated_at = now;
    }

    await saveToStorage();
    return refuel;
  },

  async deleteRefuel(id: number): Promise<void> {
    await loadFromStorage();
    inMemoryDB.refuels = inMemoryDB.refuels.filter((r) => r.id !== id);
    await saveToStorage();
  },

  // Maintenance
  async getMaintenanceRecords(vehicleId: number): Promise<MaintenanceRecordRow[]> {
    await loadFromStorage();
    return inMemoryDB.maintenanceRecords
      .filter((m) => m.vehicle_id === vehicleId)
      .sort((a, b) => new Date(b.service_date).getTime() - new Date(a.service_date).getTime());
  },

  async addMaintenanceRecord(data: MaintenanceRecordInsert): Promise<MaintenanceRecordRow> {
    await loadFromStorage();
    const newId = inMemoryDB.maintenanceRecords.length > 0 
      ? Math.max(...inMemoryDB.maintenanceRecords.map((m) => m.id)) + 1 
      : 1;
    const now = new Date().toISOString();
    const record: MaintenanceRecordRow = {
      id: newId,
      vehicle_id: data.vehicle_id,
      service_date: data.service_date,
      mileage: data.mileage,
      record_type: data.record_type,
      item_name: data.item_name,
      cost: data.cost ?? 0,
      shop_name: data.shop_name ?? null,
      note: data.note ?? null,
      created_at: now,
      updated_at: now,
    };
    inMemoryDB.maintenanceRecords.unshift(record);

    const v = inMemoryDB.vehicles.find((veh) => veh.id === data.vehicle_id);
    if (v && data.mileage > v.current_mileage) {
      v.current_mileage = data.mileage;
      v.updated_at = now;
    }

    await saveToStorage();
    return record;
  },

  async deleteMaintenanceRecord(id: number): Promise<void> {
    await loadFromStorage();
    inMemoryDB.maintenanceRecords = inMemoryDB.maintenanceRecords.filter((m) => m.id !== id);
    await saveToStorage();
  },

  // Reminders
  async getReminders(vehicleId: number): Promise<ReminderRow[]> {
    await loadFromStorage();
    return inMemoryDB.reminders.filter((r) => r.vehicle_id === vehicleId);
  },

  async addReminder(data: ReminderInsert): Promise<ReminderRow> {
    await loadFromStorage();
    const newId = inMemoryDB.reminders.length > 0 
      ? Math.max(...inMemoryDB.reminders.map((r) => r.id)) + 1 
      : 1;
    const now = new Date().toISOString();
    const reminder: ReminderRow = {
      id: newId,
      vehicle_id: data.vehicle_id,
      item_name: data.item_name,
      interval_km: data.interval_km ?? null,
      interval_months: data.interval_months ?? null,
      base_mileage: data.base_mileage ?? null,
      base_date: data.base_date ?? null,
      last_completed_mileage: data.last_completed_mileage ?? null,
      last_completed_date: data.last_completed_date ?? null,
      last_maintenance_record_id: data.last_maintenance_record_id ?? null,
      status: data.status ?? 'active',
      created_at: now,
      updated_at: now,
    };
    inMemoryDB.reminders.push(reminder);
    await saveToStorage();
    return reminder;
  },

  async updateReminder(id: number, data: ReminderUpdate): Promise<ReminderRow> {
    await loadFromStorage();
    const index = inMemoryDB.reminders.findIndex((r) => r.id === id);
    if (index === -1) throw new Error('Reminder not found');
    const existing = inMemoryDB.reminders[index];
    const updated: ReminderRow = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };
    inMemoryDB.reminders[index] = updated;
    await saveToStorage();
    return updated;
  },

  async deleteReminder(id: number): Promise<void> {
    await loadFromStorage();
    inMemoryDB.reminders = inMemoryDB.reminders.filter((r) => r.id !== id);
    await saveToStorage();
  },

  // Modifications
  async getModifications(vehicleId: number): Promise<ModificationRow[]> {
    await loadFromStorage();
    return inMemoryDB.modifications
      .filter((m) => m.vehicle_id === vehicleId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async getModificationDetails(modId: number): Promise<ModificationWithDetails | null> {
    await loadFromStorage();
    const mod = inMemoryDB.modifications.find((m) => m.id === modId);
    if (!mod) return null;
    const settingSets = inMemoryDB.modificationSettingSets
      .filter((s) => s.modification_id === modId)
      .map((set) => {
        const settings = inMemoryDB.modificationSettings.filter((st) => st.setting_set_id === set.id);
        return {
          ...set,
          settings,
        };
      });

    return {
      ...mod,
      photos: [],
      setting_sets: settingSets,
    };
  },

  async addModification(data: ModificationInsert): Promise<ModificationRow> {
    await loadFromStorage();
    const newId = inMemoryDB.modifications.length > 0 
      ? Math.max(...inMemoryDB.modifications.map((m) => m.id)) + 1 
      : 1;
    const now = new Date().toISOString();
    const mod: ModificationRow = {
      id: newId,
      vehicle_id: data.vehicle_id,
      category: data.category,
      item_name: data.item_name,
      brand: data.brand ?? null,
      model: data.model ?? null,
      install_date: data.install_date ?? null,
      install_mileage: data.install_mileage ?? null,
      purchase_date: data.purchase_date ?? null,
      purchase_price: data.purchase_price ?? 0,
      install_price: data.install_price ?? 0,
      shop_name: data.shop_name ?? null,
      note: data.note ?? null,
      created_at: now,
      updated_at: now,
    };
    inMemoryDB.modifications.unshift(mod);
    await saveToStorage();
    return mod;
  },

  async updateModification(id: number, data: ModificationUpdate): Promise<ModificationRow> {
    await loadFromStorage();
    const index = inMemoryDB.modifications.findIndex((m) => m.id === id);
    if (index === -1) throw new Error('Modification not found');
    const existing = inMemoryDB.modifications[index];
    const updated: ModificationRow = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };
    inMemoryDB.modifications[index] = updated;
    await saveToStorage();
    return updated;
  },

  async deleteModification(id: number): Promise<void> {
    await loadFromStorage();
    inMemoryDB.modifications = inMemoryDB.modifications.filter((m) => m.id !== id);
    inMemoryDB.modificationSettingSets = inMemoryDB.modificationSettingSets.filter((s) => s.modification_id !== id);
    await saveToStorage();
  },

  // Modification Setting Sets
  async createSettingSet(data: ModificationSettingSetInsert, settings: { setting_name: string; setting_value: string; unit?: string | null }[]) {
    await loadFromStorage();
    const newSetId = inMemoryDB.modificationSettingSets.length > 0
      ? Math.max(...inMemoryDB.modificationSettingSets.map((s) => s.id)) + 1
      : 1;
    const now = new Date().toISOString();

    if (data.is_current) {
      inMemoryDB.modificationSettingSets
        .filter((s) => s.modification_id === data.modification_id)
        .forEach((s) => {
          s.is_current = false;
        });
    }

    const setRow: ModificationSettingSetRow = {
      id: newSetId,
      modification_id: data.modification_id,
      name: data.name,
      recorded_date: data.recorded_date,
      mileage: data.mileage ?? null,
      note: data.note ?? null,
      is_current: data.is_current ?? false,
      created_at: now,
      updated_at: now,
    };
    inMemoryDB.modificationSettingSets.push(setRow);

    const settingRows: ModificationSettingRow[] = settings.map((st, idx) => ({
      id: inMemoryDB.modificationSettings.length + idx + 1,
      setting_set_id: newSetId,
      setting_name: st.setting_name,
      setting_value: st.setting_value,
      unit: st.unit ?? null,
      created_at: now,
      updated_at: now,
    }));
    inMemoryDB.modificationSettings.push(...settingRows);

    await saveToStorage();
    return {
      ...setRow,
      settings: settingRows,
    };
  },

  async setCurrentSettingSet(modId: number, setId: number) {
    await loadFromStorage();
    inMemoryDB.modificationSettingSets
      .filter((s) => s.modification_id === modId)
      .forEach((s) => {
        s.is_current = s.id === setId;
      });
    await saveToStorage();
  },

  // Timeline
  async getTimeline(vehicleId: number): Promise<VehicleTimelineRow[]> {
    await loadFromStorage();
    const timeline: VehicleTimelineRow[] = [];

    inMemoryDB.refuels
      .filter((r) => r.vehicle_id === vehicleId)
      .forEach((r) => {
        timeline.push({
          vehicle_id: r.vehicle_id,
          event_type: 'refuel',
          event_id: r.id,
          event_date: r.refuel_date,
          mileage: r.mileage,
          cost: r.total_cost,
          title: r.fuel_type,
          description: null,
          created_at: r.created_at,
        });
      });

    inMemoryDB.maintenanceRecords
      .filter((m) => m.vehicle_id === vehicleId)
      .forEach((m) => {
        timeline.push({
          vehicle_id: m.vehicle_id,
          event_type: m.record_type,
          event_id: m.id,
          event_date: m.service_date,
          mileage: m.mileage,
          cost: m.cost,
          title: m.item_name,
          description: m.note,
          created_at: m.created_at,
        });
      });

    inMemoryDB.modifications
      .filter((m) => m.vehicle_id === vehicleId)
      .forEach((m) => {
        timeline.push({
          vehicle_id: m.vehicle_id,
          event_type: 'modification',
          event_id: m.id,
          event_date: m.install_date || m.purchase_date || m.created_at.split('T')[0],
          mileage: m.install_mileage || 0,
          cost: (m.purchase_price || 0) + (m.install_price || 0),
          title: m.item_name,
          description: m.note,
          created_at: m.created_at,
        });
      });

    return timeline.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
  },
};
