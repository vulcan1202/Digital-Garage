import { useState, useEffect } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
  });

  useEffect(() => {
    // 1. 初始化讀取當前 session (ExpoSecureStoreAdapter 自動還原)
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      setAuthState({
        user: data.session?.user ?? null,
        session: data.session,
        isLoading: false,
      });
    }).catch(() => {
      setAuthState({
        user: null,
        session: null,
        isLoading: false,
      });
    });

    // 2. 監聽驗證狀態異動 (登入、登出、Token 刷新)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setAuthState({
          user: session?.user ?? null,
          session,
          isLoading: false,
        });
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);


  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return {
    ...authState,
    signOut,
  };
}
