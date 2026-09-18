import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { errorReporter } from '../services/errorReporter';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorCode: string;
  requestId?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorCode: '',
  };

  public static getDerivedStateFromError(_: Error): State {
    return {
      hasError: true,
      errorCode: 'ERR_UI_RENDER',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 捕捉例外並發送至 Sentry 相容層 (帶入 componentStack)
    errorReporter.captureException(error, {
      componentStack: errorInfo.componentStack || undefined,
    });
  }

  private handleRetry = () => {
    // 安全重置狀態：僅清除 hasError 觸發重新渲染，絕不清除 SecureStore 使用者登入 Session
    this.setState({
      hasError: false,
      errorCode: '',
      requestId: undefined,
    });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 bg-garage-bg items-center justify-center p-6">
          <View className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 items-center justify-center mb-6">
            <Ionicons name="warning-outline" size={32} color="#f59e0b" />
          </View>

          <Text className="text-metal-100 text-xl font-bold tracking-wider mb-2 text-center">
            車庫系統暫時異常
          </Text>

          <Text className="text-metal-400 text-sm text-center leading-6 mb-6">
            應用程式畫面載入遭遇未預期問題，請嘗試重新載入。若問題持續發生，請聯絡車庫維運團隊。
          </Text>

          {this.state.errorCode ? (
            <View className="bg-metal-900/80 border border-metal-800 rounded-lg px-4 py-2 mb-6">
              <Text className="text-metal-500 text-xs font-mono text-center">
                代碼: {this.state.errorCode}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={this.handleRetry}
            activeOpacity={0.8}
            className="w-full max-w-xs py-3.5 rounded-xl bg-metal-800 border border-metal-700 items-center justify-center"
          >
            <Text className="text-amber-500 font-bold tracking-widest text-sm uppercase">
              重新載入 (Try Again)
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}
