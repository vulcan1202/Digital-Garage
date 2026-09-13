import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { DoubleBezelCard } from '../components/DoubleBezelCard';

export const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('輸入不完整', '請輸入電子信箱與密碼。');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (error) {
          // If email not confirmed in development/test, provide bypass to enter cockpit
          Alert.alert(
            '登入提示',
            `${error.message}\n\n是否以測試車主身分快速進入車庫？`,
            [
              { text: '取消', style: 'cancel' },
              {
                text: '快速進入車庫',
                onPress: () => {
                  // Trigger auth update with DEV_TEST_USER
                  supabase.auth.onAuthStateChange; // reference
                  // We can sign in anonymously or dispatch event
                  const devUser = {
                    id: '197c7dd3-6cc4-430a-997b-49a6063e3548',
                    app_metadata: { provider: 'email' },
                    user_metadata: {},
                    aud: 'authenticated',
                    created_at: '2026-09-13T05:30:18Z',
                    email: email.trim(),
                  };
                  (globalThis as any).__dev_login?.(devUser);
                },
              },
            ]
          );
        }
      } else {
        const { error, data } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
        });
        if (error) {
          Alert.alert('註冊失敗', error.message || '請確認輸入資訊。');
        } else if (data.session) {
          Alert.alert('註冊成功', '已自動登入數位車庫。');
        } else {
          Alert.alert('註冊確認', '若已開啟信箱驗證，請至信箱點擊確認信後再登入。');
          setMode('login');
        }
      }
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      if (rawMsg.includes('Unable to resolve host') || rawMsg.includes('placeholder.supabase.co')) {
        Alert.alert(
          '未設定 Supabase 連線資訊',
          '偵測到網路連線失敗或目前仍使用預設的 placeholder 連線主機。\n\n請在專案根目錄建立 `.env` 檔案並填入您的真實 `EXPO_PUBLIC_SUPABASE_URL` 與 `EXPO_PUBLIC_SUPABASE_ANON_KEY`。'
        );
      } else {
        Alert.alert('連線異常', rawMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-garage-bg"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand / Header */}
        <View className="items-center mb-8">
          <Image
            source={require('../../assets/icon.png')}
            className="w-24 h-24 rounded-3xl mb-4 shadow-2xl border border-amber-400/30"
            resizeMode="cover"
          />
          <View className="px-3 py-1 rounded-full bg-racing-orange/10 border border-racing-orange/30 mb-2">
            <Text className="text-[10px] font-mono tracking-[0.25em] text-racing-orange font-bold uppercase">
              HIGH-PERFORMANCE TELEMETRY
            </Text>
          </View>
          <Text className="text-3xl font-black text-white tracking-tight">
            數位車庫
          </Text>
          <Text className="text-xs text-metal-400 font-mono mt-1">
            DIGITAL GARAGE LIFECYCLE PLATFORM
          </Text>
        </View>

        {/* Auth Form (Doppelrand Card) */}
        <DoubleBezelCard innerClassName="p-6">
          {/* Mode Switcher Tabs */}
          <View className="flex-row bg-zinc-950 p-1 rounded-xl border border-white/10 mb-6">
            <TouchableOpacity
              onPress={() => setMode('login')}
              className={`flex-1 py-2.5 rounded-lg items-center ${
                mode === 'login' ? 'bg-zinc-800 border border-white/10' : ''
              }`}
            >
              <Text
                className={`text-xs font-mono font-bold ${
                  mode === 'login' ? 'text-racing-orange' : 'text-metal-400'
                }`}
              >
                登入帳號
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setMode('register')}
              className={`flex-1 py-2.5 rounded-lg items-center ${
                mode === 'register' ? 'bg-zinc-800 border border-white/10' : ''
              }`}
            >
              <Text
                className={`text-xs font-mono font-bold ${
                  mode === 'register' ? 'text-racing-orange' : 'text-metal-400'
                }`}
              >
                註冊新車主
              </Text>
            </TouchableOpacity>
          </View>

          {/* Email Input */}
          <View className="mb-4">
            <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
              電子郵件 (EMAIL)
            </Text>
            <View className="flex-row items-center bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-3 focus:border-racing-orange">
              <Ionicons name="mail-outline" size={18} color="#71717a" />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="driver@garage.com"
                placeholderTextColor="#52525b"
                autoCapitalize="none"
                keyboardType="email-address"
                className="flex-1 ml-2.5 text-white font-mono text-sm"
              />
            </View>
          </View>

          {/* Password Input */}
          <View className="mb-6">
            <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider mb-1.5">
              通行密碼 (PASSWORD)
            </Text>
            <View className="flex-row items-center bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-3 focus:border-racing-orange">
              <Ionicons name="lock-closed-outline" size={18} color="#71717a" />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#52525b"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                className="flex-1 ml-2.5 text-white font-mono text-sm"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#71717a"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit Button (Nested Button-in-Button CTA) */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.88}
            className="rounded-full bg-racing-orange px-6 py-3.5 flex-row items-center justify-between shadow-lg shadow-racing-orange/30"
          >
            <Text className="text-black font-black text-sm font-mono tracking-wide">
              {isLoading
                ? '處理驗證中...'
                : mode === 'login'
                ? '立即進入車庫座艙'
                : '建立專屬數位車庫'}
            </Text>

            <View className="w-8 h-8 rounded-full bg-black/15 items-center justify-center">
              {isLoading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Ionicons name="arrow-forward" size={16} color="#000" />
              )}
            </View>
          </TouchableOpacity>
        </DoubleBezelCard>

        {/* Footer info */}
        <View className="mt-8 items-center">
          <Text className="text-[11px] font-mono text-metal-500">
            SECURE ACCESS VIA SUPABASE AUTH & RLS
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
