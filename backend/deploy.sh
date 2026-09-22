#!/usr/bin/env bash
# ==============================================================================
# Google Cloud Run 自動部署腳本 (Bash)
# 自動載入同目錄下的 cloudrun.env 設定檔，並以鎖定規格進行 Cloud Run 服務部署：
# - 執行個體數量下限: 0 (Min Instances)
# - 執行個體數量上限: 2 (Max Instances)
# - CPU: 1
# - RAM: 256MB (256Mi)
# - 區域: us-central1
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/cloudrun.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "✖ 找不到 Cloud Run 部署設定檔: $ENV_FILE" >&2
  exit 1
fi

echo "=================================================="
echo " Google Cloud Run 部署程序 (Digital Garage Backend)"
echo "=================================================="

# 載入 cloudrun.env
set -a
source "$ENV_FILE"
set +a

SERVICE_NAME="${SERVICE_NAME:-digital-garage-api}"
REGION="${REGION:-us-central1}"
MIN_INSTANCES="${MIN_INSTANCES:-0}"
MAX_INSTANCES="${MAX_INSTANCES:-2}"
CPU="${CPU:-1}"
MEMORY="${MEMORY:-256Mi}"
CONCURRENCY="${CONCURRENCY:-80}"
TIMEOUT="${TIMEOUT:-300s}"

echo "▶ 讀取部署規格 (cloudrun.env):"
echo "  - 服務名稱: $SERVICE_NAME"
echo "  - 部署區域: $REGION"
echo "  - 執行個體下限: $MIN_INSTANCES"
echo "  - 執行個體上限: $MAX_INSTANCES"
echo "  - 處理器 (CPU): $CPU"
echo "  - 記憶體 (RAM): $MEMORY"
echo "  - 併發量: $CONCURRENCY"
echo "  - 逾時: $TIMEOUT"
echo ""

if [[ "${1:-}" == "--dry-run" ]]; then
  echo "[DRY RUN] 預覽即將執行的指令:"
  echo "gcloud run deploy \"$SERVICE_NAME\" \\"
  echo "  --source \"$SCRIPT_DIR\" \\"
  echo "  --region \"$REGION\" \\"
  echo "  --min-instances \"$MIN_INSTANCES\" \\"
  echo "  --max-instances \"$MAX_INSTANCES\" \\"
  echo "  --cpu \"$CPU\" \\"
  echo "  --memory \"$MEMORY\" \\"
  echo "  --concurrency \"$CONCURRENCY\" \\"
  echo "  --timeout \"$TIMEOUT\" \\"
  echo "  --allow-unauthenticated"
  exit 0
fi

echo "▶ 正在執行 Cloud Run 部署..."
gcloud run deploy "$SERVICE_NAME" \
  --source "$SCRIPT_DIR" \
  --region "$REGION" \
  --min-instances "$MIN_INSTANCES" \
  --max-instances "$MAX_INSTANCES" \
  --cpu "$CPU" \
  --memory "$MEMORY" \
  --concurrency "$CONCURRENCY" \
  --timeout "$TIMEOUT" \
  --allow-unauthenticated

echo "✔ Cloud Run 部署成功完成！"
