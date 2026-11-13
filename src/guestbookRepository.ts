import type { SupabaseClient } from '@supabase/supabase-js';
import {
  uuidPattern,
  validateGuestbookText,
  type GuestbookEntry,
} from '../supabase/functions/_shared/guestbook.ts';

let memoryClientId = '';
export function guestbookClientId() {
  if (memoryClientId) return memoryClientId;
  try {
    const saved = localStorage.getItem('gallery-guestbook-client-id');
    if (saved && uuidPattern.test(saved)) return (memoryClientId = saved);
  } catch {
    /* Storage-disabled browsers still get a per-page identifier. */
  }
  memoryClientId = crypto.randomUUID();
  try {
    localStorage.setItem('gallery-guestbook-client-id', memoryClientId);
  } catch {
    /* Keep the in-memory ID. */
  }
  return memoryClientId;
}
export function createGuestbookRepository(client: SupabaseClient) {
  return {
    async list(): Promise<GuestbookEntry[]> {
      const { data, error } = await client
        .from('guestbook_entries')
        .select('id,nickname,message,created_at')
        .eq('is_visible', true)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error)
        throw new Error('방명록을 불러오지 못했습니다. 다시 시도해 주세요.');
      return data ?? [];
    },
    async submit(input: {
      nickname: string;
      message: string;
      clientId: string;
      requestId: string;
      website: string;
      token: string;
    }): Promise<GuestbookEntry> {
      const text = validateGuestbookText(input.nickname, input.message);
      const { data, error } = await client.functions.invoke(
        'guestbook-submit',
        { body: { ...input, ...text }, signal: AbortSignal.timeout(20000) },
      );
      if (error) {
        if ('context' in error && error.context instanceof Response) {
          const status = error.context.status;
          // Log only the category/status, never headers, keys or the submitted note.
          console.warn('Guestbook function request failed', { kind: error.name, status });
          const body = await error.context.json().catch(() => null);
          if (body && typeof body.error === 'string')
            throw new Error(body.error);
          if (status === 401)
            throw new Error('방명록 서버가 인증 요청을 거부했습니다. 운영자에게 문의해 주세요. (401)');
          if (status === 403)
            throw new Error('이 사이트에서는 방명록 등록이 허용되지 않았습니다. (403)');
          if (status === 404)
            throw new Error('방명록 등록 서버를 찾을 수 없습니다. 운영자에게 문의해 주세요. (404)');
          if (status >= 500)
            throw new Error(`방명록 서버가 정상적으로 응답하지 않았습니다. 잠시 후 다시 시도해 주세요. (${status})`);
        }
        if (error.name === 'FunctionsFetchError')
          throw new Error('방명록 서버에 연결할 수 없습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.');
        throw new Error(
          '방명록을 등록하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.',
        );
      }
      const entry = data?.entry as GuestbookEntry | undefined;
      if (
        !entry ||
        !uuidPattern.test(entry.id) ||
        typeof entry.nickname !== 'string' ||
        typeof entry.message !== 'string' ||
        typeof entry.created_at !== 'string'
      )
        throw new Error(
          '등록 결과를 확인하지 못했습니다. 같은 내용으로 다시 시도해 주세요.',
        );
      return entry;
    },
  };
}
