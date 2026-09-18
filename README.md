# Digital Garage｜數位車庫

> **一支手機就是一座數位車庫。以單一車輛為生命週期主體的愛車履歷、改裝調校與車況管理系統。**

[![React Native](https://img.shields.io/badge/React%20Native-0.86.3-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-57.0.22-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![Go](https://img.shields.io/badge/Go-1.26-00ADD8?logo=go&logoColor=white)](https://golang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Google Cloud Run](https://img.shields.io/badge/Cloud%20Run-us--central1-4285F4?logo=googlecloud&logoColor=white)](https://cloud.google.com/run)
[![Tests](https://img.shields.io/badge/Tests-152%2F152%20Pass-brightgreen)](./documentation/testing-and-qa.md)

---

## 系統整體架構 (System Architecture)

```text
┌────────────────────────────────────────────────────────────────────────┐
│               Digital Garage Mobile App (React Native / Expo)          │
│  - Navigation: Expo Router / Bottom Tabs / Modals                      │
│  - State: TanStack Query v5 (Optimistic Updates / Cache Invalidation)  │
│  - Storage: expo-secure-store (Offline Snapshot & FIFO Mutation Queue) │
│  - UI: NativeWind (Tailwind CSS) Dark-Metal Racing Aesthetic           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS (Bearer JWT / X-Request-ID)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             Go Backend API (Google Cloud Run `us-central1`)            │
│  - Routing: chi v5 + CORS Middleware + RequestID Correlation           │
│  - Auth: JWT Bearer Verification (RS256 / HS256)                       │
│  - Logging: Google Cloud Logging JSON Structured Logs (PII Redacted)   │
│  - Pool: pgxpool (Direct Connection with Atomic Transactions)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ PostgreSQL Wire Protocol
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Supabase Cloud Managed Infrastructure                    │
│  - Database: PostgreSQL 15 (11 Tables, Partial Unique Indexes, Triggers)│
│  - Views: vehicle_timeline (Security Invoker, 6-Union Type-Aligned)    │
│  - Security: Row Level Security (RLS 3-Tier Multi-Tenant Isolation)   │
│  - Media: Supabase Storage Bucket (vehicle-media)                      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 技術文檔模組索引 (Documentation Index)

專案技術文檔採模組化拆分管理，完整收錄於 [`/documentation`](./documentation/) 目錄下：

* 📘 **[產品概述與設計理念 (Project Overview)](./project-overview.md)**：產品核心願景、目標族群、使用者痛點與生命週期時序架構。
* 🚗 **[核心業務規格 (Features Specification)](./documentation/features.md)**：油耗運算、保養維修履歷、改裝調校比對、週期規費與台灣法規排程。
* 🏗️ **[系統架構與技術棧 (Architecture)](./documentation/architecture.md)**：分層架構、離線突變佇列、多車快取隔離與技術依賴清單。
* 🗄️ **[資料模型與里程權威 (Data Model)](./documentation/data-model.md)**：11 張關聯資料表、時序動態 View、伺服器唯一里程權威（`GREATEST` 原子更新）。
* 🔒 **[資訊安全與存取控制 (Security & RLS)](./documentation/security-and-rls.md)**：JWT 鑑權、PostgreSQL 1~3 階層 RLS 隔離政策、Storage 安全防護。
* 📊 **[可觀測性與維運防護 (Observability & Ops)](./documentation/observability-and-operations.md)**：Request Correlation ID、Google Cloud Logging、機敏脫敏與前端全域錯誤邊界。
* ✅ **[測試品質、建置與部署 (QA & Deployment)](./documentation/testing-and-qa.md)**：15 大 QA 維度審查、ISS 故障防禦歷程、APK 打包與 Cloud Run 部署現況。

---

## 核心功能與工程亮點 (Key Highlights)

### 1. 法規對齊與雙軌日期分流 (P2-2.6)
* **行照出廠年月 (`manufacture_date`)**：採用純前端 Dark-Metal 3x4 月份矩陣選擇器（`mode="month"`，輸出 `YYYY-MM`），自動解析西元年份，專門做為車齡推估與定檢頻率依據。
* **行照原發照日 (`registration_date`)**：採用標準日曆選擇器（`mode="date"`，格式 `YYYY-MM-DD`），做為台灣監理法定定期檢驗的基準日。
* **智慧定檢視窗推算**：依原發照日的月日推算前後各 1 個月（共 2 個月）驗車視窗，落實月底夾取防溢位（Month Clamping），並提供 Fallback 容錯降級機制與防誤觸覆寫警示對話框。

### 2. 伺服器端唯一里程權威 (Server-Authoritative Mileage)
* 車輛主表 `current_mileage` 由資料庫層級強制約束 `current_mileage >= initial_mileage`。
* 每次新增加油、保修、改裝時，後端於單一原子交易內透過 `GREATEST` 自動推昇當前里程，嚴防人為回滾與篡改。

### 3. 全生命週期動態時序牆 (Vehicle Lifecycle Timeline)
* 透過 PostgreSQL View（`vehicle_timeline`）以型別安全（Type-Aligned）整合購車入庫、加油、保養、維修、改裝與週期規費事件。
* 實施 4 級確定性排序（`event_date DESC`, `mileage DESC NULLS LAST`, `created_at DESC`, `event_id DESC`），消除分頁跳動。

### 4. 改裝品版本控制與參數差異比對 (Modification Version Control)
* 單一改裝品支援多組調校版本（如：日常街道、山路熱血、賽道競技），由資料庫 Partial Unique Index 確保單一生效版本。
* 具備原子深度拷貝（Clone Snapshot）與智慧遞補機制，提供 Map-based Union 演算法精確視覺化比對參數異動。

### 5. 離線突變佇列與自動協調 (Offline Mutation Queue)
* 內建網路狀態即時感知監聽，離線時請求自動沉澱至 FIFO 佇列，恢復連線後依序重放。
* 具備 4xx 永久客戶端錯誤隔離（防止阻斷佇列）與 App 冷啟動未決狀態修復。

### 6. 雲端零流量費架構 (Cloud Run `us-central1`)
* 後端 API 全面部署於 Google Cloud Run `us-central1` 區域，與 Supabase 雲端資料庫保持同區/最優路徑傳輸，消除跨區網路流量衍生費用。

### 7. 伺服器狀態與無感延遲監測 (Server Status & Piggyback Latency Monitor - P2-2.7)
* **零成本附帶測速 (Zero-Cost Piggyback)**：完全捨棄背景輪詢（No Polling），不產生額外 Cloud Run vCPU 與網路流量計費；透過前端網路攔截層於使用者正常業務操作時附帶測量真實 RTT 往返延遲。
* **極簡 HTTP 204 HEAD 探活**：提供手動點擊即時刷新機制，後端回傳零 Payload 的 HTTP 204 No Content，極致輕量無負擔。
* **Dark-Metal 狀態膠囊**：首頁座艙即時呈現伺服器連線狀態（在線/離線）、真實延遲毫秒（ms）與部署節點（`us-central1`），具備綠/黃/紅三段式健康色階與網路中斷自適應。

---

## 核心技術棧 (Tech Stack)

| 領域 | 技術 / 工具 | 版本 | 核心用途 |
| :--- | :--- | :--- | :--- |
| **前端框架** | React Native | `0.86.3` | 原生跨平台應用程式核心 |
| **應用平台** | Expo SDK | `57.0.22` | 原生構建、字型、安全儲存、相機整合 |
| **樣式系統** | NativeWind / Tailwind CSS | `4.1.23` | Dark-Metal 賽車氛圍沉浸式設計 |
| **狀態管理** | TanStack React Query | `5.66.11` | 伺服器端狀態快取、樂觀更新與失效協調 |
| **後端語言** | Go (Golang) | `1.26` | 高效能輕量後端微服務 |
| **路由框架** | go-chi / chi | `v5.3.2` | 輕量化 RESTful API 路由分發 |
| **資料庫連線** | jackc / pgx | `v5.11.0` | 高併發 PostgreSQL 連線池與交易控制 |
| **資料庫** | PostgreSQL (Supabase) | `15` | 11 張實體關聯表、動態時序 View 與 RLS |
| **雲端運算** | Google Cloud Run | `us-central1` | Serverless 容器託管（極小化 Distroless 鏡像） |

---

## 雲端部署現況 (Cloud Deployment)

| 元件 | 雲端服務商 / 平台 | 部署配置與端點 |
| :--- | :--- | :--- |
| **API 後端** | Google Cloud Run | 區域：`us-central1` (美國中部，零跨區流量費)<br>端點：`https://digital-garage-api-997244262524.us-central1.run.app/api/v1`<br>健康端點：`GET /api/v1/health` (200 OK) |
| **雲端資料庫** | Supabase Cloud | PostgreSQL 15，含 11 大業務資料表、時序 View 與完整 RLS |
| **使用者驗證** | Supabase Auth | 發行 JWT Bearer Token |
| **媒體儲存** | Supabase Storage | 儲存車輛外觀相片、工單單據與改裝實照 |

---

## 開發進度里程碑 (Milestones)

| 階段代號 | 核心範疇定義 | 驗收狀態 |
| :--- | :--- | :---: |
| **P0** | Backend Stability (Go API 服務基礎、JWT 鑑權、pgx 連線池) | ✅ Completed |
| **P1-1** | Vehicle Lifecycle (車輛核心模型與入庫初始里程約束) | ✅ Completed |
| **P1-2** | Cost Analytics (多維度月度成本分析與車輛 TCO 運算) | ✅ Completed |
| **P1-3** | UI / UX + Architecture (座艙 6 大模組分頁架構與 DoubleBezelCard) | ✅ Completed |
| **P1-4** | Modification Settings (改裝調校版本控制、深拷貝與差異比對) | ✅ Completed |
| **P1-5** | Timeline (全生命週期動態時序牆與 4 級確定性排序) | ✅ Completed |
| **P1-6** | Offline / Sync (輕量化離線快取、FIFO 突變佇列與 4xx 隔離) | ✅ Completed |
| **P1-7** | Stability / QA (全系統 13 大維度生產級穩定性驗收) | ✅ Completed |
| **P2-1** | Observability & Ops (Request ID 鏈路串聯、Cloud Logging 脫敏日誌) | ✅ Completed |
| **P2-2** | Recurring Expenses (出廠日連動、公路養管費正名、台灣排程預填) | ✅ Completed |
| **P2-2.5** | Global DatePicker (全域 Dark-Metal 日期選擇器、出廠年份解析) | ✅ Completed |
| **P2-2.6** | Statutory Alignment (原發照日 YYYY-MM-DD 與出廠年月 YYYY-MM 雙軌對齊、定檢推算、Cloud Run 部署至 us-central1) | ✅ Completed |
| **P2-2.7** | Server Status & Latency Monitor (零成本附帶測速、極簡 HEAD 204 探活、Dark-Metal 狀態膠囊與節點可觀測性) | ✅ Completed |

---

## 本地開發與測試 (Local Development & Testing)

### 1. 行動端前端 (Mobile App)

```bash
# 安裝依賴
npm install

# 執行靜態型別檢查
npm run typecheck

# 執行 Jest 單元測試套件 (26 Suites / 152 Tests)
npm test -- --watchAll=false

# 啟動 Expo 本地開發伺服器
npm run start
```

### 2. 後端 API 服務 (Backend API)

```bash
cd backend

# 執行 Go 單元測試
go test -v ./... -count=1

# 本地啟動 Go 服務
go run cmd/api/main.go
```

---

## Android Release APK 建置與安裝 (Build APK)

由於 Windows 環境下路徑長度與特殊字元保護，Android 原生建置建議透過磁碟代號映射進行：

```powershell
# 1. 將專案根目錄映射為虛擬磁碟 X:
subst X: "e:\數位車庫 (Digital Garage)"

# 2. 切換至 X: 磁碟執行 Gradle 打包
cd /d X:\android
.\gradlew.bat assembleRelease

# 3. 建置完成後解除磁碟映射
subst X: /d
```

### 產出發布安裝包
* **專案根目錄直接存取**：
  * `數位車庫_DigitalGarage.apk`（約 `82.1 MB`）
  * `app-release.apk`（約 `82.1 MB`）
* **Gradle 原始建置路徑**：`android/app/build/outputs/apk/release/app-release.apk`
* **封裝架構**：整合 `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64` 原生函式庫
* **安裝方式**：可直接傳輸至 Android 手機點擊安裝，或透過 ADB 安裝：
  ```bash
  adb install -r 數位車庫_DigitalGarage.apk
  ```

---

## 授權條款 (License)

本專案採用客製化私有軟體許可，版權所有 © 2026 Digital Garage Team。
