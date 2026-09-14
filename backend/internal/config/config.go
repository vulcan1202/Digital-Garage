package config

import (
	"bufio"
	"os"
	"strings"
)

// Config 儲存後端伺服器運行所需之設定參數
type Config struct {
	Port              string
	DatabaseURL       string
	SupabaseURL       string
	SupabaseJWTSecret string
	JWKSEndpoint      string
}

// Load 載入設定，優先使用系統環境變數，並向下尋訪 .env 檔案作為預設值
func Load() *Config {
	loadDotEnv(".env")
	loadDotEnv("../.env")

	port := getEnv("PORT", "8080")
	dbURL := getEnv("DATABASE_URL", "")
	supabaseURL := getEnv("EXPO_PUBLIC_SUPABASE_URL", "https://hjuoactikekprjplrfgx.supabase.co")
	jwtSecret := getEnv("SUPABASE_JWT_SECRET", "")
	jwksURL := getEnv("SUPABASE_JWKS_URL", strings.TrimRight(supabaseURL, "/")+"/auth/v1/.well-known/jwks.json")

	return &Config{
		Port:              port,
		DatabaseURL:       dbURL,
		SupabaseURL:       supabaseURL,
		SupabaseJWTSecret: jwtSecret,
		JWKSEndpoint:      jwksURL,
	}
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return fallback
}

func loadDotEnv(filepath string) {
	f, err := os.Open(filepath)
	if err != nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			k := strings.TrimSpace(parts[0])
			v := strings.Trim(strings.TrimSpace(parts[1]), "\"'")
			if _, exists := os.LookupEnv(k); !exists {
				_ = os.Setenv(k, v)
			}
		}
	}
}
