/**
 * 數位車庫 (Digital Garage) Database Source of Truth
 * 嚴格對齊「數位車庫 (Digital Garage).sql」
 */

// ==========================================
// 1. ENUMS (SQL CREATE TYPE ... AS ENUM)
// ==========================================

export type ModificationCategory =
  | 'suspension'
  | 'braking'
  | 'engine'
  | 'exhaust'
  | 'intake'
  | 'wheels_tires'
  | 'exterior'
  | 'interior'
  | 'electronics'
  | 'other';

export type FuelType =
  | 'gasoline_92'
  | 'gasoline_95'
  | 'gasoline_98'
  | 'diesel'
  | 'premium_diesel'
  | 'electric'
  | 'hybrid'
  | 'other';

export type MaintenanceRecordType =
  | 'maintenance'
  | 'repair';

export type ReminderStatus =
  | 'active'
  | 'paused';

// ==========================================
// 2. TABLES (Row, Insert, Update)
// 採用 type 定義以完美相容 Supabase GenericTable & PostgREST
// ==========================================

export type VehicleType = 'car' | 'motorcycle' | 'other';

// 車輛表 (Vehicles)
export type VehicleRow = {
  id: number;
  user_id: string; // uuid
  brand: string;
  model: string;
  vehicle_type: VehicleType;
  year: number | null;
  purchase_date: string | null; // date
  purchase_price: number | null;
  fuel_type: FuelType | null;
  engine_displacement_cc: number | null;
  license_plate: string | null;
  initial_mileage: number; // CHECK >= 0
  current_mileage: number; // CHECK >= 0
  created_at: string; // timestamptz
  updated_at: string; // timestamptz
};

export type VehicleInsert = {
  id?: number;
  user_id: string;
  brand: string;
  model: string;
  vehicle_type: VehicleType; // 必填，不可預設
  year?: number | null;
  purchase_date?: string | null;
  purchase_price?: number | null;
  fuel_type?: FuelType | null;
  engine_displacement_cc?: number | null;
  license_plate?: string | null;
  initial_mileage?: number;
  current_mileage?: number;
  created_at?: string;
  updated_at?: string;
};

export type VehicleUpdate = {
  id?: number;
  user_id?: string;
  brand?: string;
  model?: string;
  vehicle_type?: VehicleType;
  year?: number | null;
  purchase_date?: string | null;
  purchase_price?: number | null;
  fuel_type?: FuelType | null;
  engine_displacement_cc?: number | null;
  license_plate?: string | null;
  // 規則：initial_mileage 建立後不可修改
  current_mileage?: number;
  created_at?: string;
  updated_at?: string;
};

// 車輛照片 (VehiclePhotos)
export type VehiclePhotoRow = {
  id: number;
  vehicle_id: number;
  url: string;
  sort_order: number;
  is_cover: boolean;
  created_at: string;
};

export type VehiclePhotoInsert = {
  id?: number;
  vehicle_id: number;
  url: string;
  sort_order?: number;
  is_cover?: boolean;
  created_at?: string;
};

export type VehiclePhotoUpdate = {
  id?: number;
  vehicle_id?: number;
  url?: string;
  sort_order?: number;
  is_cover?: boolean;
  created_at?: string;
};

// 加油紀錄 (Refuels)
export type RefuelRow = {
  id: number;
  vehicle_id: number;
  refuel_date: string; // date
  mileage: number; // CHECK >= 0
  volume: number; // CHECK > 0
  price_per_unit: number | null;
  total_cost: number; // CHECK >= 0
  fuel_type: FuelType;
  created_at: string;
  updated_at: string;
};

export type RefuelInsert = {
  id?: number;
  vehicle_id: number;
  refuel_date: string;
  mileage: number;
  volume: number;
  price_per_unit?: number | null;
  total_cost: number;
  fuel_type: FuelType;
  created_at?: string;
  updated_at?: string;
};

export type RefuelUpdate = {
  id?: number;
  vehicle_id?: number;
  refuel_date?: string;
  mileage?: number;
  volume?: number;
  price_per_unit?: number | null;
  total_cost?: number;
  fuel_type?: FuelType;
  created_at?: string;
  updated_at?: string;
};

// 保養與維修紀錄 (MaintenanceRecords)
export type MaintenanceRecordRow = {
  id: number;
  vehicle_id: number;
  record_type: MaintenanceRecordType;
  item_name: string;
  service_date: string; // date
  mileage: number; // CHECK >= 0
  cost: number; // CHECK >= 0
  shop_name: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type MaintenanceRecordInsert = {
  id?: number;
  vehicle_id: number;
  record_type: MaintenanceRecordType;
  item_name: string;
  service_date: string;
  mileage: number;
  cost?: number;
  shop_name?: string | null;
  note?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type MaintenanceRecordUpdate = {
  id?: number;
  vehicle_id?: number;
  record_type?: MaintenanceRecordType;
  item_name?: string;
  service_date?: string;
  mileage?: number;
  cost?: number;
  shop_name?: string | null;
  note?: string | null;
  created_at?: string;
  updated_at?: string;
};

// 保養維修照片 (MaintenancePhotos)
export type MaintenancePhotoRow = {
  id: number;
  maintenance_record_id: number;
  url: string;
  sort_order: number;
  created_at: string;
};

export type MaintenancePhotoInsert = {
  id?: number;
  maintenance_record_id: number;
  url: string;
  sort_order?: number;
  created_at?: string;
};

export type MaintenancePhotoUpdate = {
  id?: number;
  maintenance_record_id?: number;
  url?: string;
  sort_order?: number;
  created_at?: string;
};

// 保養提醒 (Reminders)
export type ReminderRow = {
  id: number;
  vehicle_id: number;
  item_name: string;
  interval_km: number | null;
  interval_months: number | null;
  base_mileage: number | null;
  base_date: string | null; // date
  last_completed_mileage: number | null;
  last_completed_date: string | null; // date
  last_maintenance_record_id: number | null;
  status: ReminderStatus;
  created_at: string;
  updated_at: string;
};

export type ReminderInsert = {
  id?: number;
  vehicle_id: number;
  item_name: string;
  interval_km?: number | null;
  interval_months?: number | null;
  base_mileage?: number | null;
  base_date?: string | null;
  last_completed_mileage?: number | null;
  last_completed_date?: string | null;
  last_maintenance_record_id?: number | null;
  status?: ReminderStatus;
  created_at?: string;
  updated_at?: string;
};

export type ReminderUpdate = {
  id?: number;
  vehicle_id?: number;
  item_name?: string;
  interval_km?: number | null;
  interval_months?: number | null;
  base_mileage?: number | null;
  base_date?: string | null;
  last_completed_mileage?: number | null;
  last_completed_date?: string | null;
  last_maintenance_record_id?: number | null;
  status?: ReminderStatus;
  created_at?: string;
  updated_at?: string;
};

// 改裝品 (Modifications)
export type ModificationRow = {
  id: number;
  vehicle_id: number;
  brand: string | null;
  item_name: string;
  model: string | null;
  category: ModificationCategory;
  purchase_date: string | null; // date
  install_date: string | null; // date (安裝日)
  install_mileage: number | null; // CHECK IS NULL OR >= 0
  purchase_price: number; // CHECK >= 0
  install_price: number; // CHECK >= 0
  shop_name: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type ModificationInsert = {
  id?: number;
  vehicle_id: number;
  brand?: string | null;
  item_name: string;
  model?: string | null;
  category: ModificationCategory;
  purchase_date?: string | null;
  install_date?: string | null;
  install_mileage?: number | null;
  purchase_price?: number;
  install_price?: number;
  shop_name?: string | null;
  note?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ModificationUpdate = {
  id?: number;
  vehicle_id?: number;
  brand?: string | null;
  item_name?: string;
  model?: string | null;
  category?: ModificationCategory;
  purchase_date?: string | null;
  install_date?: string | null;
  install_mileage?: number | null;
  purchase_price?: number;
  install_price?: number;
  shop_name?: string | null;
  note?: string | null;
  created_at?: string;
  updated_at?: string;
};

// 改裝照片 (ModificationPhotos) - photo_type 為 varchar 非 enum
export type ModificationPhotoRow = {
  id: number;
  modification_id: number;
  url: string;
  sort_order: number;
  photo_type: string | null;
  created_at: string;
};

export type ModificationPhotoInsert = {
  id?: number;
  modification_id: number;
  url: string;
  sort_order?: number;
  photo_type?: string | null;
  created_at?: string;
};

export type ModificationPhotoUpdate = {
  id?: number;
  modification_id?: number;
  url?: string;
  sort_order?: number;
  photo_type?: string | null;
  created_at?: string;
};

// 改裝設定組 (ModificationSettingSets)
export type ModificationSettingSetRow = {
  id: number;
  modification_id: number;
  name: string;
  recorded_date: string; // date (設定建立/啟用日)
  mileage: number | null; // CHECK IS NULL OR >= 0
  note: string | null;
  is_current: boolean;
  created_at: string;
  updated_at: string;
};

export type ModificationSettingSetInsert = {
  id?: number;
  modification_id: number;
  name: string;
  recorded_date: string;
  mileage?: number | null;
  note?: string | null;
  is_current?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ModificationSettingSetUpdate = {
  id?: number;
  modification_id?: number;
  name?: string;
  recorded_date?: string;
  mileage?: number | null;
  note?: string | null;
  is_current?: boolean;
  created_at?: string;
  updated_at?: string;
};

// 改裝細項參數 (ModificationSettings) - 通用參數
export type ModificationSettingRow = {
  id: number;
  setting_set_id: number;
  setting_name: string;
  setting_value: string;
  unit: string | null;
  created_at: string;
  updated_at: string;
};

export type ModificationSettingInsert = {
  id?: number;
  setting_set_id: number;
  setting_name: string;
  setting_value: string;
  unit?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ModificationSettingUpdate = {
  id?: number;
  setting_set_id?: number;
  setting_name?: string;
  setting_value?: string;
  unit?: string | null;
  created_at?: string;
  updated_at?: string;
};

// ==========================================
// 3. VIEWS (vehicle_timeline)
// ==========================================

export type TimelineEventType = 'refuel' | 'maintenance' | 'repair' | 'modification' | 'purchase';

export type VehicleTimelineRow = {
  vehicle_id: number;
  event_type: TimelineEventType;
  event_id: number;
  event_date: string;
  mileage: number;
  cost: number;
  title: string;
  description: string | null;
  created_at: string;
};

// ==========================================
// 4. SUPABASE DATABASE SCHEMA TYPE
// ==========================================

export type Database = {
  public: {
    Tables: {
      Vehicles: {
        Row: VehicleRow;
        Insert: VehicleInsert;
        Update: VehicleUpdate;
        Relationships: [];
      };
      VehiclePhotos: {
        Row: VehiclePhotoRow;
        Insert: VehiclePhotoInsert;
        Update: VehiclePhotoUpdate;
        Relationships: [
          {
            foreignKeyName: "VehiclePhotos_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "Vehicles";
            referencedColumns: ["id"];
          }
        ];
      };
      Refuels: {
        Row: RefuelRow;
        Insert: RefuelInsert;
        Update: RefuelUpdate;
        Relationships: [
          {
            foreignKeyName: "Refuels_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "Vehicles";
            referencedColumns: ["id"];
          }
        ];
      };
      MaintenanceRecords: {
        Row: MaintenanceRecordRow;
        Insert: MaintenanceRecordInsert;
        Update: MaintenanceRecordUpdate;
        Relationships: [
          {
            foreignKeyName: "MaintenanceRecords_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "Vehicles";
            referencedColumns: ["id"];
          }
        ];
      };
      MaintenancePhotos: {
        Row: MaintenancePhotoRow;
        Insert: MaintenancePhotoInsert;
        Update: MaintenancePhotoUpdate;
        Relationships: [
          {
            foreignKeyName: "MaintenancePhotos_maintenance_record_id_fkey";
            columns: ["maintenance_record_id"];
            isOneToOne: false;
            referencedRelation: "MaintenanceRecords";
            referencedColumns: ["id"];
          }
        ];
      };
      Reminders: {
        Row: ReminderRow;
        Insert: ReminderInsert;
        Update: ReminderUpdate;
        Relationships: [
          {
            foreignKeyName: "Reminders_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "Vehicles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "Reminders_last_maintenance_record_id_fkey";
            columns: ["last_maintenance_record_id"];
            isOneToOne: false;
            referencedRelation: "MaintenanceRecords";
            referencedColumns: ["id"];
          }
        ];
      };
      Modifications: {
        Row: ModificationRow;
        Insert: ModificationInsert;
        Update: ModificationUpdate;
        Relationships: [
          {
            foreignKeyName: "Modifications_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "Vehicles";
            referencedColumns: ["id"];
          }
        ];
      };
      ModificationPhotos: {
        Row: ModificationPhotoRow;
        Insert: ModificationPhotoInsert;
        Update: ModificationPhotoUpdate;
        Relationships: [
          {
            foreignKeyName: "ModificationPhotos_modification_id_fkey";
            columns: ["modification_id"];
            isOneToOne: false;
            referencedRelation: "Modifications";
            referencedColumns: ["id"];
          }
        ];
      };
      ModificationSettingSets: {
        Row: ModificationSettingSetRow;
        Insert: ModificationSettingSetInsert;
        Update: ModificationSettingSetUpdate;
        Relationships: [
          {
            foreignKeyName: "ModificationSettingSets_modification_id_fkey";
            columns: ["modification_id"];
            isOneToOne: false;
            referencedRelation: "Modifications";
            referencedColumns: ["id"];
          }
        ];
      };
      ModificationSettings: {
        Row: ModificationSettingRow;
        Insert: ModificationSettingInsert;
        Update: ModificationSettingUpdate;
        Relationships: [
          {
            foreignKeyName: "ModificationSettings_setting_set_id_fkey";
            columns: ["setting_set_id"];
            isOneToOne: false;
            referencedRelation: "ModificationSettingSets";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      vehicle_timeline: {
        Row: VehicleTimelineRow;
        Relationships: [];
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      modification_category: ModificationCategory;
      fuel_type: FuelType;
      maintenance_record_type: MaintenanceRecordType;
      reminder_status: ReminderStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// 輔助復合型別（UI / Service 常用封裝）
export type VehicleWithCover = VehicleRow & {
  cover_url: string | null;
};

export type ModificationWithDetails = ModificationRow & {
  photos: ModificationPhotoRow[];
  setting_sets: (ModificationSettingSetRow & {
    settings: ModificationSettingRow[];
  })[];
};
