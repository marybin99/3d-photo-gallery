import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import {
  createAdminGuestbookRepository,
  GUESTBOOK_PAGE_SIZE,
  type GuestbookFilter,
  type ManagedGuestbookEntry,
} from './adminGuestbookRepository';

const dateFormat = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const messageOf = (reason: unknown) =>
  reason instanceof Error ? reason.message : '방명록을 처리하지 못했습니다.';
export default function AdminGuestbook({ client }: { client: SupabaseClient }) {
  const repository = useMemo(
    () => createAdminGuestbookRepository(client),
    [client],
  );
  const [filter, setFilter] = useState<GuestbookFilter>('all');
  const [page, setPage] = useState(0);
  const [entries, setEntries] = useState<ManagedGuestbookEntry[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const sequence = useRef(0);
  const mounted = useRef(false);
  const mutation = useRef(false);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    setError('');
    try {
      const result = await repository.list(filter, page);
      if (!mounted.current || request !== sequence.current) return;
      if (page > 0 && page * GUESTBOOK_PAGE_SIZE >= result.count) {
        setPage(Math.max(0, Math.ceil(result.count / GUESTBOOK_PAGE_SIZE) - 1));
        return;
      }
      setEntries(result.entries);
      setCount(result.count);
    } catch (reason) {
      if (mounted.current && request === sequence.current)
        setError(messageOf(reason));
    } finally {
      if (mounted.current && request === sequence.current) setLoading(false);
    }
  }, [repository, filter, page]);
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      ++sequence.current;
    };
  }, [load]);
  async function moderate(
    entry: ManagedGuestbookEntry,
    action: 'show' | 'hide' | 'delete',
  ) {
    if (mutation.current) return;
    mutation.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await repository.moderate(entry, action);
      if (!mounted.current) return;
      setDeleting(null);
      setNotice(
        action === 'delete'
          ? '글을 삭제했습니다.'
          : action === 'hide'
            ? '글을 숨겼습니다.'
            : '글을 공개했습니다.',
      );
      await load();
    } catch (reason) {
      if (mounted.current) setError(messageOf(reason));
    } finally {
      mutation.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section
      className="admin-workspace"
      aria-labelledby="admin-guestbook-title"
    >
      <div className="admin-title">
        <div>
          <span className="eyebrow">VISITOR NOTES</span>
          <h1 id="admin-guestbook-title">방명록 관리</h1>
          <p>방문자의 글을 확인하고 공개 상태를 관리하세요.</p>
        </div>
        <button
          disabled={busy || loading}
          onClick={() => {
            setDeleting(null);
            void load();
          }}
        >
          새로고침
        </button>
      </div>
      <div className="admin-card">
        <label className="admin-filter">
          공개 상태
          <select
            value={filter}
            disabled={busy || loading}
            onChange={(event) => {
              setFilter(event.target.value as GuestbookFilter);
              setPage(0);
              setDeleting(null);
              setNotice('');
            }}
          >
            <option value="all">전체</option>
            <option value="visible">공개</option>
            <option value="hidden">숨김</option>
          </select>
        </label>
        <p className="admin-help">
          숨긴 글은 방문자에게 표시되지 않으며 다시 공개할 수 있습니다.
        </p>
        {notice && (
          <p className="admin-notice" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p role="status">방명록을 불러오는 중…</p>
        ) : !error && entries.length === 0 ? (
          <p className="admin-empty">
            {filter === 'hidden'
              ? '숨긴 글이 없습니다.'
              : filter === 'visible'
                ? '공개된 글이 없습니다.'
                : '아직 등록된 방명록이 없습니다.'}
          </p>
        ) : null}
        <div className="admin-guestbook-list" aria-busy={loading || busy}>
          {entries.map((entry) => (
            <article className="admin-guestbook-entry" key={entry.id}>
              <div className="admin-guestbook-meta">
                <strong>{entry.nickname}</strong>
                <span
                  className={`admin-guestbook-badge${entry.is_visible ? '' : ' is-hidden'}`}
                >
                  {entry.is_visible ? '공개' : '숨김'}
                </span>
                <time dateTime={entry.created_at}>
                  {dateFormat.format(new Date(entry.created_at))}
                </time>
              </div>
              <p className="admin-guestbook-message">{entry.message}</p>
              <div className="admin-actions">
                <button
                  disabled={busy || loading}
                  onClick={() => {
                    setDeleting(null);
                    void moderate(entry, entry.is_visible ? 'hide' : 'show');
                  }}
                >
                  {entry.is_visible ? '숨기기' : '다시 공개'}
                </button>
                <button
                  disabled={busy || loading}
                  onClick={() => { setError(''); setDeleting(entry.id); }}
                >
                  삭제
                </button>
              </div>
              {deleting === entry.id && (
                <DeleteConfirmDialog
                  busy={busy}
                  error={error}
                  onCancel={() => setDeleting(null)}
                  onConfirm={() => void moderate(entry, 'delete')}
                >
                  ‘{entry.nickname}’님의 글을 삭제합니다. 삭제하면 복구할 수 없습니다.
                </DeleteConfirmDialog>
              )}
            </article>
          ))}
        </div>
        <div className="admin-guestbook-pagination">
          <span>
            {count}개 · {page + 1} /{' '}
            {Math.max(1, Math.ceil(count / GUESTBOOK_PAGE_SIZE))} 페이지
          </span>
          <div className="admin-actions">
            <button
              disabled={busy || loading || page === 0}
              onClick={() => {
                setPage(page - 1);
                setDeleting(null);
              }}
            >
              이전
            </button>
            <button
              disabled={
                busy || loading || (page + 1) * GUESTBOOK_PAGE_SIZE >= count
              }
              onClick={() => {
                setPage(page + 1);
                setDeleting(null);
              }}
            >
              다음
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
