import { useEffect, useState } from 'react';
import { loginEmail } from '../supabase/functions/_shared/adminAccount.ts';
import { parseAccess, type AdminAccess } from './adminAccess.ts';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

export function useAdminSession(client: SupabaseClient) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [access, setAccess] = useState<{
    userId: string;
    allowed: boolean;
    permissions: AdminAccess | null;
    error: string;
  } | null>(null);
  const [authError, setAuthError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    // Never await Supabase calls inside this callback: Auth holds its session lock.
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setAuthError('');
      setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, [client]);
  useEffect(() => {
    if (!session) {
      setAccess(null);
      return;
    }
    let canceled = false;
    // Keep same-user access while refreshing the token. A user switch is still
    // gated by the userId comparison below, and every write is checked by RLS.
    void client.rpc('gallery_access').then(
      ({ data, error }) => {
        if (!canceled)
          setAccess({
            userId: session.user.id,
            allowed: !!parseAccess(data)?.is_active && !error,
            permissions: error ? null : parseAccess(data),
            error: error
              ? '운영자 권한을 확인하지 못했습니다. 계정 권한 SQL 적용 여부와 연결 상태를 확인해 주세요.'
              : '',
          });
      },
      () => {
        if (!canceled)
          setAccess({
            userId: session.user.id,
            allowed: false,
            permissions: null,
            error:
              '운영자 권한을 확인하지 못했습니다. 계정 권한 SQL 적용 여부와 연결 상태를 확인해 주세요.',
          });
      },
    );
    return () => {
      canceled = true;
    };
  }, [client, session, retry]);
  useEffect(() => {
    if (!session || typeof window === 'undefined') return;
    const refresh = () => setRetry((value) => value + 1);
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener('focus', refresh);
      window.clearInterval(timer);
    };
  }, [session]);
  const checkError = access?.error
    ? '운영자 권한을 확인하지 못했습니다. 계정 권한 SQL 적용 여부와 연결 상태를 확인해 주세요.'
    : '';
  return {
    session,
    permissions:
      session && access?.userId === session.user.id ? access.permissions : null,
    loading:
      session === undefined ||
      (!!session && (!access || access.userId !== session.user.id)),
    allowed: !!session && access?.userId === session.user.id && access.allowed,
    error: authError || checkError,
    retry: () => setRetry((value) => value + 1),
    async signIn(username: string, password: string) {
      setAuthError('');
      const { error } = await client.auth.signInWithPassword({
        email: loginEmail(username),
        password,
      });
      if (error)
        throw new Error(
          '로그인하지 못했습니다. 아이디·비밀번호와 연결 상태를 확인해 주세요.',
        );
    },
    async signOut() {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error)
        setAuthError('로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    },
  };
}
