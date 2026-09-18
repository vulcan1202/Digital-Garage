# 資訊安全與存取控制 (Security & RLS Architecture)

---

## 1. 安全架構總覽 (Security Overview)

系統在各層級均落實基於使用者擁有權之存取控制（Ownership-based Access Control），杜絕任何未經授權的跨租戶讀寫與資料外洩：

```text
HTTP Request (Bearer JWT)
        │
        ▼
[API Layer: AuthMiddleware] ──── 驗簽失敗 ───► 401 AUTH_REQUIRED
        │ (注入 user_id 至 Context)
        ▼
[Service & Repo: vehicle_id 擁有權校驗]
        │
        ▼
[Database Layer: PostgreSQL 1~3 Tier RLS]
        ├── Vehicles (auth.uid() = user_id)
        ├── 1st-Tier Tables (EXISTS in Vehicles)
        └── 2nd & 3rd-Tier Tables (Recursive JOIN to Vehicles)
```

---

## 2. API 層：JWT Bearer 鑑權

* **中介層防護**：所有業務路由均掛載 `AuthMiddleware`。
* **簽章與時效驗證**：解析用戶端傳入之 Supabase Access Token，使用對稱/非對稱金鑰驗簽。
* **Context 注入**：驗簽成功後將使用者的 UUID（`user_id`）安全注入 Request Context，供後續 Handler 與 Repository 使用。
* **無效憑證阻絕**：若 Token 缺失、過期或簽名無效，立即中斷並回應 `401 AUTH_REQUIRED`。

---

## 3. 資料庫層：PostgreSQL Row Level Security (RLS)

系統內 11 張業務資料表全面啟用 RLS（`ENABLE ROW LEVEL SECURITY`），並實施 1 到 3 階層之遞迴安全防禦：

### 1-Tier 根層表 (`Vehicles`)
直接驗證當前連線用戶之 UID 是否匹配車輛擁有人：
```sql
CREATE POLICY "Users can manage own vehicles"
ON "Vehicles"
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

### 2-Tier 一級子表 (`Refuels`, `MaintenanceRecords`, `Reminders`, `RecurringExpenses`, `Modifications`, `VehiclePhotos`)
透過外鍵關聯至車輛主表，校驗車輛歸屬：
```sql
-- 以 Refuels 為例
CREATE POLICY "Users can manage refuels of own vehicles"
ON "Refuels"
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM "Vehicles" v
        WHERE v.id = "Refuels".vehicle_id
          AND v.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "Vehicles" v
        WHERE v.id = "Refuels".vehicle_id
          AND v.user_id = auth.uid()
    )
);
```

### 3-Tier 二級與三級子表 (`MaintenancePhotos`, `ModificationPhotos`, `ModificationSettingSets`, `ModificationSettings`)
多層遞迴 JOIN 向上追溯至車輛主表確認擁有者：
```sql
-- 以 ModificationSettings (三級子表) 為例
CREATE POLICY "Users can manage settings of own sets"
ON "ModificationSettings"
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM "ModificationSettingSets" s
        JOIN "Modifications" m ON m.id = s.modification_id
        JOIN "Vehicles" v ON v.id = m.vehicle_id
        WHERE s.id = "ModificationSettings".setting_set_id
          AND v.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "ModificationSettingSets" s
        JOIN "Modifications" m ON m.id = s.modification_id
        JOIN "Vehicles" v ON v.id = m.vehicle_id
        WHERE s.id = "ModificationSettings".setting_set_id
          AND v.user_id = auth.uid()
    )
);
```

---

## 4. 視圖權限穿透防護 (`vehicle_timeline`)

視圖定義時明確宣告：
```sql
CREATE OR REPLACE VIEW public.vehicle_timeline WITH (security_invoker = true) AS ...
```
* **Security Invoker 語意**：查詢 View 時，強制繼承呼叫者當前之 RLS 安全上下文，而非以視圖定義者（Security Definer）權限執行。
* **防止旁路滲透**：有效杜絕透過視圖存取未授權跨用戶資料的漏洞。

---

## 5. 物件儲存層：Supabase Storage Policies

* **路徑規則**：照片上傳路徑包含用戶或車輛識別（如 `${userId}/${vehicleId}/...`）。
* **Storage Bucket 規則**：配置 Storage RLS Policies，限制用戶僅能對歸屬於自己的車輛目錄進行 `SELECT`、`INSERT` 與 `DELETE` 操作，杜絕檔案被任意遍歷或覆寫。
