# ==========================================
# 1. Build Stage (建置階段)
# ==========================================
FROM golang:alpine AS builder

# 安裝編譯所需之基礎工具與憑證套件 (含 git, ca-certificates, tzdata)
RUN apk add --no-cache ca-certificates tzdata git

WORKDIR /app

# 快取依賴層 (利用 Docker Layer Cache 機制加速後續建置)
COPY go.mod go.sum ./
RUN go mod download

# 複製其餘原始碼
COPY . .

# 編譯極小化靜態二進位檔
# - CGO_ENABLED=0: 禁用 CGO，確保跨平台純靜態連結
# - GOOS=linux: 目標系統為 Linux
# - -trimpath: 移除二進位檔中的本地檔案系統路徑
# - -ldflags="-w -s": 去除除錯資訊與符號表，顯著縮減二進位體積
RUN CGO_ENABLED=0 GOOS=linux go build \
    -trimpath \
    -ldflags="-w -s" \
    -o /app/server ./cmd/api

# ==========================================
# 2. Production Stage (極簡安全生產階段)
# ==========================================
# 使用 Google Distroless static nonroot 映像檔：
# - 零 Shell、零套件管理器，大幅縮小攻擊面
# - 自帶 nonroot (uid: 65532) 遵循最小權限原則
FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /

# 複製 CA 憑證 (確保對 Supabase HTTPS / JWKS 外部呼叫之安全性)
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# 複製時區資訊 (方便記錄日誌與時區對齊)
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

# 複製已編譯完成之伺服器執行檔
COPY --from=builder /app/server /server

# 容器預設環境變數 (可由 Cloud Run、K8s 或 Docker run 覆蓋)
ENV PORT=8080 \
    APP_ENV=production \
    TZ=Asia/Taipei

# 宣告服務端口
EXPOSE 8080

# 切換為最小權限之 nonroot 使用者 (UID: 65532)
USER nonroot:nonroot

# 容器啟動指令
ENTRYPOINT ["/server"]