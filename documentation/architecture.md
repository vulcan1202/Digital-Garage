# 系統分層架構與技術棧 (Architecture & Tech Stack)

---

## 1. 系統分層架構 (System Architecture)

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
│  - PostgreSQL 15 (11 大業務資料表、時序 View、Check 限制)   │
│  - Row Level Security (RLS 1-tier ~ 3-tier 擁有權隔離)      │
│  - Supabase Auth (使用者註冊、登入與 JWT 簽發)              │
│  - Supabase Storage (車輛、工單、改裝實體照片儲存空間)       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 技術棧版本與相依性 (Technology Stack)

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
* **運算平台**：Google Cloud Run（部署區域：`us-central1` 美國中部）
* **資料庫**：Supabase PostgreSQL 15
* **使用者身分驗證**：Supabase Auth
* **物件儲存**：Supabase Storage Bucket

---

## 3. 離線快取與同步佇列 (Offline Cache & Sync Queue)

針對地下停車場或山區網路不穩之現場情境，系統內建以 `expo-secure-store` 為基礎之輕量化離線與排隊同步架構：

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

### 錯誤分級與隔離機制 (No Head-of-Line Blocking)
* **暫態錯誤（網路逾時、連線中斷）**：標回 `PENDING` 並保留於佇列，進行指數退避重試（最多 3 次）。
* **永久錯誤（4xx 業務驗證失敗、資源已被刪除）**：立即移出活動隊列至 `failedMutations` 隔離儲存，**絕不阻礙後續健康的離線操作同步**，並提供車主手動檢視與清除選項。

---

## 4. 多車輛快取隔離機制 (Multi-Vehicle Cache Isolation)

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

## 5. 全域 i18n 國際化架構 (Global i18n Architecture - P2-2.8)

為落實純展示層改造且維持 100% 型別約束，系統建構完整的 i18n 運作管道：

```text
┌────────────────────────────────────────────────────────┐
│             Single JSON Locales (zh-TW & en-US)        │
│  - Symmetric Keys / Strict No-Empty Leaves             │
│  - Interpolation tokens: {{count}}, {{cost}}           │
└──────────────────────────┬─────────────────────────────┘
                           │ TypeScript Leaves<T, D>
                           ▼
┌────────────────────────────────────────────────────────┐
│                 Compile-time Type Safety               │
│  - CustomTypeOptions & TranslationKey IntelliSense     │
│  - Safe getEnglishText(key, options) Helper            │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│             LanguageContext & Provider (App Root)      │
│  - expo-secure-store (DG_USER_LANGUAGE, BILINGUAL)     │
│  - isHydrated Gate: 避免首屏語系跳轉與閃爍             │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│               Presentation Layer Components            │
│  - BilingualText (5-Case Decision Matrix)              │
│  - LanguageSwitcher ([ 繁中 | EN ] with hitSlop)       │
└────────────────────────────────────────────────────────┘
```

* **表現層隔離原則**：後端與資料庫儲存純粹使用者業務資料，前端不更動資料庫 Schema，亦不對使用者自行輸入的車名、改裝品名或備註進行翻譯，確保車輛數位履歷原始真實。
* **深度型別推導**：排除物件與陣列，只推導字串葉節點，產生如 `"recurring.labels.inspection"` 的完整字串聯集，在呼叫 `t(...)` 或 `<BilingualText translationKey="..." />` 時獲得即時程式碼補齊與型別校驗。

