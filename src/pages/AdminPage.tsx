import { useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { accountLabel } from '../../supabase/functions/_shared/adminAccount';
import { canUseRoom, roleLabels } from '../features/admin/adminAccess';
import AdminAccounts from '../features/admin/components/AdminAccounts';
import ArtworkDashboard from '../features/admin/components/ArtworkDashboard';
import { messageOf } from '../features/admin/errorMessage';
import type { AdminAccess } from '../features/admin/types';
import { useAdminSession } from '../features/admin/useAdminSession';
import AdminGuestbook from '../features/guestbook/components/AdminGuestbook';
import AdminMusic from '../features/music/components/AdminMusic';
import { supabase } from '../shared/lib/supabase';
import '../features/admin/admin.css';

export default function AdminPage() {
  return (
    <main className="admin-page">
      <header className="admin-header">
        <a href="/">← 전시관으로</a>
        <span>EXHIBITION STUDIO</span>
      </header>
      {supabase ? (
        <AdminSession client={supabase} />
      ) : (
        <section className="admin-card admin-login">
          <span className="eyebrow">SET UP YOUR GALLERY</span>
          <h1>운영자 설정이 필요합니다</h1>
          <p>
            Supabase를 연결하면 이곳에서 로그인하고 사진을 관리할 수 있습니다.
          </p>
          <ol>
            <li>Supabase 프로젝트를 생성합니다.</li>
            <li>DB·Storage 설정 SQL을 적용합니다.</li>
            <li>운영자 계정과 환경변수를 등록합니다.</li>
          </ol>
          <p>
            프로젝트의 관리자 설정 안내 문서에 전체 절차가 정리되어 있습니다.
          </p>
          <a className="admin-button" href="/">
            데모 전시관으로 돌아가기
          </a>
        </section>
      )}
    </main>
  );
}
function AdminSession({ client }: { client: SupabaseClient }) {
  const auth = useAdminSession(client);
  const [username, setUsername] = useState(''),
    [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function login(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await auth.signIn(username, password);
      setPassword('');
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }
  if (auth.loading)
    return (
      <p className="admin-status" role="status">
        운영자 권한을 확인하고 있습니다…
      </p>
    );
  if (!auth.session)
    return (
      <section className="admin-card admin-login">
        <span className="eyebrow">EXHIBITION STUDIO</span>
        <h1>운영자 로그인</h1>
        <p>등록된 운영자 계정으로 로그인해 주세요.</p>
        <form onSubmit={login}>
          <label>
            아이디
            <input
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="예: staff01"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              disabled={busy}
            />
          </label>
          <label>
            비밀번호
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={busy}
            />
          </label>
          {(error || auth.error) && (
            <p className="admin-error" role="alert">
              {error || auth.error}
            </p>
          )}
          <button className="admin-primary" disabled={busy} type="submit">
            {busy ? '로그인 중…' : '로그인'}
          </button>
        </form>
        <p className="admin-help">
          계정 생성과 비밀번호 재설정은 전시 운영 담당자에게 요청해 주세요.
        </p>
      </section>
    );
  if (!auth.allowed)
    return (
      <section className="admin-card admin-login">
        <h1>{auth.error ? '권한 확인 실패' : '운영자 권한이 없습니다'}</h1>
        <p role={auth.error ? 'alert' : undefined}>
          {auth.error || '로그인한 계정에는 전시를 관리할 권한이 없습니다.'}
        </p>
        <div className="admin-actions">
          {auth.error && <button onClick={auth.retry}>다시 확인</button>}
          <button onClick={() => void auth.signOut()}>로그아웃</button>
        </div>
      </section>
    );
  return (
    <>
      <div className="admin-account">
        <span>
          {accountLabel(auth.session.user.email)} ·{' '}
          {auth.permissions && roleLabels[auth.permissions.role]}
        </span>
        <button
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void auth.signOut().finally(() => setBusy(false));
          }}
        >
          로그아웃
        </button>
      </div>
      {auth.error && (
        <p className="admin-error" role="alert">
          {auth.error}
        </p>
      )}
      <AdminDashboard
        key={`${auth.session.user.id}:${JSON.stringify(auth.permissions)}`}
        client={client}
        userId={auth.session.user.id}
        access={auth.permissions!}
        onAccessChange={auth.retry}
      />
    </>
  );
}
function AdminDashboard({
  client,
  userId,
  access,
  onAccessChange,
}: {
  client: SupabaseClient;
  userId: string;
  access: AdminAccess;
  onAccessChange: () => void;
}) {
  const [section, setSection] = useState('artworks');
  const canManageMusic =
    access.role !== 'editor' && canUseRoom(access, 'LOBBY');
  useEffect(() => {
    const navigate = () => {
      const requested = window.location.hash.replace(/\/$/, '').split('/')[2];
      setSection(
        (canManageMusic && requested === 'music') ||
          (access.role === 'owner' &&
            (requested === 'guestbook' || requested === 'accounts'))
          ? requested
          : 'artworks',
      );
    };
    navigate();
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, [access.role, canManageMusic]);
  return (
    <>
      <nav className="admin-navigation" aria-label="관리 메뉴">
        <a
          className="admin-button"
          href="#/admin/artworks"
          aria-current={section === 'artworks' ? 'page' : undefined}
        >
          작품 관리
        </a>
        {canManageMusic && (
          <a
            className="admin-button"
            href="#/admin/music"
            aria-current={section === 'music' ? 'page' : undefined}
          >
            배경음악
          </a>
        )}
        {access.role === 'owner' && (
          <>
            <a
              className="admin-button"
              href="#/admin/guestbook"
              aria-current={section === 'guestbook' ? 'page' : undefined}
            >
              방명록 관리
            </a>
            <a
              className="admin-button"
              href="#/admin/accounts"
              aria-current={section === 'accounts' ? 'page' : undefined}
            >
              계정·권한 관리
            </a>
          </>
        )}
      </nav>
      <div hidden={section !== 'artworks'}>
        <ArtworkDashboard client={client} userId={userId} access={access} />
      </div>
      {section === 'music' && canManageMusic && (
        <AdminMusic client={client} userId={userId} />
      )}
      {section === 'guestbook' && access.role === 'owner' && (
        <AdminGuestbook client={client} />
      )}
      {section === 'accounts' && access.role === 'owner' && (
        <AdminAccounts
          client={client}
          currentUserId={userId}
          onAccessChange={onAccessChange}
        />
      )}
    </>
  );
}
