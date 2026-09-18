# 可觀測性與維運防護 (Observability & Operations - P2-1)

---

## 1. 架構拓撲與可觀測性總覽

為滿足生產環境的高可用性與分散式排錯需求，系統建置了端到端關聯追蹤、Google Cloud Logging 原生結構化日誌與行動端崩潰防護機制：

```text
┌────────────────────────────────────────────────────────┐
│             React Native / Expo Client                 │
│  - X-Request-ID 自動注入與傳播 (crypto.randomUUID)      │
│  - AppError 捕獲權威 Request ID 與關聯分析             │
│  - ErrorReporter: 30s 滑動視窗複合鍵去重 + 敏感脫敏    │
│  - ErrorBoundary: 沉浸式 Dark-Metal 崩潰備援 UI        │
└───────────────────────────┬────────────────────────────┘
                            │ X-Request-ID Header
                            ▼
┌────────────────────────────────────────────────────────┐
│             Go Backend (Cloud Run us-central1)         │
│  - RequestID Middleware: 零信任校驗 (8~64字元安全字元) │
│  - 回應標頭權威回寫 (X-Request-ID / Access-Control)     │
│  - log/slog Google Cloud Logging JSON 規格結構化日誌   │
│  - 敏感鍵遞迴脫敏 (Exact Key Match Redaction)          │
│  - Safe Panic Recovery: 500 JSON 遮罩 + 伺服器日誌堆疊 │
└────────────────────────────────────────────────────────┘
```

---

## 2. 端到端 Request Correlation ID 機制

* **零信任輸入校驗**：後端嚴格檢驗 Client 傳入的 `X-Request-ID`。長度須介於 8~64 字元且僅允許 `^[a-zA-Z0-9_-]+$`。若不符規則、為空或含惡意字元，後端立即捨棄並由 `crypto/rand` 生成權威 UUID v4。
* **雙向傳播與跨域支援**：後端處理後將權威 ID 回寫至 Response Header，並於 CORS 配置 `ExposedHeaders: ["X-Request-ID"]`。
* **前端關聯保存**：前端 `apiClient` 於發送請求時自動帶入，若後端回傳業務或系統錯誤（4xx/5xx），`AppError` 自動記錄後端權威 `requestId`。

---

## 3. Google Cloud Logging 結構化日誌 (`log/slog`)

* **原生相容**：後端棄用純文字 `log.Printf`，全面改用 Go 1.21+ 原生 `log/slog` 輸出 JSON。
* **Cloud Run 欄位對齊**：
  * **時間戳格式**：`RFC3339Nano`
  * **嚴重性層級**：`severity` (`DEFAULT`, `INFO`, `WARNING`, `ERROR`)
  * **HTTP 請求物件**：`httpRequest` 包含 `requestMethod`, `requestUrl`, `status`, `userAgent`, `remoteIp`, 與以秒為單位的延遲 `latency`（如 `"0.082s"`）
  * **環境標籤**：自動載入 `K_SERVICE` 與 `K_REVISION`
* **隱私敏感資料脫敏 (Privacy-by-Design Sanitization)**：
  * 精確匹配敏感鍵值（不分大小寫）：`authorization`, `password`, `token`, `access_token`, `refresh_token`, `secret`, `jwt`, `api_key`, `cookie`。
  * 遞迴深層對 Map / Slice 進行遮罩脫敏為 `"[REDACTED]"`，避免遮蔽正常業務欄位（如 `token_type`、`device_token`）。
  * 絕不記錄 Request Body / Response Body 原始 Payload，防止個資與機密外洩。

---

## 4. 安全 Panic 復原中介軟體 (Recovery Middleware)

* **抗崩潰防護**：外層中介軟體捕獲所有 Handler 內部未預期之 panic。
* **資訊外洩防禦**：後端內部記錄含堆疊追蹤（Stack Trace）之 `ERROR` 級別結構化日誌，對客戶端僅回傳安全的 `500 INTERNAL_ERROR` JSON 結構，絕不向外部暴露程式碼行號或系統細節。

---

## 5. 前端 ErrorReporter 與全域 ErrorBoundary

* **智慧降噪與去重**：`errorReporter` 實作 30 秒滑動視窗複合鍵去重演算法（`hash(errorType + endpoint + status + normalizedMessage)`），防止高頻重複錯誤灌爆日誌伺服器。
* **錯誤分級過濾**：離線網路斷線（`FetchError` / `NETWORK_ERROR`）與標準身分過期（401）不視為系統崩潰，予以安靜抑制；僅將未處理的 5xx 伺服器異常或 UI Render Crash 列入回報。
* **全域 UI 崩潰邊界 (`ErrorBoundary`)**：以車庫 Dark-Metal 金屬質感呈現降級 UI，顯示安全之錯誤代碼與後端關聯 Request ID，並提供非破壞性重試按鈕（保留使用者登入 Session）。
