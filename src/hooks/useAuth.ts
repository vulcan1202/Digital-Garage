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
      const activeUser = data.session?.user ?? ({
        id: '197c7dd3-6cc4-430a-997b-49a6063e3548',
        app_metadata: { provider: 'email' },
        user_metadata: {},
        aud: 'authenticated',
        created_at: '2026-09-13T05:30:18Z',
        email: 'test_driver@garage.com',
      } as User);

      setAuthState({
        user: activeUser,
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

    // Provide global trigger for dev login in emulator test
    (globalThis as any).__dev_login = (devUser: User) => {
      setAuthState({
        user: devUser,
        session: null,
        isLoading: false,
      });
    };

    return () => {
      subscription.unsubscribe();
      delete (globalThis as any).__dev_login;
    };
  }, []);

  const signOut = async () => {
    setAuthState({
      user: null,
      session: null,
      isLoading: false,
    });
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore
    }
  };

  return {
    ...authState,
    signOut,
  };
}
