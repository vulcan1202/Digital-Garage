# 核心業務規格與功能模組 (Features Specification)

---

## 1. 車輛管理 (Vehicle Management)

* **車輛建檔與基本資料**：支援汽車（`car`）、機車（`motorcycle`）與其他（`other`）三種車輛類型。
* **核心規格屬性**：記錄品牌、型號、出廠年月（`manufacture_date`，格式 `YYYY-MM`）、行照原發照日（`registration_date`，格式 `YYYY-MM-DD`）、年份（`year`）、車牌號碼、排氣量（cc）、動力燃料種類、購入日期（`purchase_date`）與購入金額（`purchase_price`）。
* **法規日期分流與選擇器封裝 (P2-2.5 / P2-2.6)**：
  * **出廠年月 (`manufacture_date`)**：符合台灣監理行照「出廠年月」規格，採用純前端 Dark-Metal 3x4 月份矩陣與年份切換選擇器（`mode="month"`），自動解析西元年份並回傳後端。
  * **行照原發照日 (`registration_date`)**：採用標準日曆選擇器（`mode="date"`），記錄精確年月日，做為法定定期檢驗視窗推算之權威基準日。
* **里程基線保護**：建置入庫「初始里程（`initial_mileage`）」與「當前里程（`current_mileage`）」，資料庫層級強制約束 `current_mileage >= initial_mileage`。
* **車輛首圖與多圖管理**：支援多張車輛外觀相片上傳與封面設定，具備封面刪除自動遞補機制。

---

## 2. 加油日誌與油耗分析 (Fuel Management)

* **紀錄欄位**：加油日期、當前累計里程（公里）、加油量（公升）、單價（元/公升）、總金額與燃油規格（92/95/98無鉛、柴油、超柴、電力、油電、其他）。
* **純運算指標 (`fuelCalculator.ts`)**：
  * 每百公里公升數：
    $$\text{L}/100\text{km} = \frac{\text{volume}}{\Delta \text{mileage}} \times 100$$
  * 每公升行駛公里數：
    $$\text{km}/\text{L} = \frac{\Delta \text{mileage}}{\text{volume}}$$
  * 具備零里程增量（$\Delta \text{mileage} \le 0$）與極值除以零安全回傳防護。

---

## 3. 保養與維修履歷 (Maintenance & Repair)

* **雙軌分類**：明確拆分為「定期保養（`maintenance`）」與「故障維修（`repair`）」，報表與時序牆獨立分類呈現。
* **工單詳細內容**：項目名稱、施作日期、施作里程、費用、施作店家與詳細備註。
* **現場工單實拍**：各工單支援獨立上傳多張現場單據或施工相片。
* **自動連動提醒**：新增保養工單時可勾選同步設定下次週期提醒。

---

## 4. 保養提醒系統 (Reminders)

* **雙向週期追蹤**：支援里程週期（`interval_km`）與時間月份週期（`interval_months`）。
* **狀態即時判定 (`reminderCalculator.ts`)**：依車輛最新里程與當前日期動態推算剩餘天數與里程，劃分為：
  * **逾期（Overdue）**
  * **即將到期（Due Soon）**
  * **正常（Good）**
* **彈性控制**：支援「啟用中（`active`）」與「暫停（`paused`）」狀態切換；標記完成時自動將基準里程與基準日期前移至最新作業點。

---

## 5. 週期規費與法定檢驗 (Recurring Expenses & Compliance - P2-2)

### 台灣在地監理法規與排程支援
* **牌照稅 (`license_tax`)**：自用汽機車每年 4 月開徵（04/01 ~ 04/30）。
* **公路使用養護安全管理費（公路養管費，`road_maintenance_fee`）**：自用汽機車每年 7 月開徵（07/01 ~ 07/31）。
* **定期檢驗 (`inspection`)**：
  * 依台灣監理規範，以行照**原發照日期 (`registration_date`)** 的月日為基準；
  * 車主僅需填寫「此次檢驗日」（實際受檢日）與「下次定檢日」（行照印章日期），系統自動以下次定檢日推算前後各 1 個月（共 2 個月）寬限期；
  * 汽車滿 5 年未滿 10 年每年 1 次，10 年以上每年 2 次；未滿 5 年新車免定檢，滿 4 年（即將邁入第 5 年）時主動提供「首檢即將到來」預警；
  * 汽機車（含黃紅牌重型機車）統一標題為「定期檢驗」，避免歧義；
* **強制汽車責任險 (`compulsory_insurance`) & 任意險 (`liability_insurance`)**：支援自訂覆蓋起訖日，預設 1 年保單週期。

### 智慧預填與資料不全引導 (Smart Pre-fill & Incomplete Data Handling)
* **法規優先推算**：優先依 `registration_date` 之月日推算檢驗視窗，車齡依 `manufacture_date`（或 `year`）計算。
* **資料不全友善引導**：若車輛未填 `registration_date` 且無定檢紀錄，狀態標示為「資料不全」，待車主第一次完成驗車填入資料後接軌排程通知。

### 月末溢位安全防護 (Month Clamping Defense)
* 計算前後 1 個月檢驗窗口時，嚴格防範原生 JavaScript `setMonth(±1)` 之月份溢位 bug。
* 採用自建 `addMonthsClamped` 函式，精準處理閏年 2/29 轉 2/28、小月 30 號與大月 31 號之邊界條件。

### 狀態即時監控與雙階寬限期雷達
* 劃分為「正常（Good）」、「可驗車（Can Inspect，寬限期前一個月，黃色提醒）」、「需要驗車（Inspection Needed，寬限期後一個月，紅色警報）」、「已逾期（Overdue）」與「資料不全（Incomplete Data）」。
* 整合進入車輛 Cockpit 之 `RemindersTab`，並以型別對齊整合進入 `vehicle_timeline` View。

### 固定規費年度徵收實務優化 (Annual Taxes & Fees Refinement - P2-2.10)
* **狀態文字統一移除「本年度」贅字**：卡片狀態徽章精準聚焦於「已繳清」（綠）、「尚未繳清」（灰）、「待繳清」（黃，開徵中計入 DUE SOON）、「逾期未繳」（紅，已逾期計入 OVERDUE），結清描述簡化為「稅費已結清」。
* **固定規費專屬「僅限本年度」標籤**：牌照稅與公路養管費項目名稱右側標註「僅限本年度」提示標籤，清楚傳遞固定規費僅記錄當年度徵收狀況，與跨年之定檢及保險做直覺區隔。
* **完全無日期化展示**：固定規費卡片徹底移除生硬的截止日（YYYY-MM-DD）、繳納完成日及剩餘天數倒數，保持視覺極簡。
* **月份自適應時程小字**：依當前月份自動切換（「將於四/七月徵收」->「四/七月徵收中」->「已逾四/七月徵收期」）。
* **營業用車額外提示**：列表底部獨立小字標示「* 規費時程以自用車為準，營業用車依監理通知為準」。

---

## 6. 改裝品管理 (Modifications)

* **改裝品檔案**：記錄品牌、品名、型號、改裝品類別（懸吊、煞車、引擎、排氣、進氣、輪框輪胎、外觀、內裝、電系、其他）。
* **雙重成本拆分**：明確區分「購買價格（`purchase_price`）」與「安裝工資（`install_price`）」，以及購買日、安裝日與安裝里程。
* **改裝照片**：支援上傳改裝品安裝實照。

---

## 7. 改裝調校版本控制 (Modification Setting Set)

* **多版本管理**：單一改裝品可建立多組調校設定（如「賽道設定」、「山路跑山」、「日常通勤」）。
* **生效版本保護**：每組改裝品同一時間僅有一組設定標記為使用中（`is_current = true`），由資料庫 Partial Unique Index 嚴格防護。
* **版本複製 (Clone)**：在後端單一原子交易內，完整深拷貝指定版本及其所有參數細項，生成獨立 Snapshot。
* **智慧遞補**：當使用中的設定組遭刪除時，系統自動將生效狀態轉移至剩餘之最新版本。
* **跨版本參數差異比對 (`settingComparator.ts`)**：提供視覺化比較工具，以 Map-based union 差異演算法精確標示各項參數之：
  * **新增 (Added)**
  * **移除 (Removed)**
  * **數值變更 (Changed)**
  * **完全相同 (Unchanged)**

---

## 8. 車輛動態時序牆 (Vehicle Lifecycle Timeline)

* **全生命週期整合**：自資料庫專屬 View 整合購車、加油、保養、維修、改裝與週期規費事件。
* **四層確定性排序 (4-Tier Deterministic Ordering)**：
  1. `event_date DESC`
  2. `mileage DESC NULLS LAST`
  3. `created_at DESC`
  4. `event_id DESC`
* **購車入庫事件嚴謹原則**：僅當車輛明確填寫 `purchase_date` 時產生 Purchase Event，**嚴格禁止以 `created_at` 假造購入日期**。
* **多元篩選**：支援全部、加油、保養、維修、改裝與規費等類別切換檢視。

---

## 9. 多維度持有成本分析 (Cost Analytics)

* **時間區間**：提供 6 個月、12 個月、24 個月歷程切換。
* **月份填零保護 (Monthly Zero-Filling)**：無支出月份完整填入 0，防止趨勢圖座標軸斷裂。
* **改裝費用精確歸屬**：購買金額依 `purchase_date` 歸屬月份，安裝工資依 `install_date` 歸屬月份；無日期紀錄者不隨意污染月度統計。
* **指標計算與資料語意**：
  * **總運作成本 (Total Operational Cost)**：加油 + 保養 + 維修 + 週期規費 + 改裝購買與安裝。
  * **總擁有成本 (Total Ownership Cost / TCO)**：購入金額 + 總運作成本。若未填寫購入金額則為 `null`，不以 0 元誤導。
  * **每公里平均成本與每公里油資**：
    $$\Delta\text{Mileage} = \text{current\_mileage} - \text{initial\_mileage}$$
    $$\Delta\text{Mileage} \le 0 \implies \text{cost\_per\_km} = \text{null},\ \text{fuel\_cost\_per\_km} = \text{null}$$
    回傳 `null` 明確表達「尚無足夠里程資料以利計算」，防止除以零產生 `NaN` 或誤植為 0 元。

---

## 10. 伺服器狀態與延遲監測 (Server Status & Piggyback Latency - P2-2.7)

* **零成本附帶測速 (Zero-Cost Piggyback)**：完全捨棄背景無端輪詢（No Polling），不產生額外 Cloud Run vCPU 與網路流量計費；透過前端網路攔截層於使用者正常業務操作時附帶測量真實 RTT 往返延遲。
* **極簡 HTTP 204 HEAD 探活**：提供手動點擊即時刷新機制，後端回傳零 Payload 的 HTTP 204 No Content，極致輕量無負擔。
* **Dark-Metal 狀態膠囊**：首頁座艙即時呈現伺服器連線狀態（在線/離線）、真實延遲毫秒（ms）與部署節點（`us-central1`），具備綠/黃/紅三段式健康色階與網路中斷自適應。

---

## 11. 全域 i18n 雙語切換與雙語並陳 (Global i18n & Bilingual Presentation - P2-2.8)

* **單一結構化字典架構**：
  * 繁體中文：`src/i18n/locales/zh-TW.json`
  * 美式英文：`src/i18n/locales/en-US.json`
  * 雙向結構 100% 鍵值對稱，零空白葉節點，變數插值參數格式統一。
* **純前端表現層隔離**：完全不更動資料庫與後端 Go API，車主自行輸入之品牌、車型、零件名稱與備註皆原樣保留，不進行機器翻譯污染。
* **Zero-Flash 開機水合門禁**：以 `expo-secure-store` 持久化語系與雙語開關，於 App Root 設置 `LanguageProvider` 水合閘門，避免啟動畫面與主介面語系跳轉閃爍。
* **BilingualText 5 大決策矩陣**：
  1. `zh-TW` 且 `isBilingual: true` -> 繁中主標題＋英文副標題
  2. `zh-TW` 且 `isBilingual: false` -> 僅繁中主標題
  3. `en-US` 且 `isBilingual: true` -> 僅英文主標題（智慧防自我重複）
  4. `en-US` 且 `isBilingual: false` -> 僅英文主標題
  5. 英文鍵缺失 -> 不顯示空白或 `undefined` 副標題，安全降級
* **原生無障礙切換膠囊**：`[ 繁中 | EN ]` 配置符合人體工學之 `hitSlop` 與 Android TalkBack 無障礙宣告。
