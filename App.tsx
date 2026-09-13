import React, { useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './src/hooks/useAuth';
import { AuthScreen } from './src/screens/AuthScreen';
import { GarageDashboardScreen } from './src/screens/GarageDashboardScreen';
import { VehicleTimelineScreen } from './src/screens/VehicleTimelineScreen';
import { ModificationDetailScreen } from './src/screens/ModificationDetailScreen';

import './global.css';

// 建立全域 QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 分鐘快取
      retry: 1,
    },
  },
});

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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <SafeAreaView className="flex-1 bg-garage-bg" edges={['top', 'left', 'right']}>
          <StatusBar style="light" />
          <MainNavigator />
        </SafeAreaView>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

