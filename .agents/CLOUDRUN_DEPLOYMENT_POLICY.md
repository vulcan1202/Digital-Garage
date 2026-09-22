# Google Cloud Run 部署規則與策略規範 (Cloud Run Deployment Policy)

> **重要性**: P0 最高優先級規則。每次針對後端服務（`digital-garage-api`）進行 Google Cloud Run 部署時，**必須**嚴格讀取並遵循本規範，嚴禁自行提升資源規格或使用無約束之預設值。

---

## 1. 核心規格約束 (Hardware & Scaling Constraints)

| 設定項目 | 強制約束值 | 業務理由 / 規範依據 |
| :--- | :--- | :--- |
| **服務名稱** | `digital-garage-api` | 與既有 API 端點與前端連線完全對齊 |
| **部署區域 (Region)** | `us-central1` | 美國中部，與 Supabase 同區，實現零跨區流量費用 |
| **執行個體下限 (Min Instances)** | `0` | 無流量時完全縮容為零，避免閒置產生 vCPU 計費 |
| **執行個體上限 (Max Instances)** | `2` | 嚴格防範異常網路攻擊或無限擴展導致費用失控 |
| **處理器 (CPU)** | `1` | 輕量 Go 二進位編譯服務，1 vCPU 即可支撐充足併發 |
| **記憶體 (RAM)** | `256Mi` (256MB) | 極致輕量化，由 Distroless 容器保證低記憶體佔用 |
| **單一實例最大併發 (Concurrency)** | `80` | 標準併發限制 |
| **請求逾時 (Timeout)** | `300s` | 標準逾時限制 |

---

## 2. 部署操作標準作業程序 (SOP)

### 規範 A：優先使用專屬部署腳本
本專案已提供自動載入 `backend/cloudrun.env` 之部署腳本：
- **Windows (PowerShell)**:
  ```powershell
  # 進入 backend 目錄執行
  cd backend
  .\deploy.ps1
  # 或使用 dry-run 預覽
  .\deploy.ps1 -DryRun
  ```
- **Linux / macOS (Bash)**:
  ```bash
  cd backend
  chmod +x deploy.sh
  ./deploy.sh
  # 或使用 dry-run 預覽
  ./deploy.sh --dry-run
  ```

### 規範 B：手動命令部署門禁
若需以 `gcloud` CLI 手動執行部署，**命令必須完整包含下列旗標**，嚴禁省略：
```bash
gcloud run deploy digital-garage-api \
  --source backend \
  --region us-central1 \
  --min-instances 0 \
  --max-instances 2 \
  --cpu 1 \
  --memory 256Mi \
  --concurrency 80 \
  --timeout 300s \
  --allow-unauthenticated
```

### 規範 C：聲明式 YAML 覆蓋
亦可使用聲明式服務描述檔：
```bash
gcloud run services replace backend/cloudrun.service.yaml --region us-central1
```

---

## 3. 防呆與安全檢查清單 (Safety Checklist)

- [ ] 部署前已檢查 `backend/cloudrun.env` 是否存在。
- [ ] 執行個體下限維持 `0`，上限維持 `2`。
- [ ] CPU 為 `1`，RAM 為 `256Mi`。
- [ ] 區域維持 `us-central1`。
- [ ] 當前若使用者提示「已經部署好不要重新部署」時，**嚴禁**擅自觸發部署命令。
