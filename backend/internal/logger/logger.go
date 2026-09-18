package logger

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"time"
)

// HTTPRequestLog 封裝 Google Cloud Logging 標準 httpRequest 結構體
type HTTPRequestLog struct {
	RequestMethod string `json:"requestMethod"`
	RequestURL    string `json:"requestUrl"`
	Status        int    `json:"status"`
	ResponseSize  int64  `json:"responseSize"`
	Latency       string `json:"latency"` // 格式必須為秒數字串帶 s 後綴 (例如 "0.125s")
}

// LogEntry 封裝結構化日誌參數
type LogEntry struct {
	Severity    string
	Message     string
	RequestID   string
	UserID      string
	HTTPRequest *HTTPRequestLog
	StackTrace  string
	Extra       map[string]any
}

// NewCloudLoggingHandler 建立符合 Google Cloud Run / Google Cloud Logging 規範之 slog.Handler
func NewCloudLoggingHandler(w io.Writer) *slog.JSONHandler {
	return slog.NewJSONHandler(w, &slog.HandlerOptions{
		AddSource: false,
		Level:     slog.LevelDebug,
		ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {
			// 1. 將 slog 預設 level 轉換為 Cloud Logging 標準 severity 欄位
			if a.Key == slog.LevelKey {
				level := a.Value.Any().(slog.Level)
				var severity string
				switch {
				case level >= slog.LevelError:
					severity = "ERROR"
				case level >= slog.LevelWarn:
					severity = "WARNING"
				default:
					severity = "INFO"
				}
				return slog.String("severity", severity)
			}

			// 2. 日誌時間戳記標準化為 RFC3339Nano
			if a.Key == slog.TimeKey {
				return slog.String("time", a.Value.Time().Format(time.RFC3339Nano))
			}

			// 3. message 欄位
			if a.Key == slog.MessageKey {
				return slog.String("message", a.Value.String())
			}

			return a
		},
	})
}

var defaultLogger *slog.Logger

func init() {
	defaultLogger = slog.New(NewCloudLoggingHandler(os.Stdout))
	slog.SetDefault(defaultLogger)
}

// SetDefaultOutput 用於測試時替換輸出標的
func SetDefaultOutput(w io.Writer) {
	defaultLogger = slog.New(NewCloudLoggingHandler(w))
	slog.SetDefault(defaultLogger)
}

// GetServiceMetadata 取得 Cloud Run 原生服務名稱與版本代號
func GetServiceMetadata() (service string, revision string) {
	service = os.Getenv("K_SERVICE")
	if service == "" {
		service = "digital-garage-api"
	}
	revision = os.Getenv("K_REVISION")
	if revision == "" {
		revision = "local"
	}
	return service, revision
}

// LogHTTPRequest 輸出單行符合 Cloud Logging 規範之 HTTP 請求結構化日誌
func LogHTTPRequest(ctx context.Context, entry LogEntry) {
	service, revision := GetServiceMetadata()

	attrs := []slog.Attr{
		slog.String("request_id", entry.RequestID),
		slog.String("service", service),
		slog.String("revision", revision),
	}

	if entry.UserID != "" {
		attrs = append(attrs, slog.String("user_id", entry.UserID))
	}

	if entry.HTTPRequest != nil {
		reqGroup := slog.Group("httpRequest",
			slog.String("requestMethod", entry.HTTPRequest.RequestMethod),
			slog.String("requestUrl", entry.HTTPRequest.RequestURL),
			slog.Int("status", entry.HTTPRequest.Status),
			slog.Int64("responseSize", entry.HTTPRequest.ResponseSize),
			slog.String("latency", entry.HTTPRequest.Latency),
		)
		attrs = append(attrs, reqGroup)
	}

	if entry.StackTrace != "" {
		attrs = append(attrs, slog.String("stack_trace", entry.StackTrace))
	}

	for k, v := range entry.Extra {
		attrs = append(attrs, slog.Any(k, v))
	}

	var level slog.Level
	switch entry.Severity {
	case "CRITICAL", "ERROR":
		level = slog.LevelError
	case "WARNING", "WARN":
		level = slog.LevelWarn
	default:
		level = slog.LevelInfo
	}

	msg := entry.Message
	if msg == "" {
		msg = "http_request"
	}

	defaultLogger.LogAttrs(ctx, level, msg, attrs...)
}

// FormatLatency 將 time.Duration 轉換為 Cloud Logging 要求之秒數字串帶 s (例如 "0.125s")
func FormatLatency(d time.Duration) string {
	return fmt.Sprintf("%.6fs", d.Seconds())
}
