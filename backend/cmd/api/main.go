package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"digital-garage-backend/internal/config"
	"digital-garage-backend/internal/database"
	"digital-garage-backend/internal/handler"
	"digital-garage-backend/internal/middleware"
	"digital-garage-backend/internal/repository"
	"digital-garage-backend/internal/response"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	cfg := config.Load()

	log.Printf("[數位車庫後端] 正在啟動，監聽端口: %s", cfg.Port)

	// 資料庫連線池初始化
	var pool *pgxpool.Pool
	if cfg.DatabaseURL != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		var err error
		pool, err = database.NewPool(ctx, cfg.DatabaseURL)
		if err != nil {
			log.Printf("[警告] 資料庫連線失敗: %v。請確認 DATABASE_URL 設定。", err)
		} else {
			defer pool.Close()
			log.Println("[資料庫] PostgreSQL 連線池初始化成功！")
		}
	} else {
		log.Println("[提示] 未設定 DATABASE_URL，資料庫模組將在設定後生效。")
	}

	r := chi.NewRouter()

	// 基礎中間件
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)

	// CORS 設定
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// API 路由
	r.Route("/api/v1", func(api chi.Router) {
		// 健康檢查 (免認證)
		api.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			dbStatus := "disconnected"
			if pool != nil {
				if err := pool.Ping(r.Context()); err == nil {
					dbStatus = "connected"
				}
			}
			response.JSON(w, http.StatusOK, map[string]any{
				"status":    "ok",
				"database":  dbStatus,
				"timestamp": time.Now().Format(time.RFC3339),
			})
		})

		// 受保護業務 API (強制 JWT 鑑權)
		api.Group(func(protected chi.Router) {
			protected.Use(middleware.AuthMiddleware(cfg))

			if pool != nil {
				vehicleRepo := repository.NewVehicleRepository(pool)
				vehicleHandler := handler.NewVehicleHandler(vehicleRepo)

				refuelRepo := repository.NewRefuelRepository(pool)
				refuelHandler := handler.NewRefuelHandler(refuelRepo)

				maintenanceRepo := repository.NewMaintenanceRepository(pool)
				maintenanceHandler := handler.NewMaintenanceHandler(maintenanceRepo)

				reminderRepo := repository.NewReminderRepository(pool)
				reminderHandler := handler.NewReminderHandler(reminderRepo)

				modificationRepo := repository.NewModificationRepository(pool)
				modificationHandler := handler.NewModificationHandler(modificationRepo)

				timelineRepo := repository.NewTimelineRepository(pool)
				timelineHandler := handler.NewTimelineHandler(timelineRepo)

				analyticsRepo := repository.NewAnalyticsRepository(pool)
				analyticsHandler := handler.NewAnalyticsHandler(analyticsRepo)

				protected.Route("/vehicles", func(vr chi.Router) {
					vehicleHandler.RegisterRoutes(vr)

					// 加油紀錄：依車輛查詢與新增
					vr.Get("/{vehicleId}/refuels", refuelHandler.List)
					vr.Post("/{vehicleId}/refuels", refuelHandler.Create)

					// 保養維修：依車輛查詢與新增
					vr.Get("/{vehicleId}/maintenance", maintenanceHandler.List)
					vr.Post("/{vehicleId}/maintenance", maintenanceHandler.Create)

					// 保養提醒：依車輛查詢與新增
					vr.Get("/{vehicleId}/reminders", reminderHandler.List)
					vr.Post("/{vehicleId}/reminders", reminderHandler.Create)

					// 改裝品：依車輛查詢與新增
					vr.Get("/{vehicleId}/modifications", modificationHandler.List)
					vr.Post("/{vehicleId}/modifications", modificationHandler.Create)

					// 愛車時間軸視圖：動態串流查詢
					vr.Get("/{vehicleId}/timeline", timelineHandler.GetTimeline)

					// 車輛持有與營運成本多維度分析 (P1-2 Cost Analytics)
					vr.Get("/{vehicleId}/analytics/cost", analyticsHandler.GetCostAnalytics)
				})

				// 加油紀錄：依紀錄 ID 更新與刪除
				protected.Route("/refuels", func(rr chi.Router) {
					rr.Patch("/{id}", refuelHandler.Update)
					rr.Delete("/{id}", refuelHandler.Delete)
				})

				// 保養維修：依工單 ID 更新與刪除，及相片操作
				protected.Route("/maintenance", func(mr chi.Router) {
					mr.Patch("/{id}", maintenanceHandler.Update)
					mr.Delete("/{id}", maintenanceHandler.Delete)
					mr.Post("/{id}/photos", maintenanceHandler.AddPhotos)
					mr.Delete("/photos/{photoId}", maintenanceHandler.DeletePhoto)
				})

				// 保養提醒：依提醒 ID 更新、刪除、完成(基準前移)，及工單基準同步
				protected.Route("/reminders", func(rer chi.Router) {
					rer.Patch("/{id}", reminderHandler.Update)
					rer.Delete("/{id}", reminderHandler.Delete)
					rer.Post("/{id}/complete", reminderHandler.Complete)
					rer.Post("/sync-base", reminderHandler.SyncBase)
				})

				// 改裝品：完整資訊查詢、更新、刪除、相片、設定組
				protected.Route("/modifications", func(mor chi.Router) {
					mor.Get("/{id}", modificationHandler.GetDetails)
					mor.Patch("/{id}", modificationHandler.Update)
					mor.Delete("/{id}", modificationHandler.Delete)
					mor.Post("/{id}/photos", modificationHandler.AddPhotos)
					mor.Delete("/photos/{photoId}", modificationHandler.DeletePhoto)
					mor.Post("/{id}/setting-sets", modificationHandler.CreateSettingSet)
					mor.Put("/{id}/setting-sets/{setId}/current", modificationHandler.SetCurrentSettingSet)
					mor.Patch("/{id}/setting-sets/{setId}", modificationHandler.UpdateSettingSet)
					mor.Delete("/{id}/setting-sets/{setId}", modificationHandler.DeleteSettingSet)
					mor.Post("/{id}/setting-sets/{setId}/clone", modificationHandler.CloneSettingSet)
				})
			}
		})
	})

	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// 優雅關機監聽
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("[伺服器] API 服務已就緒，網址: http://localhost:%s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[致命錯誤] 伺服器啟動異常: %v", err)
		}
	}()

	<-stop
	log.Println("[伺服器] 收到關機信號，正在優雅關閉...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("[錯誤] 優雅關閉伺服器異常: %v", err)
	}

	log.Println("[伺服器] 已安全關閉。")
}
