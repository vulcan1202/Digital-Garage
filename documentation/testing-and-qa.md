# 測試品質、建置維運與工程規範 (QA, Deployment & Engineering)

---

## 1. 測試與品質驗證 (Testing & Verification Matrix)

專案具備完整之自動化測試套件與基線檢查：

```text
======================================================================
測試項目                                    測試規模 / 結果
======================================================================
TypeScript Static Typecheck (tsc)          PASS (0 Errors, 全專案型別零錯誤)
Frontend Jest Test Suites (npm test)       PASS (26 Suites / 152 Tests 全數通過)
Backend Go Test Suites (go test)           PASS (100% Passed)
Android Release APK Build                  PASS (數位車庫_DigitalGarage.apk, 82.08 MB)
Cloud Run API Health Endpoint              PASS (GET 200 OK / HEAD 204 No Content)
======================================================================
```

### P1-7 & P2-2 & P2-2.5 & P2-2.7 QA 16 大維度審查涵蓋範圍
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
14. **Recurring Expenses & Month Clamping**：規費生命週期、智慧預填、出廠日交易連動與月末天數防溢位截斷。
15. **Global DatePicker & Vehicle Date Sync**：Dark-Metal 日期挑選器封裝、出廠年份自動解析、西元前導補零與未來日期防護邊界。
16. **Server Status & Piggyback Latency**：零輪詢附帶測速、極簡 HEAD 204 探活、即時 RTT 延遲計算與網路中斷離線自適應。

---

## 2. 重要 QA 發現與工程防禦 (QA Findings & Defensive Architecture)

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

## 3. 建置與執行 (Build & Run)

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

## 4. Android Release 建置 (Android Build)

專案已完成 Android 原生專案配置，並成功產出簽署之生產環境 Release APK：

* **檔案名稱**：`數位車庫_DigitalGarage.apk`
* **檔案大小**：`82.08 MB`
* **組件結構**：
  * 包含已編譯之 `AndroidManifest.xml`
  * 包含原生執行檔 `classes.dex`
  * 包含打包之 React Native JavaScript Bundle（`assets/index.android.bundle`）
  * 包含 64 位元原生架構函式庫（`lib/arm64-v8a`）

---

## 5. 雲端部署現況 (Cloud Deployment)

| 元件 | 雲端服務商 / 平台 | 部署配置與端點 |
| :--- | :--- | :--- |
| **API 後端** | Google Cloud Run | 區域：`us-central1` (美國中部，零跨區網路流量費)<br>端點：`https://digital-garage-api-997244262524.us-central1.run.app` |
| **資料庫** | Supabase Cloud | PostgreSQL 15，含 11 大業務資料表、時序 View 與完整 RLS |
| **使用者驗證** | Supabase Auth | 發行 JWT Bearer Token |
| **媒體儲存** | Supabase Storage | 存放車輛、工單、改裝實體照片 |

---

## 6. 開發進度與狀態 (Project Status)

目前專案已完成 P0 至 P2-2.6 之全部功能開發與品質驗收：

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
| **P2-1** | Observability & Operations (端到端 Request ID 串聯、Cloud Logging 結構化日誌、敏感脫敏、前端 ErrorReporter 與 ErrorBoundary) | ✅ Completed |
| **P2-2** | Recurring Expenses & Compliance (出廠日連動、公路養管費正名、台灣監理智慧預填) | ✅ Completed |
| **P2-2.5** | Global DatePicker & Vehicle Date Sync (全域 Dark-Metal 日期選擇器封裝、出廠年份自動解析、全表單手動日期全面升級) | ✅ Completed |
| **P2-2.6** | Statutory Registration Date Alignment (原發照日 YYYY-MM-DD 與出廠年月 YYYY-MM 雙軌法規對齊、定檢視窗推算、覆寫安全防護、部署遷移至 us-central1) | ✅ Completed |

---

## 7. 已知限制 (Known Limitations)

為客觀呈現目前系統設計邊界，列出已確認之系統限制：

1. **離線快取與佇列容量邊界**：
   本地快照與待同步佇列設有單項 20 筆之快照截斷上限（`sliceSnapshot(items, 20)`）。此為保護本機 SecureStore 儲存空間與防止大量資料拖垮啟動速度之**設計邊界**，並非無上限的離線資料庫。
2. **照片檔案不支援離線隊列暫存**：
   考量行動裝置暫存空間與上傳穩定度，相片檔案（工單實拍、改裝照片）需在連線狀態下直接上傳至雲端 Storage，不進入離線文字佇列。
3. **線上監控與大規模浸泡測試邊界**：
   系統已具備內部零相依之 Sentry-compatible `ErrorReporter` 與 Google Cloud Logging 結構化日誌。整合第三方 APM 原生 Native SDK（如 Firebase Crashlytics、Sentry Native SDK）與大規模高併發浸泡測試（Soak Testing）保留為未來維運階段之擴充選項。

---

## 8. 工程實踐原則 (Engineering Notes)

* **Server-Authoritative**：以伺服器端資料庫計算作為唯一的權威依據，前端不私自維護第二套業務計算規則。
* **DB-Level Integrity**：依賴資料庫的外鍵、Check 約束、Partial Unique Index 與觸發器防護資料一致性。
* **Ownership Isolation**：自資料庫 RLS、後端 API 擁有權檢查至前端 CacheKey，全面落實多租戶隔離。
* **Resilient State Machine**：在離線與非同步同步情境中，充分考量行動裝置生命週期中斷（App killed）、4xx 永久錯誤隔離防堵隊列停滯、與自動連線偵測。
* **Zero-Trust Observability**：外部傳入之關聯 ID 一律經過安全性字元與長度校驗；內部日誌全面經由白名單脫敏器過濾敏感金鑰，絕不洩漏 Authorization Header 或密碼資訊。
