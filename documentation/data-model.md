# 資料模型與里程權威運算原則 (Data Model & Mileage Integrity)

---

## 1. 資料模型實體關聯 (Entity Relationship)

系統由 11 張關聯資料表與 1 個唯讀視圖（View）構成，完整對應車輛生命週期各實體：

```text
auth.users
    │
    ▼
 Vehicles
    ├── VehiclePhotos
    ├── Refuels
    ├── MaintenanceRecords
    │       └── MaintenancePhotos
    ├── Reminders
    ├── RecurringExpenses
    └── Modifications
            ├── ModificationPhotos
            └── ModificationSettingSets
                    └── ModificationSettings
```

---

## 2. 完整資料表結構清單 (Database Tables & Views)

| 資料表名稱 | 說明 | 關鍵限制與外部鍵約束 |
| :--- | :--- | :--- |
| `Vehicles` | 車輛主表 | `user_id -> auth.users`, `current_mileage >= initial_mileage`, 支援 `manufacture_date` |
| `VehiclePhotos` | 車輛照片表 | `vehicle_id -> Vehicles (CASCADE)`, 單一封面唯一約束 |
| `Refuels` | 加油紀錄表 | `vehicle_id -> Vehicles (CASCADE)`, `volume > 0`, `total_cost >= 0` |
| `MaintenanceRecords` | 保養與維修表 | `vehicle_id -> Vehicles (CASCADE)`, `record_type IN ('maintenance', 'repair')` |
| `MaintenancePhotos` | 保養維修照片表 | `maintenance_record_id -> MaintenanceRecords (CASCADE)` |
| `Reminders` | 保養週期提醒表 | `vehicle_id -> Vehicles (CASCADE)`, `last_record_id -> SET NULL` |
| `RecurringExpenses` | 週期規費與法定排程表 | `vehicle_id -> Vehicles (CASCADE)`, `category` Enum, `amount >= 0`, `paid_date <= CURRENT_DATE` |
| `Modifications` | 改裝品檔案表 | `vehicle_id -> Vehicles (CASCADE)`, `category` Enum 列舉 |
| `ModificationPhotos` | 改裝實拍照表 | `modification_id -> Modifications (CASCADE)` |
| `ModificationSettingSets` | 改裝調校版本表 | `modification_id -> Modifications (CASCADE)`, 單一生效版本唯一約束 |
| `ModificationSettings` | 改裝參數細項表 | `setting_set_id -> ModificationSettingSets (CASCADE)` |
| `vehicle_timeline` (View) | 時序動態聚合 View | `WITH (security_invoker = true)` 繼承呼叫者 RLS 權限，整合購車、加油、保養、維修、改裝與週期規費 |

---

## 3. 時序 View 定義與型別一致性 (`vehicle_timeline`)

視圖採用 `WITH (security_invoker = true)`，並確保所有 UNION 分支之型別精確對齊：

```sql
CREATE OR REPLACE VIEW public.vehicle_timeline WITH (security_invoker = true) AS
-- 1. 購車入庫事件 (嚴格僅當 purchase_date 存在時生成)
SELECT 
    v.id AS vehicle_id,
    'purchase'::text AS event_type,
    v.id AS event_id,
    v.purchase_date AS event_date,
    v.initial_mileage AS mileage,
    COALESCE(v.purchase_price, 0::numeric) AS cost,
    v.name AS title,
    '車輛入庫'::text AS description,
    v.created_at
FROM "Vehicles" v
WHERE v.purchase_date IS NOT NULL

UNION ALL

-- 2. 加油事件
SELECT 
    r.vehicle_id,
    'refuel'::text AS event_type,
    r.id AS event_id,
    r.refuel_date AS event_date,
    r.mileage,
    r.total_cost AS cost,
    r.fuel_type AS title,
    NULL::text AS description,
    r.created_at
FROM "Refuels" r

UNION ALL

-- 3. 保養與維修事件
SELECT 
    m.vehicle_id,
    m.record_type::text AS event_type,
    m.id AS event_id,
    m.service_date AS event_date,
    m.mileage,
    m.total_cost AS cost,
    m.title,
    m.notes AS description,
    m.created_at
FROM "MaintenanceRecords" m

UNION ALL

-- 4. 改裝入庫事件
SELECT 
    mod.vehicle_id,
    'modification'::text AS event_type,
    mod.id AS event_id,
    COALESCE(mod.install_date, mod.purchase_date, mod.created_at::date) AS event_date,
    mod.install_mileage AS mileage,
    (COALESCE(mod.purchase_price, 0::numeric) + COALESCE(mod.install_price, 0::numeric)) AS cost,
    mod.name AS title,
    mod.brand AS description,
    mod.created_at
FROM "Modifications" mod

UNION ALL

-- 5. 週期規費事件 (顯式 NULL::integer 轉型防護)
SELECT 
    rec.vehicle_id,
    'recurring_expense'::text AS event_type,
    rec.id AS event_id,
    rec.paid_date AS event_date,
    NULL::integer AS mileage,
    COALESCE(rec.amount, 0::numeric) AS cost,
    rec.title,
    rec.notes AS description,
    rec.created_at
FROM "RecurringExpenses" rec;
```

---

## 4. 里程權威原則 (Server-Authoritative Mileage Integrity)

車輛當前總里程（`current_mileage`）是整套車況管理的心臟，系統落實嚴格的**伺服器端唯一權威原則（Server-Authoritative Mileage）**：

```text
initial_mileage (入庫初始里程，不可變基線)
      ├── max(Refuel mileage)
      ├── max(Maintenance mileage)
      └── max(Modification install_mileage)
                  │
                  ▼
   current_mileage = GREATEST(...)
```

* **原子運算基準**：
  ```sql
  UPDATE "Vehicles"
  SET current_mileage = GREATEST(
      initial_mileage,
      COALESCE((SELECT MAX(mileage) FROM "Refuels" WHERE vehicle_id = $1), 0),
      COALESCE((SELECT MAX(mileage) FROM "MaintenanceRecords" WHERE vehicle_id = $1), 0),
      COALESCE((SELECT MAX(install_mileage) FROM "Modifications" WHERE vehicle_id = $1), 0)
  )
  WHERE id = $1;
  ```
* **不可變初始基線**：車輛建立後的 `initial_mileage` 在後端更新介面（`PATCH /api/v1/vehicles/:id`）被嚴格鎖定，若用戶端發送修改嘗試，後端直接回傳 `400 VALIDATION_ERROR` 予以拒絕。
* **一致性約束**：資料庫約束強制 `current_mileage >= initial_mileage`。
* **狀態協調 (Reconciliation)**：用戶端離線或即時輸入時僅做樂觀推昇；伺服器處理完成後一律以資料庫計算結果為權威值，透過 `invalidateQueries` 覆蓋本地客戶端暫態。
