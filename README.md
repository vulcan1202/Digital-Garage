# Digital Garage｜數位車庫

> **一支手機就是一座數位車庫。以單一車輛為生命週期主體的愛車履歷、改裝調校與車況管理系統。**

[![React Native](https://img.shields.io/badge/React%20Native-0.86.3-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-57.0.22-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![Version](https://img.shields.io/badge/Version-v1.1.1-orange)](./package.json)
[![Go](https://img.shields.io/badge/Go-1.26-00ADD8?logo=go&logoColor=white)](https://golang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Google Cloud Run](https://img.shields.io/badge/Cloud%20Run-us--central1-4285F4?logo=googlecloud&logoColor=white)](https://cloud.google.com/run)
[![Tests](https://img.shields.io/badge/Tests-193%2F193%20Pass-brightgreen)](./documentation/testing-and-qa.md)

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

### 1. 法規對齊與定期檢驗實務體驗重構 (P2-2.6 & P2-2.9)
* **雙軌日期分流**：行照出廠年月（`manufacture_date` YYYY-MM）作為車齡推估依據；行照原發照日（`registration_date` YYYY-MM-DD）作為法定定檢基準日。
* **簡化填寫與寬限期自動推算**：車主僅需填寫「此次檢驗日」（實際受檢日）與「下次定檢日」（行照印章日期），系統自動以下次定檢日推算前後各 1 個月（`±1 個月`）法定寬限期，徹底解決驗畢當場過期或數週後誤報 `OVERDUE` 的問題。
* **寬限期前後月雙階即時提示**：寬限期前一個月標籤顯示黃色「可驗車」，後一個月改為紅色警告「需要驗車」；未到期顯示綠色「合格」，逾期顯示紅色「逾期未驗」。
* **汽機車統一定檢標題**：移除「排氣」字樣，汽機車（含黃紅牌大型重型機車）一律統一預設為「{{年份}}年 定期檢驗」。
* **首檢預警與資料不全引導**：車齡 4 年（即將邁入第 5 年首檢）提供「首檢即將到來」預警；無登記發照日則標記「資料不全」，待首次驗車登記後啟動通知。

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

### 8. 全域 i18n 雙語切換與雙語並陳 (Global i18n & Bilingual Presentation - P2-2.8)
* **單一結構化字典與型別推導**：繁體中文 (`zh-TW.json`) 與美式英文 (`en-US.json`) 100% 鍵值結構對稱，以 TypeScript `Leaves<T, D>` 深度推導排除物件與陣列葉節點，實現編譯期強型別 IntelliSense 與零 `any`。
* **Zero-Flash 開機水合門禁**：透過 `expo-secure-store` 安全持久化語系與雙語開關，於 App Root 設置 `LanguageProvider` 水合閘門，徹底杜絕啟動畫面閃爍。
* **BilingualText 5 大決策矩陣**：核心 KPI 卡片與動態時序徽章支援繁中主標題＋英文副標題；英文模式下智慧消除重複副標題；其他互動元件與表單彈窗無縫雙語即時切換。
* **原生無障礙切換器**：頂部膠囊切換鈕 `[ 繁中 | EN ]` 具備 60fps 流暢平移微彈力膠囊動畫、Dark-Metal 防溢位圓角設計、觸感微縮放反饋與符合人體工學之 `hitSlop` 與 TalkBack/a11y 標籤。

### 9. 牌照稅與公路養管費年度徵收實務體驗 (Annual Taxes & Fees Refinement - P2-2.10)
* **狀態文字統一移除「本年度」贅字**：卡片狀態徽章精準聚焦於「已繳清」（綠）、「尚未繳清」（灰）、「待繳清」（黃，開徵中計入 DUE SOON）、「逾期未繳」（紅，已逾期計入 OVERDUE），結清描述小字簡化為「稅費已結清」。
* **固定規費專屬「僅限本年度」標籤**：牌照稅與公路養管費項目名稱右側標註「僅限本年度」提示標籤，清楚傳遞固定規費僅記錄當年度徵收狀況，與跨年之定檢及保險做直覺區隔。
* **完全無日期化展示**：固定規費卡片徹底移除生硬的截止日（YYYY-MM-DD）、繳納完成日及剩餘天數倒數，保持視覺極簡。
* **月份自適應時程小字**：依當前月份自動切換（「將於四/七月徵收」->「四/七月徵收中」->「已逾四/七月徵收期」）。
* **營業用車額外提示**：列表底部獨立小字標示「* 規費時程以自用車為準，營業用車依監理通知為準」。

### 10. 介面佈局防溢位、提醒雙次分頁與車輛防呆架構 (UI Refinement & Vehicle Safety - P2-2.11)
* **頂部 Header 防溢位與狀態膠囊精簡**：座艙標題增加 `flex-1 min-w-0` 與單行截斷；連線狀態精簡為「在線」/「離線」（英文「Online」/「Offline」）；狀態膠囊排版微調，按鈕集群 `flex-shrink-0 gap-1.5`，徹底杜絕多語系寬度超出畫面問題。
* **快捷發送列全域雙語支援**：+加油、+保養、+維修、+改裝、+提醒 5 個捷徑按鈕全數接入 i18n 字典，英文模式自動呈現 `+Fuel`、`+Service`、`+Repair`、`+Tuning`、`+Alert`。
* **座艙 6 大分頁橫向流暢滑動**：升級為 `ScrollView horizontal`，解決英文標籤長度造成的最後一項折行跑版問題。
* **提醒分頁重構雙次分頁（Sub-tabs）**：
  - **規費⚠️ / 規費✅**：法定規費（牌照稅、汽燃費、定檢、保險）專屬次分頁，消除數字計數，以 ⚠️ / ✅ 清晰傳達合規狀態，與保養雷達徹底隔離。
  - **維護提醒 ({{count}})**：原 MAINTENANCE RADAR 正名為「維護提醒」，獨立呈現各項目定程定時保養雷達與計數。
* **愛車管理多層防呆機制**：
  - 「編輯愛車」直接配置於車庫車隊的愛車卡片右上角，便於直覺管理。
  - 主畫面座艙抬頭移除紅色刪除按鈕；車輛刪除收納於編輯彈窗底部，並具備 SQL 級聯刪除二次確認對話框。

### 11. 保養維修單據多項目獨立輸入與即時合計總價 (Multi-Item Service Order & Live Total - P2-2.12)
* **單一工單動態多項目擴充**：支援車主在單張保修工單下動態點擊「＋ 新增施作項目」，每一列具備獨立之「項目名稱」與「NT$ 個別金額」輸入欄位；大於 1 筆時提供垃圾桶刪除。
* **即時總金額看板 (Live Total Cost)**：介面即時響應有效項目之金額累計（`NT$ X,XXX`），方便比對保養廠紙本或電子工單總價。
* **共用工單基礎屬性**：施作日期、施作里程、保養廠、備註與工單/發票照片全單共用，避免重複輸入。
* **嚴格正規金額驗證純函式**：採用正則 `/^\d+(\.\d+)?$/` 進行全字串完整匹配，嚴格杜絕 `2000abc`、負數、`NaN` 等非法字元。
* **部分成功（Partial Success）防重複機制**：批次寫入若中途發生單筆失敗，系統自動從表單中移除已成功的項目，僅保留失敗的項目供車主修正重試，徹底防止重複提交。
* **離線相片安全防護與提醒獨立容錯**：離線時主動提示相片限制並支援僅文字同步，避免相片無聲遺失；首筆失敗時照片動態順延歸屬於次筆成功項目；提醒失敗不回滾工單紀錄。

### 12. 規費保險生命週期補齊與總覽版面最佳化 (Expense Lifecycle & Dashboard Optimization - P2-2.13)
* **規費與保險紀錄編輯 (Update) 補齊**：新增 `EditRecurringExpenseModal`，支援完整修改規費/定檢/保險之類別、名稱、金額、繳費日、有效涵蓋起訖日與備註；具備起訖日防呆與金額非負數檢驗，送出時鎖定按鈕防止連點重複寫入。
* **週期規費紀錄刪除 (Delete) 與原生防呆確認**：狀態卡片右側支援垃圾桶刪除操作，點擊跳出原生二次確認對話框，刪除後自動連動使快取失效並刷新車籍時序與總體費用統計。
* **愛車時序牆（Timeline）無縫編輯整合**：時序牆規費項目直接掛載編輯入口，精準依據 `item.event_id` 與快取/API 查找真實紀錄，嚴禁使用假資料覆蓋真實資料，查無資料時防呆提示阻擋。
* **總覽儀表（Overview）保險提醒雷達移除**：徹底清除總覽頁面下方重複之保險提醒雷達區塊與 4 個 dead props，回歸簡潔之車輛運營成本與能耗關鍵數據看板。

---

## 核心技術棧 (Tech Stack)

| 領域 | 技術 / 工具 | 版本 | 核心用途 |
| :--- | :--- | :--- | :--- |
| **前端框架** | React Native | `0.86.3` | 原生跨平台應用程式核心 (Fabric New Architecture) |
| **應用平台** | Expo SDK | `57.0.22` | 原生構建、字型、安全儲存、相機整合 |
| **樣式系統** | NativeWind / Tailwind CSS | `4.1.23` | Dark-Metal 賽車氛圍沉浸式設計 |
| **國際化架構** | i18next / react-i18next | `^24.2.3 / ^15.7.4` | 全域多語系解析、雙語並陳與參數動態插值 |
| **動畫與工作線程** | react-native-worklets | `^0.10.1` | Reanimated 4.x / Fabric 原生 Worklet 編譯支援 |
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
| **P2-2.8** | Global i18n & Bilingual Presentation (全域 i18n 繁中/英文切換、BilingualText 雙語並陳、Zero-Flash 開機水合門禁、單一結構化字典、158/158 單元測試通過) | ✅ Completed |
| **P2-2.9** | Inspection UX & Grace Period Enhancement (定期檢驗實務體驗重構、下次定檢日推算、寬限期前後月雙階提示、汽機車統一定檢標題、160/160 單元測試通過) | ✅ Completed |
| **P2-2.10** | Annual Taxes & Fees Refinement (牌照稅與養管費年度徵收實務微調、統一移除「本年度」贅字、固定規費提示「僅限本年度」、月份自適應時程、無日期化卡片設計、營業用車獨立備註) | ✅ Completed |
| **P2-2.11** | UI Refinement & Vehicle Safety (頂部 Header 防溢位、快捷列雙語切換、提醒雙次分頁、愛車防呆管理升級) | ✅ Completed |
| **P2-2.12** | Multi-Item Maintenance & Live Total (保養與維修多項目獨立輸入、個別金額、即時總計、嚴格正則校驗、部分成功防重複、181/181 測試通過) | ✅ Completed |

---

## 本地開發與測試 (Local Development & Testing)

### 1. 行動端前端 (Mobile App)

```bash
# 安裝依賴
npm install

# 執行靜態型別檢查
npm run typecheck

# 執行 Jest 單元測試套件 (29 Suites / 181 Tests)
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
  * `數位車庫_DigitalGarage.apk`（約 `82.2 MB`）
  * `DigitalGarage-Release.apk`（約 `82.2 MB`）
  * `app-release.apk`（約 `82.2 MB`）
* **Gradle 原始建置路徑**：`android/app/build/outputs/apk/release/app-release.apk`
* **封裝架構**：整合 `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64` 原生函式庫
* **安裝方式**：可直接傳輸至 Android 手機點擊安裝，或透過 ADB 安裝：
  ```bash
  adb install -r 數位車庫_DigitalGarage.apk
  ```

---

## 授權條款 (License)

本專案採用客製化私有軟體許可，版權所有 © 2026 Digital Garage Team。
