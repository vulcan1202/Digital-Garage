# Digital Garage｜數位車庫

> 一支手機就是一座數位車庫。以單一車輛為生命週期主體的愛車履歷與車況管理系統。

---

## 快速導覽 (Documentation Index)

詳細系統架構、業務規格與實作細節已模組化拆分收錄於下列文件：

* **[產品概述與設計理念 (Project Overview)](./project-overview.md)**：產品定位、痛點分析與生命週期時序架構。
* **[核心功能規格 (Features)](./documentation/features.md)**：油耗運算、保修工單、改裝調校比對、週期規費與法定檢驗排程。
* **[系統架構與技術棧 (Architecture)](./documentation/architecture.md)**：React Native/Expo、Go Chi、Supabase、離線突變佇列與多車快取隔離。
* **[資料模型與里程權威 (Data Model)](./documentation/data-model.md)**：11 張資料表關聯約束、時序動態 View、伺服器原子里程運算原則。
* **[資訊安全與存取控制 (Security & RLS)](./documentation/security-and-rls.md)**：JWT 鑑權、PostgreSQL 1~3 階層 RLS 隔離政策、Storage 安全。
* **[可觀測性與維運防護 (Observability)](./documentation/observability-and-operations.md)**：Request Correlation ID、Google Cloud Logging、機敏脫敏與全域錯誤邊界。
* **[測試品質、建置與部署 (QA & Deployment)](./documentation/testing-and-qa.md)**：15 大 QA 維度審查、ISS 故障防禦歷程、APK 打包與 Cloud Run 部署現況。

---

## 核心工程亮點 (Key Highlights)

* **Server-Authoritative 里程唯一權威**：資料庫層級強制 `current_mileage >= initial_mileage`，透過 `GREATEST` 原子更新防範人為與客戶端篡改。
* **全生命週期動態時序牆**：透過 PostgreSQL View 整合購車、加油、保養、維修、改裝與規費，實施 4 級確定性排序。
* **零信任可觀測性鏈路**：前後端以安全校驗之 Request Correlation ID 貫穿，後端輸出符合 Google Cloud Logging 規範之結構化日誌並深度脫敏。
* **彈性離線突變佇列**：內建連線感知與 FIFO 永續佇列，具備 4xx 永久錯誤隔離防塞車與 App 重啟狀態修復機制。
* **台灣監理規費智慧預填**：支援牌照稅、公路養管費、車齡檢驗視窗自動推算，兼具月末天數防溢位截斷與出廠日向後相容。

---

## 快速開始 (Quick Start)

### 行動端前端 (Mobile App)
```bash
npm install
npm run typecheck
npm test -- --watchAll=false
npm run start
```

### 後端 API 服務 (Backend API)
```bash
cd backend
go test -v ./... -count=1
go run cmd/api/main.go
```
