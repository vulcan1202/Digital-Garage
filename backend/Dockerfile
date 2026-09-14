# Build Stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

# 快取依賴層
COPY go.mod go.sum ./
RUN go mod download

# 編譯靜態二進位檔
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-w -s" -o server ./cmd/api

# Run Stage (使用極簡 distroless 確保體積與安全性)
FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /
COPY --from=builder /app/server /server

# Cloud Run 會動態注入 PORT 環境變數
ENV PORT=8080
EXPOSE 8080

USER nonroot:nonroot

ENTRYPOINT ["/server"]