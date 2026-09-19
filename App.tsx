import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Text, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { useAuth } from './src/hooks/useAuth';
import { AuthScreen } from './src/screens/AuthScreen';
import { GarageDashboardScreen } from './src/screens/GarageDashboardScreen';
import { VehicleTimelineScreen } from './src/screens/VehicleTimelineScreen';
import { ModificationDetailScreen } from './src/screens/ModificationDetailScreen';
import { syncQueue } from './src/services/syncQueue';
import { networkMonitor } from './src/services/networkMonitor';
import { errorReporter } from './src/services/errorReporter';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { AppError } from './src/services/errors/AppError';
import { LanguageProvider } from './src/context/LanguageContext';
import { useLanguage } from './src/hooks/useLanguage';

import './global.css';

// 建立全域 QueryClient 並掛載異常觀測快取
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (!errorReporter.isSuppressedError(error)) {
        errorReporter.captureException(error, {
          queryKey: query.queryKey,
          requestId: (error as AppError)?.requestId,
        });
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (!errorReporter.isSuppressedError(error)) {
        errorReporter.captureException(error, {
          mutationKey: mutation.options.mutationKey,
          requestId: (error as AppError)?.requestId,
        });
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 分鐘快取
      retry: 1,
    },
  },
});

// 連結 SyncQueue 與 TanStack Query
syncQueue.setQueryClient(queryClient);

type ActiveScreen =
  | { name: 'dashboard' }
  | { name: 'timeline'; vehicleId: number }
  | { name: 'modificationDetail'; modId: number };

function MainNavigator() {
  const { user, isLoading, signOut } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<ActiveScreen>({ name: 'dashboard' });

  const handleSignOut = async () => {
    queryClient.clear(); // 清除所有快取，防止不同使用者切換殘留
    await signOut();
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-garage-bg items-center justify-center">
        <ActivityIndicator size="large" color="#ff6b00" />
        <Text className="text-metal-400 mt-4 text-xs font-mono tracking-widest uppercase">
          Verifying Garage Security Session...
        </Text>
      </View>
    );
  }

  // 若未登入，直接呈現登入/註冊畫面
  if (!user) {
    return <AuthScreen />;
  }

  return (
    <>
      {currentScreen.name === 'dashboard' && (
        <GarageDashboardScreen
          onNavigateToTimeline={(vehicleId) =>
            setCurrentScreen({ name: 'timeline', vehicleId })
          }
          onNavigateToModDetail={(modId) =>
            setCurrentScreen({ name: 'modificationDetail', modId })
          }
          onSignOut={handleSignOut}
        />
      )}


      {currentScreen.name === 'timeline' && (
        <VehicleTimelineScreen
          vehicleId={currentScreen.vehicleId}
          onBack={() => setCurrentScreen({ name: 'dashboard' })}
          onNavigateToModDetail={(modId) =>
            setCurrentScreen({ name: 'modificationDetail', modId })
          }
        />
      )}

      {currentScreen.name === 'modificationDetail' && (
        <ModificationDetailScreen
          modificationId={currentScreen.modId}
          onBack={() => setCurrentScreen({ name: 'dashboard' })}
        />
      )}
    </>
  );
}

function AppContent() {
  const { isHydrated } = useLanguage();

  if (!isHydrated) {
    return (
      <View className="flex-1 bg-garage-bg items-center justify-center">
        <ActivityIndicator size="large" color="#ff6b00" />
        <Text className="text-metal-400 mt-4 text-xs font-mono tracking-widest uppercase">
          Initializing Language Engine...
        </Text>
      </View>
    );
  }

  return <MainNavigator />;
}

export default function App() {
  useEffect(() => {
    // 啟動時初始化錯誤回報服務、水合離線佇列並檢查後端連線
    errorReporter.init();
    syncQueue.hydrate();
    networkMonitor.checkConnectivity();

    const sub = AppState.addEventListener('change', (state) => {
      networkMonitor.handleAppStateChange(state);
    });
    return () => {
      sub.remove();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <SafeAreaView className="flex-1 bg-garage-bg" edges={['top', 'left', 'right']}>
          <StatusBar style="light" />
          <ErrorBoundary>
            <LanguageProvider>
              <AppContent />
            </LanguageProvider>
          </ErrorBoundary>
        </SafeAreaView>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

