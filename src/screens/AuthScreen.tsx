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
import { isEmailAlreadyRegistered } from '../utils/authHelpers';

export const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const VERIFIED_REDIRECT_URL = 'https://vulcan1202.github.io/Digital-Garage/verified.html';

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
          // 精確使用 error.code 判斷信箱未驗證，提供重新寄發驗證信按鈕
          if (error.code === 'email_not_confirmed') {
            Alert.alert(
              '電子信箱尚未驗證',
              '此帳號尚未完成信箱啟用驗證。請至您的電子信箱點擊確認信中的連結後再進行登入。\n\n若未收到驗證信，可點擊下方按鈕重新發送。',
              [
                { text: '稍後再試', style: 'cancel' },
                {
                  text: '重新發送驗證信',
                  onPress: async () => {
                    setIsLoading(true);
                    try {
                      const { error: resendErr } = await supabase.auth.resend({
                        type: 'signup',
                        email: email.trim(),
                        options: {
                          emailRedirectTo: VERIFIED_REDIRECT_URL,
                        },
                      });
                      if (resendErr) {
                        if (resendErr.code === 'over_email_send_rate_limit') {
                          Alert.alert('發送頻率過高', '系統已在短時間內發送過驗證信件。為防止郵件濫用，請稍候約 1~2 分鐘後再試。');
                        } else {
                          Alert.alert('發送失敗', resendErr.message);
                        }
                      } else {
                        Alert.alert('已重新發送', '新的驗證信已寄出，請前往信箱查收。');
                      }
                    } finally {
                      setIsLoading(false);
                    }
                  },
                },
              ]
            );
            return;
          }

          let errorTitle = '登入失敗';
          let errorMessage = '帳號或密碼不正確，請重新檢查後再試。';

          const msg = (error.message || '').toLowerCase();
          if (msg.includes('invalid login credentials') || msg.includes('invalid_grant')) {
            errorMessage = '帳號或密碼輸入錯誤，請確認後重新輸入。';
          } else if (msg.includes('user not found')) {
            errorMessage = '找不到此車主帳號，請確認信箱是否正確或先切換至「註冊新車主」。';
          } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) {
            errorTitle = '連線異常';
            errorMessage = '無法連線至車庫雲端伺服器，請檢查您的網路連線狀態。';
          } else if (msg.includes('too many requests')) {
            errorTitle = '嘗試次數過多';
            errorMessage = '登入嘗試次數過於頻繁，為保護帳號安全，請稍後幾分鐘後再試。';
          } else {
            errorMessage = error.message || errorMessage;
          }

          Alert.alert(errorTitle, errorMessage);
        }
      } else {
        const { error, data } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            emailRedirectTo: VERIFIED_REDIRECT_URL,
          },
        });
        // 優先檢查是否為「信箱已被註冊」情境
        if (isEmailAlreadyRegistered(error, data)) {
          Alert.alert(
            '此信箱已被註冊',
            `電子信箱「${email.trim()}」已經註冊過數位車庫帳號。\n\n請直接使用密碼登入；若尚未完成信箱驗證，可在登入畫面點擊「重新發送驗證信」。`,
            [
              { text: '稍後', style: 'cancel' },
              { text: '前往登入', onPress: () => setMode('login') },
            ]
          );
          return;
        }

        if (error) {
          if (error.code === 'over_email_send_rate_limit') {
            Alert.alert(
              '發送頻率過高',
              '系統已在短時間內發送過驗證信件。為防止郵件濫用，請稍候約 1~2 分鐘後再試，或先檢查您的垃圾郵件信匣。'
            );
          } else {
            Alert.alert('註冊失敗', error.message || '請確認輸入資訊。');
          }
        } else if (data.session) {
          Alert.alert('註冊成功', '已自動登入數位車庫。');
        } else {
          Alert.alert(
            '驗證信已寄出',
            `系統已發送驗證信至 ${email.trim()}。\n\n請至信箱點擊連結完成驗證後，返回此畫面輸入帳號密碼登入。`,
            [{ text: '我知道了', onPress: () => setMode('login') }]
          );
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
