# Google Cloud Run 部署設定指南 (Digital Garage Backend)

本目錄包含數位車庫 Go 後端服務（`digital-garage-api`）部署至 Google Cloud Run 之所有標準化配置檔案。

## 檔案清單

- [`cloudrun.env`](./cloudrun.env)：中央參數設定檔，鎖定執行個體與硬體規格。
- [`cloudrun.service.yaml`](./cloudrun.service.yaml)：Knative / Cloud Run 聲明式服務描述檔。
- [`deploy.ps1`](./deploy.ps1)：Windows PowerShell 一鍵部署腳本（自動解析 `cloudrun.env`）。
- [`deploy.sh`](./deploy.sh)：Linux/macOS Bash 一鍵部署腳本（自動解析 `cloudrun.env`）。

## 強制約束規格

```ini
SERVICE_NAME=digital-garage-api
REGION=us-central1
MIN_INSTANCES=0
MAX_INSTANCES=2
CPU=1
MEMORY=256Mi
```

## 執行 Dry Run 預覽 (不實際部署)

- **PowerShell**:
  ```powershell
  .\deploy.ps1 -DryRun
  ```
- **Bash**:
  ```bash
  ./deploy.sh --dry-run
  ```
