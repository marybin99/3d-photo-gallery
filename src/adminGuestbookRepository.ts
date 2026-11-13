import type { SupabaseClient } from '@supabase/supabase-js';
import type { GuestbookEntry } from '../supabase/functions/_shared/guestbook.ts';

export type ManagedGuestbookEntry = GuestbookEntry & { is_visible: boolean };
export type GuestbookFilter = 'all' | 'visible' | 'hidden';
export const GUESTBOOK_PAGE_SIZE = 20;
const columns = 'id,nickname,message,created_at,is_visible';

function databaseError(error: { code?: string; message: string }) {
  if (error.code === '42501')
    return new Error(
      '운영자 권한이 없거나 세션이 만료되었습니다. 다시 로그인해 주세요.',
    );
  if (error.code === 'PGRST116' || error.message.includes('GUESTBOOK_CONFLICT'))
    return new Error(
      '다른 곳에서 글이 변경되거나 삭제되었습니다. 목록을 새로고침해 주세요.',
    );
  return new Error(
    '방명록을 처리하지 못했습니다. 연결 상태와 방명록 관리 SQL 적용 여부를 확인해 주세요.',
  );
}
export function createAdminGuestbookRepository(client: SupabaseClient) {
  return {
    async list(filter: GuestbookFilter, page: number) {
      let query = client
        .from('guestbook_entries')
        .select(columns, { count: 'exact' })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(
          page * GUESTBOOK_PAGE_SIZE,
          (page + 1) * GUESTBOOK_PAGE_SIZE - 1,
        );
      if (filter !== 'all')
        query = query.eq('is_visible', filter === 'visible');
      const { data, error, count } = await query;
      if (error) throw databaseError(error);
      return {
        entries: (data ?? []) as ManagedGuestbookEntry[],
        count: count ?? 0,
      };
    },
    async moderate(
      entry: ManagedGuestbookEntry,
      action: 'show' | 'hide' | 'delete',
    ) {
      const { data, error } = await client
        .rpc('moderate_guestbook', {
          p_id: entry.id,
          p_action: action,
          p_expected_visible: entry.is_visible,
        })
        .single();
      if (error) throw databaseError(error);
      if (!data)
        throw new Error(
          '글이 변경되거나 삭제되었습니다. 목록을 새로고침해 주세요.',
        );
      return data as ManagedGuestbookEntry;
    },
  };
}
