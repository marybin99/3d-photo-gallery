import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { demoRead, demoWrite, supabase } from './supabase';
import {
  createGuestbookRepository,
  guestbookClientId,
} from './guestbookRepository';
import {
  validateGuestbookText,
  type GuestbookEntry,
} from '../supabase/functions/_shared/guestbook.ts';
import Turnstile from './Turnstile';

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
export default function Guestbook({ onClose }: { onClose: () => void }) {
  const repository = useMemo(
    () => (supabase ? createGuestbookRepository(supabase) : null),
    [],
  );
  const [items, setItems] = useState<GuestbookEntry[]>([]);
  const [name, setName] = useState(''),
    [message, setMessage] = useState(''),
    [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [error, setError] = useState(''),
    [loadError, setLoadError] = useState(''),
    [notice, setNotice] = useState('');
  const [token, setToken] = useState(''),
    [resetKey, setResetKey] = useState(0);
  const sending = useRef(false),
    mounted = useRef(true),
    generation = useRef(0);
  const attempt = useRef<{ content: string; id: string } | null>(null);
  const reload = useCallback(async () => {
    const id = ++generation.current;
    setLoading(true);
    setLoadError('');
    try {
      const next = repository ? await repository.list() : demoRead();
      if (mounted.current && id === generation.current) setItems(next);
    } catch (reason) {
      if (mounted.current && id === generation.current)
        setLoadError(
          reason instanceof Error
            ? reason.message
            : '방명록을 불러오지 못했습니다.',
        );
    } finally {
      if (mounted.current && id === generation.current) setLoading(false);
    }
  }, [repository]);
  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
      ++generation.current;
    };
  }, [reload]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending.current) return;
    setError('');
    setNotice('');
    let text: ReturnType<typeof validateGuestbookText>;
    try {
      text = validateGuestbookText(name, message);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : '내용을 확인해 주세요.',
      );
      return;
    }
    if (repository && siteKey && !token) {
      setError('방문자 인증을 완료해 주세요.');
      return;
    }
    sending.current = true;
    setBusy(true);
    const content = JSON.stringify(text);
    if (attempt.current?.content !== content)
      attempt.current = { content, id: crypto.randomUUID() };
    try {
      const entry = repository
        ? await repository.submit({
            ...text,
            clientId: guestbookClientId(),
            requestId: attempt.current.id,
            website,
            token,
          })
        : demoWrite(text.nickname, text.message);
      if (!mounted.current) return;
      // Do not let a slow initial read replace the just-submitted entry.
      ++generation.current;
      setLoading(false);
      setLoadError('');
      setItems((previous) =>
        [entry, ...previous.filter((item) => item.id !== entry.id)].slice(
          0,
          50,
        ),
      );
      setName('');
      setMessage('');
      setNotice('방명록을 남겼습니다. 방문해 주셔서 감사합니다.');
      attempt.current = null;
    } catch (reason) {
      if (mounted.current)
        setError(
          reason instanceof Error
            ? reason.message
            : '등록하지 못했습니다. 다시 시도해 주세요.',
        );
    } finally {
      sending.current = false;
      if (mounted.current) {
        setBusy(false);
        setToken('');
        setResetKey((value) => value + 1);
      }
    }
  }
  return (
    <div className="overlay" onMouseDown={onClose}>
      <section
        className="panel guestbook"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="방명록"
      >
        <button className="close" onClick={onClose} aria-label="닫기">
          ×
        </button>
        <span className="eyebrow">LEAVE A NOTE</span>
        <h2>방명록</h2>
        <p className="muted">이 공간에 머물렀던 작은 흔적을 남겨주세요.</p>
        {!repository && (
          <p className="demo-notice">
            시제품 모드 · 작성한 글은 현재 브라우저에만 저장됩니다.
          </p>
        )}
        <form onSubmit={submit}>
          <label>
            이름 또는 별명
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={24}
              placeholder="당신의 이름"
              autoComplete="nickname"
              required
              disabled={busy}
            />
          </label>
          <label>
            남기고 싶은 말
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={280}
              placeholder="전시를 보고 느낀 점을 적어주세요."
              rows={3}
              required
              disabled={busy}
            />
          </label>
          <div className="guestbook-honeypot" aria-hidden="true">
            <label>
              웹사이트
              <input
                name="website"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </label>
          </div>
          {repository && siteKey && (
            <Turnstile
              siteKey={siteKey}
              onToken={setToken}
              resetKey={resetKey}
            />
          )}
          <button
            className="primary"
            disabled={busy || !!(repository && siteKey && !token)}
            type="submit"
          >
            {busy ? '등록 중…' : '방명록 남기기'}
          </button>
          {repository && (
            <p className="guestbook-write-hint">
              글을 남긴 뒤에는 1분 후에 다시 등록할 수 있어요.
            </p>
          )}
        </form>
        {notice && (
          <p className="guestbook-success" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {loadError && (
          <p className="error" role="alert">
            {loadError}{' '}
            <button
              type="button"
              disabled={loading}
              onClick={() => void reload()}
            >
              다시 불러오기
            </button>
          </p>
        )}
        <div className="notes">
          {loading ? (
            <p className="muted" role="status">
              방명록을 불러오는 중…
            </p>
          ) : items.length === 0 ? (
            <p className="muted">
              {loadError ? '' : '첫 번째 방문의 흔적을 남겨보세요.'}
            </p>
          ) : (
            items.map((item) => (
              <article className="note" key={item.id}>
                <div>
                  <b>{item.nickname}</b>
                  <time dateTime={item.created_at}>
                    {new Date(item.created_at).toLocaleDateString('ko-KR')}
                  </time>
                </div>
                <p>{item.message}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
