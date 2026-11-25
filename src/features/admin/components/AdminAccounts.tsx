import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { roleLabels } from '../adminAccess';
import type { AdminAccess, AdminRole } from '../types';
import { useRoomNames } from '../../rooms/useRoomNames';
import DeleteConfirmDialog from '../../../shared/components/DeleteConfirmDialog';
import {
  accountLabel,
  normalizeUsername,
  validateAccountPassword,
} from '../../../../supabase/functions/_shared/adminAccount';

type Account = AdminAccess & {
  user_id: string;
  email: string;
  updated_at: string;
  is_deleting: boolean;
};
const message = (reason: unknown) =>
  reason instanceof Error ? reason.message : '계정 정보를 처리하지 못했습니다.';
const scope = (access: AdminAccess) =>
  access.role === 'owner' || access.room_ids === null
    ? '전체 전시실'
    : access.room_ids.length
      ? access.room_ids.join('·') + ' 전시실'
      : '담당 전시실 없음';
export default function AdminAccounts({
  client,
  currentUserId,
  onAccessChange,
}: {
  client: SupabaseClient;
  currentUserId: string;
  onAccessChange: () => void;
}) {
  const rooms = useRoomNames(client);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<Account | null>(null);
  const [username, setUsername] = useState(''),
    [role, setRole] = useState<AdminRole>('editor');
  const [active, setActive] = useState(true),
    [allRooms, setAllRooms] = useState(true);
  const [password, setPassword] = useState(''),
    [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState<Account | null>(null);
  const deletionRequest = useRef(false);
  const [selected, setSelected] = useState<string[]>([]);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const users = await client.rpc('list_gallery_accounts_with_deletions');
      if (users.error)
        throw new Error(
          '계정 목록을 불러오지 못했습니다. 최고 관리자 권한과 계정 권한 SQL 적용 여부를 확인해 주세요.',
        );
      setAccounts(users.data ?? []);
      return (users.data ?? []) as Account[];
    } catch (reason) {
      setError(message(reason));
      return null;
    } finally {
      setLoading(false);
    }
  }, [client]);
  useEffect(() => {
    void load();
  }, [load]);
  function select(account: Account | null) {
    setDeleting(null);
    setEditing(account);
    setUsername(account ? accountLabel(account.email) : '');
    setPassword('');
    setConfirmation('');
    setRole(account?.role ?? 'editor');
    setActive(account?.is_active ?? true);
    setAllRooms(account?.room_ids == null);
    setSelected(account?.room_ids ?? []);
    setError('');
    setNotice('');
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || loading || editing?.is_deleting) return;
    setBusy(true);
    setError('');
    setNotice('');
    const permissions = {
      role,
      is_active: active,
      room_ids: role === 'owner' || allRooms ? null : selected,
    };
    try {
      if (editing) {
        const result = await client.rpc('set_gallery_account', {
          p_email: editing.email,
          p_role: role,
          p_active: active,
          p_rooms: permissions.room_ids,
          p_expected: editing.updated_at,
        });
        if (result.error)
          throw new Error(
            result.error.code === 'P0001'
              ? result.error.message
              : '계정 권한을 저장하지 못했습니다. 최고 관리자 권한과 연결 상태를 확인해 주세요.',
          );
      } else {
        const cleanUsername = normalizeUsername(username);
        validateAccountPassword(password);
        if (password !== confirmation)
          throw new Error('비밀번호가 서로 다릅니다.');
        const { data, error } = await client.functions.invoke(
          'admin-create-account',
          { body: { username: cleanUsername, password, ...permissions } },
        );
        if (error) {
          if ('context' in error && error.context instanceof Response) {
            const body = await error.context.json().catch(() => null);
            if (typeof body?.error === 'string') throw new Error(body.error);
          }
          throw new Error(
            '계정을 추가하지 못했습니다. 계정 생성 함수 배포 여부와 연결 상태를 확인해 주세요.',
          );
        }
        if (data?.created !== true)
          throw new Error(
            '계정 생성 결과를 확인하지 못했습니다. 목록을 새로고침해 주세요.',
          );
      }
      const wasEditing = !!editing;
      select(null);
      await load();
      onAccessChange();
      setNotice(
        wasEditing
          ? '계정 권한을 저장했습니다.'
          : '계정을 추가했습니다. 설정한 아이디와 비밀번호로 바로 로그인할 수 있습니다.',
      );
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleting || busy || deletionRequest.current) return;
    deletionRequest.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data, error } = await client.functions.invoke(
        'admin-delete-account',
        {
          body: {
            user_id: deleting.user_id,
            expected_updated_at: deleting.updated_at,
          },
        },
      );
      if (error) {
        if ('context' in error && error.context instanceof Response) {
          const body = await error.context.json().catch(() => null);
          if (typeof body?.error === 'string') throw new Error(body.error);
        }
        throw new Error(
          '계정을 삭제하지 못했습니다. 계정 삭제 함수 배포 여부와 연결 상태를 확인해 주세요.',
        );
      }
      if (data?.deleted !== true)
        throw new Error(
          '삭제 결과를 확인하지 못했습니다. 목록을 새로고침해 주세요.',
        );
      select(null);
      await load();
      onAccessChange();
      setNotice(
        '계정을 삭제했습니다. 해당 계정으로 로그인할 수 없으며 등록 작품과 사진은 유지됩니다.',
      );
    } catch (reason) {
      const latest = await load();
      const fresh = latest?.find(
        (account) => account.user_id === deleting.user_id,
      );
      if (fresh) {
        select(fresh);
        setDeleting(fresh);
      } else if (latest) select(null);
      setError(message(reason));
    } finally {
      deletionRequest.current = false;
      setBusy(false);
    }
  }
  const isSelf = editing?.user_id === currentUserId;
  const lastOwner =
    editing?.role === 'owner' &&
    editing.is_active &&
    accounts.filter((account) => account.role === 'owner' && account.is_active)
      .length <= 1;
  return (
    <section className="admin-workspace">
      <div className="admin-title">
        <div>
          <span className="eyebrow">TEAM ACCESS</span>
          <h1>계정·권한 관리</h1>
          <p>
            역할과 담당 전시실을 지정하세요. 방명록은 최고 관리자만 관리할 수
            있습니다.
          </p>
        </div>
      </div>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="admin-notice" role="status">
          {notice}
        </p>
      )}
      <div className="admin-columns">
        <section className="admin-card admin-library">
          <div className="admin-library-heading">
            <h2>운영 계정</h2>
            <div className="admin-library-actions">
              <button disabled={busy || loading} onClick={() => void load()}>
                새로고침
              </button>
              <button disabled={busy} onClick={() => select(null)}>
                + 계정 추가
              </button>
            </div>
          </div>
          {loading && <p role="status">계정을 불러오는 중…</p>}
          <div className="admin-artwork-list">
            {accounts.map((account) => (
              <button
                key={account.user_id}
                className={`admin-artwork${editing?.user_id === account.user_id ? ' is-selected' : ''}`}
                disabled={busy || loading}
                onClick={() => select(account)}
              >
                <span>
                  <strong>{accountLabel(account.email)}</strong>
                  <small>
                    {roleLabels[account.role]} · {scope(account)}
                  </small>
                  <em>
                    {account.is_deleting
                      ? '삭제 진행 중 · 다시 시도 필요'
                      : account.is_active
                        ? '활성'
                        : '접근 중지'}
                  </em>
                </span>
              </button>
            ))}
          </div>
        </section>
        <section className="admin-card admin-editor">
          <h2>{editing ? '계정 권한 수정' : '계정 추가'}</h2>
          <form onSubmit={save}>
            <fieldset disabled={busy || loading || editing?.is_deleting}>
              <label>
                아이디
                <input
                  type="text"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={username}
                  required
                  minLength={editing ? undefined : 3}
                  maxLength={editing ? undefined : 32}
                  pattern={editing ? undefined : '[a-zA-Z0-9_\\-]{3,32}'}
                  disabled={!!editing}
                  placeholder="예: staff01"
                  onChange={(event) => setUsername(event.target.value)}
                />
              </label>
              {!editing && (
                <>
                  <p className="admin-help">
                    영문·숫자·_·- 3~32자. 대소문자는 구분하지 않습니다.
                  </p>
                  <label>
                    비밀번호
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      required
                      minLength={8}
                      maxLength={72}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </label>
                  <label>
                    비밀번호 확인
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={confirmation}
                      required
                      minLength={8}
                      maxLength={72}
                      onChange={(event) => setConfirmation(event.target.value)}
                    />
                  </label>
                  <p className="admin-help">
                    비밀번호는 8~72자로 설정해 주세요. 생성 후 아이디와
                    비밀번호를 사용자에게 전달하면 됩니다.
                  </p>
                </>
              )}
              <label>
                역할
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value as AdminRole)}
                >
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="admin-help">
                {role === 'owner'
                  ? '모든 전시실·작품·방명록과 계정 권한을 관리합니다.'
                  : role === 'manager'
                    ? '담당 전시실 설정과 작품 등록·수정·공개·배치·삭제를 관리합니다.'
                    : '담당 전시실의 작품을 등록·수정합니다. 공개 전환·배치 변경·삭제는 할 수 없습니다.'}
              </p>
              {role !== 'owner' && (
                <>
                  <label className="admin-checkbox">
                    <input
                      type="checkbox"
                      checked={allRooms}
                      onChange={(event) => setAllRooms(event.target.checked)}
                    />
                    전체 전시실 담당
                  </label>
                  {!allRooms && (
                    <div
                      className="admin-scope-options"
                      role="group"
                      aria-label="담당 전시실"
                    >
                      {rooms.records.map((room) => (
                        <label className="admin-checkbox" key={room.id}>
                          <input
                            type="checkbox"
                            checked={selected.includes(room.id)}
                            onChange={(event) =>
                              setSelected((ids) =>
                                event.target.checked
                                  ? [...ids, room.id]
                                  : ids.filter((id) => id !== room.id),
                              )
                            }
                          />
                          {room.name}
                        </label>
                      ))}
                      <p className="admin-help">
                        선택하지 않으면 관리할 수 있는 전시실이 없습니다. 전시실
                        추가는 전체 전시실 담당자만 가능합니다.
                      </p>
                    </div>
                  )}
                </>
              )}
              {rooms.error && (
                <p className="admin-error" role="alert">
                  {rooms.error}
                </p>
              )}
              <label>
                계정 상태
                <select
                  value={active ? 'active' : 'suspended'}
                  onChange={(event) =>
                    setActive(event.target.value === 'active')
                  }
                >
                  <option value="active">활성</option>
                  <option value="suspended">접근 중지</option>
                </select>
              </label>
              <p className="admin-help">
                접근 중지는 관리 기능을 차단합니다. 마지막 활성 최고 관리자는
                유지해야 합니다.
              </p>
              <button
                className="admin-primary"
                type="submit"
                disabled={busy || rooms.loading || !!rooms.error}
              >
                {busy ? '저장 중…' : editing ? '권한 저장' : '계정 추가'}
              </button>
            </fieldset>
          </form>
          {editing && (
            <>
              {editing.is_deleting && (
                <p className="admin-help" role="status">
                  삭제를 완료하지 못한 계정입니다. 접근은 차단되어 있으며 삭제를
                  다시 시도할 수 있습니다.
                </p>
              )}
              <button
                type="button"
                className="admin-delete"
                disabled={busy || loading || isSelf || lastOwner}
                onClick={() => {
                  setError('');
                  setNotice('');
                  setDeleting(editing);
                }}
              >
                {editing.is_deleting ? '계정 삭제 다시 시도' : '이 계정 삭제'}
              </button>
              {(isSelf || lastOwner) && (
                <p className="admin-help">
                  {lastOwner
                    ? '마지막 최고 관리자 계정은 삭제할 수 없습니다.'
                    : '현재 로그인한 계정은 삭제할 수 없습니다. 다른 최고 관리자 계정으로 로그인해 주세요.'}
                </p>
              )}
            </>
          )}
        </section>
      </div>
      {deleting && (
        <DeleteConfirmDialog
          busy={busy}
          error={error}
          onCancel={() => {
            setDeleting(null);
            setError('');
          }}
          onConfirm={() => void remove()}
        >
          ‘{accountLabel(deleting.email)}’ 계정을 삭제합니다. 삭제한 계정으로는
          로그인할 수 없으며 복구할 수 없습니다. 등록한 작품과 사진은
          유지됩니다.
        </DeleteConfirmDialog>
      )}
    </section>
  );
}
