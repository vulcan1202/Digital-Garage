# 數位車庫 Digital Garage (Mobile App)

> **車輛生命週期遙測監控、相片管理與改裝調校跨平台 Mobile App**  
> 專為車主與性能愛好者打造，整合車隊管理、車輛與工單相片完整生命週期、里程防污染同步、油耗計算、保養週期雷達、改裝品規格管理與調校設定組版本控制。

---

## 📑 目錄 (Table of Contents)

1. [專案概述 (Project Overview)](#1-專案概述-project-overview)
2. [現行核心功能 (Current Features)](#2-現行核心功能-current-features)
3. [技術棧與環境 (Technology Stack)](#3-技術棧與環境-technology-stack)
4. [系統架構 (Architecture)](#4-系統架構-architecture)
5. [專案目錄結構 (Project Structure)](#5-專案目錄結構-project-structure)
6. [資料庫與模型定義 (Database & Schema)](#6-資料庫與模型定義-database--schema)
7. [身分驗證與安全性 (Authentication & Security)](#7-身分驗證與安全性-authentication--security)
8. [環境設定與安裝 (Setup)](#8-環境設定與安裝-setup)
9. [執行與建置 (Running & Building)](#9-執行與建置-running--building)
10. [測試驗證 (Testing)](#10-測試驗證-testing)
11. [專案狀態與已知限制 (Project Status & Limitations)](#11-專案狀態與已知限制-project-status--limitations)

---

## 1. 專案概述 (Project Overview)

「數位車庫 (Digital Garage)」解決車主在車輛管理上的多項分散痛點：
* **多車庫與里程連動**：集中管理多輛愛車，里程同步機制自動以各項業務紀錄與初始里程之最大值為準，具備手誤極大里程刪除回滾的防污染防護。
* **相片完整生命週期管理**：涵蓋車輛相簿、保養工單與改裝品照片，支援相機即時拍照、相簿多選、客戶端高效壓縮、自動封面設定與全螢幕手勢預覽。
* **工單履歷完整追蹤**：細分定期保養 (Maintenance) 與故障維修 (Repair)，登錄保養時可自選設定下次週期提醒。
* **加油日誌與油耗遙測**：支援多種油品規格，純函式計算百公里油耗與每公里行駛成本。
* **改裝品規格與調校版本控制**：登錄改裝配件並針對特定套件建立多組細項調校參數（如阻尼段數、定位角度），以唯一約束管理當前生效版本 (`is_current`)。
* **混合動態時序牆**：聚合加油、保修、改裝三大異質事件，以時間軸流水卡片呈現並支援即時編輯與刪除。
* **雙軌自適應避讓與高亮互動**：全面落實 Android 專屬平滑動畫推昇與 iOS 原生避讓分工，車庫主畫面清楚高亮作用中車輛。
* **健全 Email 驗證與靜態引導**：整合 Supabase 郵件驗證與 GitHub Pages 跨平台 HTTPS 靜態提示頁，支援未驗證精確攔截與一鍵重新發送驗證信。

---

## 2. 現行核心功能 (Current Features)

以下為程式碼中**已完整實作並可正常運作**的功能模組：

### 2.1 車輛管理與相簿管理 (Vehicles Fleet & Photo Gallery)
* **新增／編輯車輛**：設定廠牌、車型、年份、購入日期與里程。
* **相片生命週期管理 (Vehicle Photos)**：
  - **相簿管理 Modal (`VehiclePhotoGalleryModal`)**：網格檢視車輛所有相片，標記當前封面徽章 (COVER)。
  - **封面機制**：支援將特定相片手動「設為封面」；若刪除當前封面照片，系統自動將下一張設為新封面或清空。
  - **即時快取聯動**：相片上傳、設為封面或刪除後，即時觸發 `queryKeys.vehicles` 失效刷新，車庫儀表板即時感知並呈現最新封面照。
  - **全螢幕圖片檢視 (`ImageViewerModal`)**：支援相簿點擊全螢幕高清預覽與上下張切換。
* **里程防污染架構 (方案 B)**：
  - 建立車輛時寫入不可變建檔基準 `initial_mileage`。
  - 加油、保養、改裝進行新增、更新或刪除時，自動觸發 `syncVehicleMaxMileage`，以現存所有紀錄里程與 `initial_mileage` 之最大值動態回寫 `current_mileage`。
  - 若手誤輸入超大里程紀錄，刪除該紀錄後車輛總里程自動安全回滾至剩餘最大值，不污染底層資料。
* **車輛刪除**：刪除車輛時連動級聯清除其下所有相片、加油、保養、提醒與改裝紀錄。

### 2.2 相片選取與客戶端最佳化壓縮 (`imageOptimizer.ts`)
* **權限檢查與選取器 (`PhotoPickerSection`)**：
  - 整合 `expo-image-picker` 支援「拍照 (Camera)」與「相簿多選 (Library)」。
  - 表單內即時縮圖預覽，支援單張移除與上限控制。
* **客戶端圖片最佳化 (`optimizeImage`)**：
  - 採用 `expo-image-manipulator` 最新 Context API (`ImageManipulator.manipulate`)。
  - 最長邊限制 1920px 等比例縮放，JPEG 格式品質壓縮（0.8），顯著降低上傳流量並加快渲染速度。

### 2.3 紀錄管理中樞 (Garage Dashboard Tabs)
儀表板提供三大分頁切換檢視：
* **改裝清單 (Modifications)**：列出套件分類、品名、品牌型號、購買與安裝花費、安裝里程與相片，支援快速編輯、刪除與跳轉調校頁。
* **保養維修 (Maintenance)**：卡片呈現定期保養與故障維修工單、施作日期、費用、店家、里程與施工單據相片，支援直接編輯與刪除。
* **加油日誌 (Refuels)**：呈現油品類型、公升數、每公升單價、總花費與紀錄日期，支援直接編輯與刪除。

### 2.4 遙測與統計分析 (Telemetry Calculators)
* **成本計算 (`costCalculator.ts`)**：累計改裝、保修與加油總支出，並計算每公里平均攤提成本 ($\text{Cost per KM} = \frac{\text{總費用}}{\text{當前里程} - \text{起算里程}}$)。
* **油耗計算 (`fuelCalculator.ts`)**：計算相鄰兩次加油間隔之平均油耗（$\text{L}/100\text{km}$ 與 $\text{km}/\text{L}$）及歷史平均每公里油資。
* **保養雷達評估 (`reminderCalculator.ts`)**：依據車輛當前里程與日期，評估剩餘里程與剩餘天數，標示狀態為 `OK`、`DUE_SOON`（即將到期）或 `OVERDUE`（已逾期）。

### 2.5 保養提醒雷達 (Maintenance Reminders)
* **週期監控**：支援依「里程間隔 (KM)」或「時間間隔 (月)」雙軌追蹤。
* **保養連動**：新增保養時可直接勾選設定下次提醒；編輯既有保養紀錄之施作日期或里程時，自動同步更新關聯提醒之基準 (`base_mileage`, `base_date`)。
* **週期推進**：手動標記完成保養時，基準里程自動前移至當前車輛里程，展開下一週期監控。

### 2.6 改裝套件與調校設定組版本控制 (Modifications & Tuning)
* **配件登錄**：支援 10 種硬體類別（避震、煞車、引擎、排氣、進氣、輪圈輪胎、外觀、內裝、電系、其他），記錄套件價格、工資與改裝相片。
* **版本控制 (Tuning Profiles)**：單一改裝品可建立多組設定組（例如「賽道設定」、「日常代步」），且透過資料庫唯一約束確保同時間僅有一組設定處於使用中 (`is_current = true`)。
* **細項參數管理**：各設定組內可登錄多筆自訂鍵值參數與單位（例如「前伸側阻尼: 8 段」）。

### 2.7 愛車動態時序牆 (Vehicle Timeline)
* **聚合查詢**：向 SQL View `vehicle_timeline` 發起分頁查詢，將加油、定期保養、維修、改裝依日期排序匯聚呈現。
* **即時篩選**：支援切換「全部動態」、「加油紀錄」、「保修保養」、「改裝升級」膠囊標籤。
* **行內操作**：時間軸卡片直接提供「編輯」與「刪除」功能，操作完成後即時重新計算愛車最高里程。

### 2.8 雙軌架構鍵盤避讓機制 (Dual-Track Keyboard Avoiding Architecture)
* **平台分工設計**：
  - **Android 平台**：原生 `<Modal>` 為獨立 `android.app.Dialog` Window，不繼承主 Activity 之 `windowSoftInputMode="adjustResize"`。專案建置專屬 [`useKeyboardBottomInset`](file:///e:/%E6%95%B8%E4%BD%8D%E8%BB%8A%E5%BA%AB%20%28Digital%20Garage%29/src/hooks/useKeyboardBottomInset.ts) Hook，精準監聽 Android 鍵盤開啟／收合事件，並注入 `LayoutAnimation.Presets.easeInEaseOut` 實現平滑推昇過渡動畫。
  - **iOS 平台**：維持既有原生最佳實踐 `KeyboardAvoidingView behavior="padding"`，強制不套用 Android 底部推昇補償，杜絕疊加位移衝突。
* **空間與導覽適配**：全域 10 個業務 Modal 統一採用 `max-h-[88%]` 彈性頂部餘裕與 `ScrollView contentContainerStyle={{ paddingBottom: 60 }}`，徹底解決三鍵式虛擬鍵盤與全螢幕手勢導覽條環境下的按鈕與輸入框遮擋問題。
* **車輛選擇清晰高亮**：車庫主畫面（`GarageDashboardScreen`）車輛橫向選單，選取中車輛以鮮明亮橘粗邊框 (`border-2 border-racing-orange`)、發光光暈 (`shadow-racing-orange/40`) 與即時狀態徽章 (`● ACTIVE`) 醒目標示。
* **純淨登入體驗**：`AuthScreen` 移除任何測試後門提示，採用分類結構化繁體中文錯誤指引（密碼錯誤、查無帳號、伺服器異常等）。

### 2.9 健全 Email 驗證與靜態中繼引導 (Email Verification & Static Web Gateway)
* **標準 HTTPS 跨平台驗證**：註冊時 `signUp()` 指定 `options.emailRedirectTo` 指向由 GitHub Pages 託管的靜態驗證提示頁面（`https://vulcan1202.github.io/Digital-Garage/verified.html`），完全免除自訂 Scheme 於桌機或特定瀏覽器引發之「無法開啟此網址」相容性問題。
* **精確代碼判定與補寄機制**：登入時嚴格以 `error.code === 'email_not_confirmed'` 作為判斷基準，跳出彈窗提示車主至信箱收信啟用，並提供「**重新發送驗證信**」快捷呼叫（`supabase.auth.resend`），徹底防止斷點。
* **安全基準強化**：清理底層 `requireUser()` 假測試車主回退，未驗證帳號受 Supabase Auth 與 RLS 嚴密防護，未登入者安全拋出 `AppError.authRequired`。

---

## 3. 技術棧與環境 (Technology Stack)

| 領域 | 核心技術 / 套件 | 專案實際版本 | 說明 |
| :--- | :--- | :--- | :--- |
| **Runtime / Framework** | React Native / Expo | `0.86.3` / `~57.0.22` | 行動應用程式跨平台框架 (Expo SDK 57) |
| **Language** | TypeScript | `~6.0.3` | 全專案嚴格靜態型別支援 (`noEmit` 通過) |
| **React** | React | `19.2.3` | React 核心 |
| **Styling** | NativeWind / Tailwind CSS | `^4.1.23` / `^3.4.17` | 原子化樣式系統 |
| **Data Fetching & Cache** | TanStack React Query | `^5.66.11` | 異步伺服端狀態管理、快取自動失效與即時同步 |
| **Backend & Database** | Supabase (@supabase/supabase-js) | `^2.49.1` | PostgreSQL、Row Level Security (RLS)、Auth、Storage |
| **Image & Media** | Expo Image Picker | `~57.0.17` | 系統原生相機拍照與相簿多選選取器 |
| **Image Manipulation** | Expo Image Manipulator | `~57.0.17` | 客戶端圖片尺寸縮放與 JPEG 壓縮最佳化 |
| **Local Storage** | Expo SecureStore | `~57.0.0` | 裝置端安全加密持久化（離線備援資料庫與 Auth Session） |
| **Crypto & Utilities** | Expo Crypto | `~57.0.0` | UUID 生成與加解密 |
| **UI Components** | Expo Vector Icons / Safe Area | `^15.0.3` / `~5.7.0` | 向量圖示庫與安全區域適配 |
| **Static Web Hosting** | GitHub Pages | `/docs` | 託管 Email 驗證成功跨平台 HTTPS 靜態提示頁面 |
| **Testing** | Jest / ts-jest | `^29.7.0` / `^29.2.5` | 單元測試與型別測試執行器 |
| **Build & Tooling** | Android Gradle Plugin / JDK | Gradle 9.3.1 / JDK 17 | 原生 Android Release APK 編譯打包環境 |

---

## 4. 系統架構 (Architecture)

專案採分層解耦架構，並實作「雲端優先、本地回退」的雙層韌性儲存：

```text
┌─────────────────────────────────────────────────────────────┐
│                       UI Layer (呈現層)                     │
│  - React Native + NativeWind v4 (Tailwind CSS)              │
│  - 主畫面：AuthScreen, GarageDashboardScreen,               │
│            VehicleTimelineScreen, ModificationDetailScreen  │
│  - 業務 Modal：新增/編輯車輛、相簿管理、全螢幕檢視、         │
│               加油、保養、改裝、調校設定組                  │
│  - 通用元件：PhotoPickerSection, DoubleBezelCard            │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    Cache & Query Layer                      │
│  - TanStack React Query v5                                  │
│  - queryKeys 工廠集中管理快取鍵，CRUD 成功後精準失效刷新     │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                Service & Business Logic Layer               │
│  - 業務 Services (vehicle, storage, fuel, maintenance, etc.) │
│  - handleServiceCall 統一錯誤捕捉與 AppError 轉換            │
│  - 純函式計算引擎 (costCalculator, fuelCalculator, etc.)    │
│  - 客戶端圖片等比縮放壓縮引擎 (imageOptimizer)              │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│             Dual-Layer Resilience Storage Layer             │
│  - 雲端層：Supabase PostgreSQL (含 RLS) + Supabase Storage   │
│  - 離線層：localStore (Expo SecureStore 模擬完整關聯資料庫) │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 專案目錄結構 (Project Structure)

```text
數位車庫 (Digital Garage)/
├── android/                                 # 原生 Android 專案目錄 (Gradle 建置配置)
├── assets/                                  # 應用程式靜態圖示與 Splash Screen
├── src/
│   ├── components/
│   │   ├── DoubleBezelCard.tsx              # 雙層倒角金屬風卡片容器
│   │   ├── PhotoPickerSection.tsx           # 通用相片選取器 (拍照/相簿多選/預覽/刪除)
│   │   └── modals/                          # 業務 CRUD 模態視窗群組
│   │       ├── AddVehicleModal.tsx          # 新增車輛 (含相片選取與封面自動關聯)
│   │       ├── EditVehicleModal.tsx         # 編輯車輛 (校正里程與基本資料)
│   │       ├── VehiclePhotoGalleryModal.tsx # 車輛專屬相簿 (封面設定/刪除自動轉移/多圖上傳)
│   │       ├── ImageViewerModal.tsx         # 全螢幕高清圖片預覽視窗
│   │       ├── AddRefuelModal.tsx           # 新增加油日誌
│   │       ├── EditRefuelModal.tsx          # 編輯加油日誌
│   │       ├── AddMaintenanceModal.tsx      # 新增保養維修 (含施工相片與下次提醒)
│   │       ├── EditMaintenanceModal.tsx     # 編輯保養維修
│   │       ├── AddReminderModal.tsx         # 新增保養雷達提醒
│   │       ├── AddModificationModal.tsx     # 登錄改裝套件 (含套件相片)
│   │       ├── EditModificationModal.tsx    # 編輯改裝套件
│   │       └── AddSettingSetModal.tsx       # 新增調校設定組與細項參數
│   ├── hooks/
│   │   ├── useAuth.ts                       # 身分驗證與狀態監聽 Hook
│   │   ├── useKeyboardBottomInset.ts        # Android Modal 鍵盤高度監聽與平滑動畫 Hook
│   │   └── queries/                         # React Query 快取管理層
│   │       ├── queryKeys.ts                 # 集中式 Query Key 工廠
│   │       ├── useVehicles.ts               # 車輛與車輛相簿 Query / Mutation
│   │       ├── useFuel.ts                   # 加油紀錄 Query / Mutation
│   │       ├── useMaintenance.ts            # 保修工單與相片 Query / Mutation
│   │       ├── useReminders.ts              # 保養提醒 Query / Mutation
│   │       ├── useModifications.ts          # 改裝品與調校參數 Query / Mutation
│   │       └── useTimeline.ts               # 動態時序牆 Query
│   ├── lib/
│   │   ├── supabase.ts                      # Supabase Client 初始化與 Session 配接器
│   │   ├── localStore.ts                    # 本地離線持久化儲存引擎 (SecureStore)
│   │   └── __tests__/                       # 本地儲存、里程同步與相簿邏輯單元測試
│   │       ├── syncVehicleMileage.test.ts   # 里程防污染與自動同步測試
│   │       └── vehiclePhotos.test.ts        # 車輛相片與封面轉移邏輯測試
│   ├── screens/
│   │   ├── AuthScreen.tsx                   # 登入與註冊畫面 (純淨空輸入框)
│   │   ├── GarageDashboardScreen.tsx        # 車庫主座艙 (車輛選擇、遙測統計、三分頁面板)
│   │   ├── ModificationDetailScreen.tsx     # 改裝套件規格與調校版本控制畫面
│   │   └── VehicleTimelineScreen.tsx        # 愛車動態時序牆畫面
│   ├── services/
│   │   ├── vehicleService.ts                # 車輛 CRUD、相簿管理與最高里程同步
│   │   ├── storageService.ts                # Supabase Storage 圖片上傳與物理刪除
│   │   ├── fuelService.ts                   # 加油 CRUD 服務
│   │   ├── maintenanceService.ts            # 保修工單與施工相片 CRUD 服務
│   │   ├── reminderService.ts               # 保養提醒雷達服務
│   │   ├── modificationService.ts           # 改裝品、改裝相片與調校設定服務
│   │   ├── timelineService.ts               # 時序牆 View 查詢服務
│   │   └── errors/                          # 統一錯誤處理類別與單元測試
│   │       ├── AppError.ts                  # 自訂業務錯誤封裝與格式化
│   │       └── __tests__/AppError.test.ts   # 錯誤處理單元測試
│   ├── types/
│   │   ├── database.ts                      # 與 PostgreSQL Schema 完全一致之型別定義
│   │   └── index.ts                         # 全域型別匯出
│   └── utils/
│       ├── imageOptimizer.ts                # 圖片權限、拍照、多選與 Context 壓縮最佳化
│       ├── __tests__/imageOptimizer.test.ts # 圖片最佳化模組單元測試
│       └── calculators/                     # 純函式遙測計算引擎 (含單元測試)
│           ├── costCalculator.ts            # 費用與每公里攤提計算
│           ├── fuelCalculator.ts            # 油耗計算
│           └── reminderCalculator.ts        # 保養提醒狀態計算
├── 數位車庫 (Digital Garage).sql            # 資料庫 Schema 唯一真理定義檔 (DDL + RLS + View)
├── 數位車庫_DigitalGarage.apk               # 最新打包完成之 Release APK 安裝檔
├── docs/                                    # 靜態文件與 GitHub Pages 部署來源
│   └── verified.html                        # Email 驗證成功提示頁 (暗黑機油金屬風)
├── App.tsx                                  # 應用程式進入點與基礎路由狀態
├── app.json                                 # Expo 專案設定檔
├── jest.config.js                           # Jest 測試設定檔
└── package.json                             # 專案相依套件與 Script 定義
```

---

## 6. 資料庫與模型定義 (Database & Schema)

資料庫以 PostgreSQL 為基底，定義於專案根目錄的 `數位車庫 (Digital Garage).sql`，包含 **8 個實體資料表**與 **1 個動態時序 View**：

### 6.1 資料表清單
1. **`Vehicles`**：車輛主表（包含 `initial_mileage` 不可變基準與 `current_mileage` 當前里程）。
2. **`VehiclePhotos`**：車輛照片關聯表（含封面標記 `is_cover`，透過唯一索引確保每車僅有一張封面）。
3. **`Refuels`**：加油紀錄表（油品種類、容量、單價、總花費、里程）。
4. **`MaintenanceRecords`**：保養維修工單（類別：定期保養 `maintenance` 或故障維修 `repair`、費用、店家、備註）。
5. **`MaintenancePhotos`**：保養維修施工照片關聯表。
6. **`Reminders`**：保養提醒雷達（支援 `interval_km` 與 `interval_months` 雙軌週期設定）。
7. **`Modifications`**：改裝配件表（10 大類別、套件價格、工資、安裝里程）。
8. **`ModificationPhotos`**：改裝套件照片關聯表。
9. **`ModificationSettingSets`**：改裝調校設定組（版本控制主表，同改裝品以唯一索引限制 `is_current = true` 僅能有一組）。
10. **`ModificationSettings`**：調校細項參數鍵值表（參數名稱、數值、單位）。

### 6.2 動態聚合 View (`vehicle_timeline`)
透過 `security_invoker = true` 定義，使用 `UNION ALL` 將 `Refuels`、`MaintenanceRecords`、`Modifications` 整合為單一時間軸事件流，包含 `event_type`、`event_date`、`mileage`、`cost`、`title`、`description`。

### 6.3 級聯刪除與資料完整性
所有子資料表外鍵皆具備 `ON DELETE CASCADE` 約束；刪除車輛將自動乾淨清除所有附屬紀錄，不留殘存孤兒數據。

---

## 7. 身分驗證與安全性 (Authentication & Security)

* **Supabase Auth & Email 驗證**：支援 Email 與密碼註冊，後台強制啟用「Confirm email」，註冊時綁定 GitHub Pages 靜態提示頁面（`https://vulcan1202.github.io/Digital-Garage/verified.html`），全平台 HTTPS 零相容性障礙。
* **精確代碼判斷與防斷點補寄**：未驗證車主登入時，前端以 `error.code === 'email_not_confirmed'` 精確捕捉，並提供「重新發送驗證信」安全機制。
* **安全 Session 持久化**：透過 `ExpoSecureStoreAdapter` 橋接 `expo-secure-store`，將 JWT Session 加密儲存於系統原生安全區域。
* **Row Level Security (RLS)**：所有資料表皆強制啟用 RLS：
  - `Vehicles`：限定 `auth.uid() = user_id`。
  - 子關聯表：透過 `EXISTS (SELECT 1 FROM "Vehicles" WHERE ... user_id = auth.uid())` 確保使用者僅能讀寫自己車輛的關聯數據。
* **無預設憑證與安全攔截**：底層 `requireUser()` 清理測試假資料 fallback，登入畫面完全清空，未經認證安全拋出 `AppError.authRequired`。

---

## 8. 環境設定與安裝 (Setup)

### 8.1 前置環境
* **Node.js**：`>= 18.x`
* **npm**：`>= 9.x`
* **JDK**（若需建置 Android 原生端）：JDK 17
* **Android SDK**（若需建置 Android 原生端）：含 Build Tools 與 Platform 34+

### 8.2 安裝依賴
```bash
npm install
```

### 8.3 環境變數配置
複製環境變數範例檔並填入您的 Supabase 專案金鑰：
```bash
cp .env.example .env
```
編輯 `.env` 內容：
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
# 或舊版相容
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_jwt_key_here
```

---

## 9. 執行與建置 (Running & Building)

### 9.1 開發模式 (Expo Go / Dev Client)
```bash
# 啟動 Expo 開發伺服器
npm run start

# 或指定平台執行
npm run android
npm run ios
npm run web
```

### 9.2 原生 Android Standalone Release APK 打包
專案可直接使用 Gradle 離線打包獨立運行的 Release APK：
```bash
# 進入 android 目錄編譯 assembleRelease
cd android
./gradlew assembleRelease --no-daemon
```
產出之 APK 位於：
`android/app/build/outputs/apk/release/app-release.apk`
（根目錄的 `數位車庫_DigitalGarage.apk` 即為同步更新之最新可安裝版本）。

---

## 10. 測試驗證 (Testing)

專案具備嚴格的靜態型別檢查與 Jest 自動化單元測試套件：

### 10.1 執行靜態型別檢查
```bash
npm run typecheck
```

### 10.2 執行自動化單元測試
測試涵蓋費用計算、油耗計算、保養雷達狀態評估、AppError 邊界、車輛里程同步、相片封面轉移與圖片最佳化邏輯：
```bash
npm test
```
**現行測試套件清單 (7 Suites / 30 Tests 全部通過)**：
* `src/utils/calculators/__tests__/costCalculator.test.ts`
* `src/utils/calculators/__tests__/fuelCalculator.test.ts`
* `src/utils/calculators/__tests__/reminderCalculator.test.ts`
* `src/services/errors/__tests__/AppError.test.ts`
* `src/lib/__tests__/syncVehicleMileage.test.ts`
* `src/lib/__tests__/vehiclePhotos.test.ts`
* `src/utils/__tests__/imageOptimizer.test.ts`

---

## 11. 專案狀態與已知限制 (Project Status & Limitations)

### 11.1 專案狀態
* **目前階段**：**Release Candidate (RC) / Complete Lifecycle Platform**
* 核心資料庫架構、商業邏輯、雙層儲存降級、全模組 CRUD、相片生命週期（拍照/多選/壓縮/封面）、版本控制與時序動態牆皆已完整實作，並通過實機編譯與單元測試驗證。

### 11.2 已知限制 (Known Limitations)
1. **多語系支援**：
   - 介面文字目前以繁體中文搭配專業賽車英文術語（如 `TELEMETRY`, `ODOMETER`）呈現，尚未拆分為獨立的 i18n 語系檔。
2. **離線與雲端雙向衝突合併**：
   - `localStore.ts` 可在無網路或無登入狀態下提供完整離線讀寫體驗，但當連線恢復時，尚未提供自動將本地離線產生的變更雙向 Merge 回雲端 Supabase 的衝突比對協議。