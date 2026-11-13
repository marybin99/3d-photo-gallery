import { useEffect, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

export function useAdminSession(client: SupabaseClient) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [access, setAccess] = useState<{
    userId: string;
    allowed: boolean;
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
    void client.rpc('is_gallery_admin').then(
      ({ data, error }) => {
        if (!canceled)
          setAccess({
            userId: session.user.id,
            allowed: data === true && !error,
            error: error
              ? '운영자 권한을 확인하지 못했습니다. DB 초기 설정과 연결 상태를 확인해 주세요.'
              : '',
          });
      },
      () => {
        if (!canceled)
          setAccess({
            userId: session.user.id,
            allowed: false,
            error:
              '운영자 권한을 확인하지 못했습니다. DB 초기 설정과 연결 상태를 확인해 주세요.',
          });
      },
    );
    return () => {
      canceled = true;
    };
  }, [client, session, retry]);
  const checkError = access?.error
    ? '운영자 권한을 확인하지 못했습니다. DB 초기 설정과 연결 상태를 확인해 주세요.'
    : '';
  return {
    session,
    loading:
      session === undefined ||
      (!!session && (!access || access.userId !== session.user.id)),
    allowed: !!session && access?.userId === session.user.id && access.allowed,
    error: authError || checkError,
    retry: () => setRetry((value) => value + 1),
    async signIn(email: string, password: string) {
      setAuthError('');
      const { error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error)
        throw new Error(
          '로그인하지 못했습니다. 이메일·비밀번호와 연결 상태를 확인해 주세요.',
        );
    },
    async signOut() {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error)
        setAuthError('로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    },
  };
}
