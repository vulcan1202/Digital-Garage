# Digital Garage｜數位車庫

> 一支手機就是一座數位車庫。

---

## 1. 專案概述 (Overview)

「數位車庫（Digital Garage）」是一套以**車輛生命週期管理與愛車履歷紀錄**為核心的 Android 行動應用系統。

### 核心痛點與設計理念
傳統的油耗計算 App 往往只關注單次油耗，保養記帳工具則多半分散於零碎的記事本或試算表中；改裝與底盤設定數據更是經常丟失於通訊軟體對話紀錄中。  
「數位車庫」以**單一車輛**為核心資料主體，持續收攏與連結其行駛歷程中的各項事件：

```text
Vehicle
├── Fuel / Refuel
├── Maintenance
├── Repair
├── Reminder
├── Modification
│   └── Setting Set / Version Comparison
├── Photos
├── Timeline
└── Cost Analytics
```

系統解決了車輛使用數據割裂的痛點，整合加油、保養、維修、週期提醒、改裝調校版本控制、多維度持有成本分析與生命週期動態時序牆，為愛車建立完整、嚴謹且具備可追溯性的數位履歷。

---

## 2. 核心功能模組 (Core Features)

### 車輛管理 (Vehicle Management)
* **車輛建檔與基本資料**：支援汽車（`car`）、機車（`motorcycle`）與其他（`other`）三種車輛類型。
* **核心規格屬性**：記錄品牌、型號、年份、車牌號碼、排氣量（cc）、動力燃料種類、購入日期（`purchase_date`）與購入金額（`purchase_price`）。
* **里程基線保護**：建置入庫「初始里程（`initial_mileage`）」與「當前里程（`current_mileage`）」，資料庫層級強制約束 `current_mileage >= initial_mileage`。
* **車輛首圖與多圖管理**：支援多張車輛外觀相片上傳與封面設定，具備封面刪除自動遞補機制。

### 加油日誌與油耗分析 (Fuel Management)
* **紀錄欄位**：加油日期、當前累計里程（公里）、加油量（公升）、單價（元/公升）、總金額與燃油規格（92/95/98無鉛、柴油、超柴、電力、油電、其他）。
* **純運算指標 (`fuelCalculator.ts`)**：精準計算每百公里公升數（$\text{L}/100\text{km}$）與每公升行駛公里數（$\text{km}/\text{L}$），具備零里程增量與極值除以零保護。

### 保養與維修履歷 (Maintenance & Repair)
* **雙軌分類**：明確拆分為「定期保養（`maintenance`）」與「故障維修（`repair`）」，報表與時序牆獨立分類呈現。
* **工單詳細內容**：項目名稱、施作日期、施作里程、費用、施作店家與詳細備註。
* **現場工單實拍**：各工單支援獨立上傳多張現場單據或施工相片。
* **自動連動提醒**：新增保養工單時可勾選同步設定下次週期提醒。

### 保養提醒系統 (Reminders)
* **雙向週期追蹤**：支援里程週期（`interval_km`）與時間月份週期（`interval_months`）。
* **狀態即時判定 (`reminderCalculator.ts`)**：依車輛最新里程與當前日期動態推算剩餘天數與里程，劃分為：
  * **逾期（Overdue）**
  * **即將到期（Due Soon）**
  * **正常（Good）**
* **彈性控制**：支援「啟用中（`active`）」與「暫停（`paused`）」狀態切換；標記完成時自動將基準里程與基準日期前移至最新作業點。

### 改裝品管理 (Modifications)
* **改裝品檔案**：記錄品牌、品名、型號、改裝品類別（懸吊、煞車、引擎、排氣、進氣、輪框輪胎、外觀、內裝、電系、其他）。
* **雙重成本拆分**：明確區分「購買價格（`purchase_price`）」與「安裝工資（`install_price`）」，以及購買日、安裝日與安裝里程。
* **改裝照片**：支援上傳改裝品安裝實照。

### 改裝調校版本控制 (Modification Setting Set)
* **多版本管理**：單一改裝品可建立多組調校設定（如「賽道設定」、「山路跑山」、「日常通勤」）。
* **生效版本保護**：每組改裝品同一時間僅有一組設定標記為使用中（`is_current = true`），由資料庫 Partial Unique Index 嚴格防護。
* **版本複製 (Clone)**：在後端單一原子交易內，完整深拷貝指定版本及其所有參數細項，生成獨立 Snapshot。
* **智慧遞補**：當使用中的設定組遭刪除時，系統自動將生效狀態轉移至剩餘之最新版本。
* **跨版本參數差異比對 (`settingComparator.ts`)**：提供視覺化比較工具，以 Map-based union 差異演算法精確標示各項參數之：
  * **新增 (Added)**
  * **移除 (Removed)**
  * **數值變更 (Changed)**
  * **完全相同 (Unchanged)**

### 車輛動態時序牆 (Vehicle Lifecycle Timeline)
* **全生命週期整合**：自資料庫專屬 View 整合購車、加油、保養、維修與改裝事件。
* **四層確定性排序 (4-Tier Deterministic Ordering)**：
  1. `event_date DESC`
  2. `mileage DESC NULLS LAST`
  3. `created_at DESC`
  4. `event_id DESC`
* **購車入庫事件嚴謹原則**：僅當車輛明確填寫 `purchase_date` 時產生 Purchase Event，**嚴格禁止以 `created_at` 假造購入日期**。
* **多元篩選**：支援全部、加油、保養、維修、改裝等類別切換檢視。

### 多維度持有成本分析 (Cost Analytics)
* **時間區間**：提供 6 個月、12 個月、24 個月歷程切換。
* **月份填零保護 (Monthly Zero-Filling)**：無支出月份完整填入 0，防止趨勢圖座標軸斷裂。
* **改裝費用精確歸屬**：購買金額依 `purchase_date` 歸屬月份，安裝工資依 `install_date` 歸屬月份；無日期紀錄者不隨意污染月度統計。
* **指標計算與資料語意**：
  * **總運作成本 (Total Operational Cost)**：加油 + 保養 + 維修 + 改裝購買與安裝。
  * **總擁有成本 (Total Ownership Cost / TCO)**：購入金額 + 總運作成本。若未填寫購入金額則為 `null`，不以 0 元誤導。
  * **每公里平均成本與每公里油資**：
    $$\text{deltaMileage} = \text{current\_mileage} - \text{initial\_mileage}$$
    $$\text{deltaMileage} \le 0 \implies \text{cost\_per\_km} = \text{null},\ \text{fuel\_cost\_per\_km} = \text{null}$$
    回傳 `null` 明確表達「尚無足夠里程資料以利計算」，防止除以零產生 `NaN` 或誤植為 0 元。

---

## 3. 系統架構 (System Architecture)

專案落實職責分離的分層架構，行動端透過標準 RESTful API 與 Go 後端溝通，雲端基底採用 Supabase 提供認證、PostgreSQL 與物件儲存：

```text
┌─────────────────────────────────────────────────────────────┐
│                 Mobile App (React Native / Expo)            │
│  - TypeScript 嚴格型別定義                                   │
│  - TanStack React Query 狀態管理與 onlineManager 連線同步   │
│  - networkMonitor: AppState 前景喚醒 + 事件驅動連線感知     │
│  - syncQueue: FIFO 永續突變佇列 (PENDING / SYNC / FAILED)   │
│  - cacheStorage: expo-secure-store 分項輕量持久化快照        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ HTTPS / Bearer Supabase JWT
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Go Backend (Cloud Run)                      │
│  - Chi v5 路由器與中介層                                     │
│  - JWT Bearer 鑑權與 Context 使用者注入                     │
│  - 400 VALIDATION_ERROR 結構化輸入驗證                      │
│  - 里程唯一權威運算 (GREATEST Atomic Query)                 │
│  - 多維度成本聚合 API (SQL Monthly Aggregation)             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ PostgreSQL (Session Pooler: 5432)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Supabase Cloud Platform                     │
│  - PostgreSQL 15 (10 大業務資料表、時序 View、Check 限制)   │
│  - Row Level Security (RLS 1-tier ~ 3-tier 擁有權隔離)      │
│  - Supabase Auth (使用者註冊、登入與 JWT 簽發)              │
│  - Supabase Storage (車輛、工單、改裝實體照片儲存空間)       │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 技術棧 (Technology Stack)

### 行動端 (Mobile)
* **框架與執行環境**：React Native `0.86.3` / Expo SDK 57 (`~57.0.22`)
* **開發語言**：TypeScript (`~6.0.3`)，全專案 `strict: true`
* **狀態與非同步管理**：TanStack React Query (`^5.66.11`)
* **樣式系統**：NativeWind (`^4.1.23`) / Tailwind CSS (`^3.4.17`)
* **本機安全快取**：Expo SecureStore (`~57.0.0`)
* **影像處理**：Expo ImagePicker (`~57.0.17`) / Expo ImageManipulator (`~57.0.17`)

### 後端 (Backend)
* **開發語言**：Go (`1.25.0`)
* **Web 框架 / 路由**：`github.com/go-chi/chi/v5` (`v5.3.2`)
* **CORS 中介軟體**：`github.com/go-chi/cors` (`v1.2.2`)
* **資料庫連線驅動**：`github.com/jackc/pgx/v5` (`v5.11.0`)
* **JWT 解析與驗證**：`github.com/golang-jwt/jwt/v5` (`v5.3.1`)

### 雲端基礎設施 (Cloud Services)
* **運算平台**：Google Cloud Run（部署區域：`asia-east1` 台灣彰化）
* **資料庫**：Supabase PostgreSQL 15
* **使用者身分驗證**：Supabase Auth
* **物件儲存**：Supabase Storage Bucket

---

## 5. 資料模型 (Data Model)

系統由 10 張關聯資料表與 1 個唯讀視圖（View）構成，完整對應車輛生命週期各實體：

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
    └── Modifications
            ├── ModificationPhotos
            └── ModificationSettingSets
                    └── ModificationSettings
```

### 資料表清單

| 資料表名稱 | 說明 | 關鍵限制與外部鍵約束 |
| :--- | :--- | :--- |
| `Vehicles` | 車輛主表 | `user_id -> auth.users`, `current_mileage >= initial_mileage` |
| `VehiclePhotos` | 車輛照片表 | `vehicle_id -> Vehicles (CASCADE)`, 單一封面唯一約束 |
| `Refuels` | 加油紀錄表 | `vehicle_id -> Vehicles (CASCADE)`, `volume > 0`, `total_cost >= 0` |
| `MaintenanceRecords` | 保養與維修表 | `vehicle_id -> Vehicles (CASCADE)`, `record_type IN ('maintenance', 'repair')` |
| `MaintenancePhotos` | 保養維修照片表 | `maintenance_record_id -> MaintenanceRecords (CASCADE)` |
| `Reminders` | 保養週期提醒表 | `vehicle_id -> Vehicles (CASCADE)`, `last_record_id -> SET NULL` |
| `Modifications` | 改裝品檔案表 | `vehicle_id -> Vehicles (CASCADE)`, `category` Enum 列舉 |
| `ModificationPhotos` | 改裝實拍照表 | `modification_id -> Modifications (CASCADE)` |
| `ModificationSettingSets` | 改裝調校版本表 | `modification_id -> Modifications (CASCADE)`, 單一生效版本唯一約束 |
| `ModificationSettings` | 改裝參數細項表 | `setting_set_id -> ModificationSettingSets (CASCADE)` |
| `vehicle_timeline` (View) | 時序動態聚合 View | `WITH (security_invoker = true)` 繼承呼叫者 RLS 權限 |

---

## 6. 資安機制與 RLS (Security & RLS)

系統各層級均落實基於使用者擁有權之存取控制（Ownership-based Access Control）：

### 1. API 層：JWT Bearer 鑑權
* 所有業務路由均掛載 `AuthMiddleware`。
* 解析用戶端傳入之 Supabase Access Token，驗簽成功後將 `user_id` 注入 Request Context；無效或過期憑證立即回應 `401 AUTH_REQUIRED`。

### 2. 資料庫層：PostgreSQL Row Level Security (RLS)
* **全面啟用**：10 張資料表全面開啟 RLS（`ENABLE ROW LEVEL SECURITY`）。
* **階層式遞迴校驗**：
  * **根層表**（`Vehicles`）：直接驗證 `auth.uid() = user_id`。
  * **一級子表**（`Refuels`, `MaintenanceRecords`, `Reminders`, `Modifications`, `VehiclePhotos`）：透過 `EXISTS (SELECT 1 FROM Vehicles WHERE id = ... AND user_id = auth.uid())` 確保歸屬。
  * **二級與三級子表**（`MaintenancePhotos`, `ModificationPhotos`, `ModificationSettingSets`, `ModificationSettings`）：多層 JOIN 向上追溯至車輛主表確認擁有者。
* **View 權限穿透**：`vehicle_timeline` 採用 `security_invoker = true`，禁止透過視圖跨租戶旁路存取。

### 3. 物件儲存層：Supabase Storage Policies
* Storage Bucket 配置擁有權檢查規則，僅車輛擁有者具備上傳、檢視與刪除相片檔案之權限。

---

## 7. 里程權威原則 (Mileage Integrity)

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

---

## 8. 離線快取與同步佇列 (Offline & Sync)

針對停車場地下室或山區網路不穩之現場情境，系統內建以 `expo-secure-store` 為基礎之輕量化離線與排隊同步架構：

```text
Network Monitor (連線感知)
        │
        ▼
React Query onlineManager
        │
        ▼
Persistent Sync Queue (FIFO 佇列)
        ├── PENDING  (等待連線)
        ├── SYNCING  (同步執行中)
        ├── SUCCESS  (成功並覆蓋本地快取)
        └── FAILED   (永久錯誤隔離，不阻塞隊列)
```

### 支援離線寫入之操作 (Offline-Supported Writes)
* 新增加油紀錄 (`addRefuel`)
* 新增純文字保養/維修工單 (`createMaintenanceRecord`)
* 標記完成保養提醒 (`completeReminder`)
* 切換改裝品當前生效調校版本 (`switchCurrentSettingSet`)

### 僅限連線狀態之操作 (Online-Only Operations)
* 相片上傳與刪除（避免本機安全儲存溢位）
* 新增與刪除車輛
* 刪除加油/保養/改裝歷史紀錄
* 複製調校版本 (`cloneSettingSet`)

### 錯誤分級與隔離 (No Head-of-Line Blocking)
* **暫態錯誤（網路逾時、連線中斷）**：標回 `PENDING` 並保留於佇列，進行指數退避重試（最多 3 次）。
* **永久錯誤（4xx 業務驗證失敗、資源已被刪除）**：立即移出活動隊列至 `failedMutations` 隔離儲存，**絕不阻礙後續健康的離線操作同步**，並提供車主手動檢視與清除選項。

---

## 9. 多車輛快取隔離 (Cache Isolation)

為徹底防範多台車輛切換時產生資料覆蓋或快取污染，系統於客戶端落實嚴格的車輛空間隔離：

```text
Vehicle A (ID: 101)
├── QueryKey: ['refuels', 101]
└── SecureStore: DG_CACHE_REFUELS_101

Vehicle B (ID: 202)
├── QueryKey: ['refuels', 202]
└── SecureStore: DG_CACHE_REFUELS_202
```

* **查詢鍵獨立**：React Query Key 嚴格包含 `vehicleId`。
* **儲存分區**：本地持久化鍵值以功能前綴加上車輛 ID（如 `DG_CACHE_MAINT_101`），確保 A 車快取的讀寫與截斷絕不影響 B 車。

---

## 10. 測試與品質驗證 (Testing & QA)

專案具備完整之自動化測試套件與基線檢查：

```text
======================================================================
測試項目                                    測試規模 / 結果
======================================================================
TypeScript Static Typecheck (tsc)          PASS (0 Errors)
Frontend Jest Test Suites (npm test)       PASS (22 Suites / 114 Tests)
Backend Go Test Suites (go test)           PASS (100% Passed)
Android Release APK Build                  PASS (數位車庫_DigitalGarage.apk)
Cloud Run API Health Endpoint              PASS (200 OK)
======================================================================
```

### P1-7 QA 13 大維度審查涵蓋範圍
1. **Database Integrity**：外鍵串聯、唯一約束、檢查約束及觸發器完整性。
2. **RLS / Multi-tenant Security**：跨用戶與跨階層資料隔離驗證。
3. **API Contract / Validation**：400/401/403/404/409 錯誤狀態碼合約與欄位防禦。
4. **Mileage Integrity**：`initial_mileage` 不可變性與 `GREATEST` 原子更新。
5. **Pure Logic / Calculators**：油耗、費用分攤與改裝版本比對之純函式單元測試。
6. **Timeline Deterministic Ordering**：4 級排序規則與購車事件日期防假造。
7. **Cost Analytics**：月度補零、安裝工資歸屬與里程除以零安全回傳 `null`。
8. **Offline / Sync**：離線佇列狀態機、4xx 錯誤隔離與暫態重試。
9. **Network Monitor**：`AppState` 前景喚醒與連線狀態同步。
10. **Photo / Storage**：封面自動轉移與刪除連動。
11. **Android UI / Lifecycle**：虛擬鍵盤推昇與 Modal 重新渲染之狀態保護。
12. **Multi-Vehicle Cache Isolation**：跨車輛快取與查詢鍵完全隔離。
13. **Stress / Boundary Stability**：快照 20 筆上限截斷與記憶體保護。

---

## 11. 重要 QA 發現與工程防禦 (QA Findings)

### ISS-01：離線同步非同步狀態機閃退救援 (Crash Recovery)
* **問題復現**：在行動裝置環境中，若應用程式於發送網路同步時（狀態為 `SYNCING`）遭作業系統強制終止（App killed / OOM），該任務的 `SYNCING` 狀態將永久殘留在本地持久化儲存中。下次啟動時，佇列會因該任務非 `PENDING` 狀態而陷入永久死結。
* **防禦實作**：於開機水合程序（`syncQueue.hydrate()`）加入狀態修復機制：
  $$\text{SYNCING} \xrightarrow{\text{App killed}} \text{hydrate()} \xrightarrow{\text{重置}} \text{PENDING} \xrightarrow{\text{連線恢復}} \text{自動同步成功}$$

### ISS-02：端到端多租戶到前端快取隔離驗證 (Multi-Vehicle Isolation)
* **工程價值**：驗證系統完整的端到端資料隔離路徑：
  $$\text{auth.uid() (DB RLS)} \longrightarrow \text{Vehicles} \longrightarrow \text{vehicle\_id (API 擁有權)} \longrightarrow \text{QueryKey / DG\_CACHE\_* (Client 隔離)}$$
  確認無論在資料庫層、API 授權層或用戶端 SecureStore 分區儲存中，不同車輛的紀錄與快照絕不交叉洩漏或覆蓋。

### ISS-03：工單表單重繪之使用者狀態保持 (Modal State Preservation)
* **問題描述**：`AddMaintenanceModal` 在父層組件觸發背景更新或重新渲染時，容易導致表單內部狀態被預設屬性重置。
* **防禦實作**：使用 `prevVisibleRef` 偵測 `visible` 由關閉轉為開啟的瞬間，僅在開啟時載入預設值；彈窗開啟期間的父層重繪絕不覆寫車主手動切換之「保養 / 維修（`recordType`）」選擇。

---

## 12. 建置與執行 (Build & Run)

### 前置需求
* Node.js `>= 18.0.0`
* Go `>= 1.24`
* Android Studio 與 Android SDK（用於 Android 實機/模擬器除錯）

### 行動端前端 (Frontend)
```bash
# 1. 安裝相依套件
npm install

# 2. 執行 TypeScript 靜態型別檢查
npm run typecheck

# 3. 執行全量 Jest 單元與整合測試
npm test -- --watchAll=false

# 4. 啟動 Expo 本地開發伺服器
npm run start
```

### 後端 API 服務 (Backend)
```bash
# 1. 進入後端目錄
cd backend

# 2. 執行全量 Go 單元測試
go test -v ./... -count=1

# 3. 啟動本地 API 伺服器
go run cmd/api/main.go
```

---

## 13. Android Release 建置 (Android Build)

專案已完成 Android 原生專案配置，並成功產出簽署之生產環境 Release APK：

* **檔案名稱**：`數位車庫_DigitalGarage.apk`
* **檔案大小**：`82.00 MB`
* **組件結構**：
  * 包含已編譯之 `AndroidManifest.xml`
  * 包含原生執行檔 `classes.dex`
  * 包含打包之 React Native JavaScript Bundle（`assets/index.android.bundle`）
  * 包含 64 位元原生架構函式庫（`lib/arm64-v8a`）

---

## 14. 雲端部署現況 (Deployment)

| 元件 | 雲端服務商 / 平台 | 部署配置與端點 |
| :--- | :--- | :--- |
| **API 後端** | Google Cloud Run | 區域：`asia-east1` (台灣)<br>端點：`https://digital-garage-api-997244262524.asia-east1.run.app` |
| **資料庫** | Supabase Cloud | PostgreSQL 15，含 10 大業務資料表與完整 RLS |
| **使用者驗證** | Supabase Auth | 發行 JWT Bearer Token |
| **媒體儲存** | Supabase Storage | 存放車輛、工單、改裝實體照片 |

---

## 15. 開發進度與狀態 (Project Status)

目前專案已完成 P0 至 P1-7 之全部功能開發與品質驗收：

| 階段代號 | 範疇定義 | 驗收狀態 |
| :--- | :--- | :---: |
| **P0** | Backend Stability (Go API 服務基礎與 JWT 認證) | ✅ Completed |
| **P1-1** | Vehicle Lifecycle (車輛核心模型與入庫里程保護) | ✅ Completed |
| **P1-2** | Cost Analytics (多維度月度成本分析與 TCO 運算) | ✅ Completed |
| **P1-3** | UI / UX + Information Architecture (車輛座艙 6 大模組分頁架構) | ✅ Completed |
| **P1-4** | Modification Setting Version Comparison (改裝調校版本控制與差異比較) | ✅ Completed |
| **P1-5** | Timeline (全生命週期動態時序牆與 4 級確定性排序) | ✅ Completed |
| **P1-6** | Offline / Sync Architecture (輕量化離線快取與 FIFO 突變佇列) | ✅ Completed |
| **P1-7** | Stability / QA (全系統 13 大維度生產級穩定性驗收) | ✅ Completed |

---

## 16. 已知限制 (Known Limitations)

為客觀呈現目前系統設計邊界，列出已確認之系統限制：

1. **離線快取與佇列容量邊界**：
   本地快照與待同步佇列設有單項 20 筆之快照截斷上限（`sliceSnapshot(items, 20)`）。此為保護本機 SecureStore 儲存空間與防止大量資料拖垮啟動速度之**設計邊界**，並非無上限的離線資料庫。
2. **照片檔案不支援離線隊列暫存**：
   考量行動裝置暫存空間與上傳穩定度，相片檔案（工單實拍、改裝照片）需在連線狀態下直接上傳至雲端 Storage，不進入離線文字佇列。
3. **線上監控與大規模浸泡測試邊界**：
   目前尚未整合第三方 APM / 崩潰回報 SDK（如 Firebase Crashlytics、Sentry），亦未實施生產環境大規模高併發浸泡測試（Soak Testing）。

---

## 17. 工程實踐原則 (Engineering Notes)

* **Server-Authoritative**：以伺服器端資料庫計算作為唯一的權威依據，前端不私自維護第二套業務計算規則。
* **DB-Level Integrity**：依賴資料庫的外鍵、Check 約束、Partial Unique Index 與觸發器防護資料一致性。
* **Ownership Isolation**：自資料庫 RLS、後端 API 擁有權檢查至前端 CacheKey，全面落實多租戶隔離。
* **Resilient State Machine**：在離線與非同步同步情境中，充分考量行動裝置生命週期中斷（App killed）、4xx 永久錯誤隔離防堵隊列停滯、與自動連線偵測。
