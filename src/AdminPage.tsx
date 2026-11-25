import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { useAdminSession } from './useAdminSession';
import { createArtworkRepository } from './artworkRepository';
import {
  firstAvailableSlot,
  slotLabel,
  validateImageFile,
  type ArtworkDraft,
  type ArtworkRecord,
} from './artworkModel';
import { youtubeVideoId, youtubeThumbnail } from './youtubeModel';
import { artworkSlots } from './data';
import { prepareArtworkImage } from './prepareArtworkImage';
import { useRoomNames } from './useRoomNames';
import { roomName } from './roomModel';
import { DEFAULT_FRAME_COLOR } from './galleryColors';
import RoomSettings from './RoomSettings';
import AdminGuestbook from './AdminGuestbook';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import './admin.css';
import AdminAccounts from './AdminAccounts';
import { accountLabel } from '../supabase/functions/_shared/adminAccount';
import { canUseRoom, roleLabels, type AdminAccess } from './adminAccess';

const emptyDraft: ArtworkDraft = {
  slot_id: '',
  youtube_url: '',
  frame_color: DEFAULT_FRAME_COLOR,
  title: '',
  description: '',
  is_published: false,
};
const messageOf = (error: unknown) =>
  error instanceof Error
    ? error.message
    : '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';

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
  useEffect(() => {
    const navigate = () => {
      const requested = window.location.hash.replace(/\/$/, '').split('/')[2];
      setSection(
        access.role === 'owner' &&
          (requested === 'guestbook' || requested === 'accounts')
          ? requested
          : 'artworks',
      );
    };
    navigate();
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, [access.role]);
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
function ArtworkDashboard({
  client,
  userId,
  access,
}: {
  client: SupabaseClient;
  userId: string;
  access: AdminAccess;
}) {
  const allRooms = useRoomNames(client);
  const permittedRecords = allRooms.records.filter((room) =>
    canUseRoom(access, room.id),
  );
  const rooms = {
    ...allRooms,
    ids: allRooms.ids.filter((id) => canUseRoom(access, id)),
    records: permittedRecords,
  };
  const canManage = access.role !== 'editor';
  const roomKey = rooms.ids.join(',');
  const slots = useMemo(
    () => (roomKey ? artworkSlots(roomKey.split(',')) : []),
    [roomKey],
  );
  const repository = useMemo(
    () => createArtworkRepository(client, slots),
    [client, slots],
  );
  const [records, setRecords] = useState<ArtworkRecord[]>([]),
    [urls, setUrls] = useState(new Map<string, string>());
  const [loading, setLoading] = useState(true),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<ArtworkRecord | null>(null),
    [draft, setDraft] = useState({ ...emptyDraft });
  const [mediaType, setMediaType] = useState<'image' | 'youtube'>('image');
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState('');
  const [filter, setFilter] = useState('ALL'),
    [confirmDelete, setConfirmDelete] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null),
    request = useRef(0),
    mounted = useRef(true),
    mutation = useRef(false);
  useEffect(() => {
    if (filter !== 'ALL' && !rooms.ids.includes(filter)) setFilter('ALL');
    if (draft.slot_id && !slots.some((slot) => slot.id === draft.slot_id)) {
      setEditing(null);
      setDraft({ ...emptyDraft });
      setFile(null);
      setConfirmDelete(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }, [roomKey, slots, filter, draft.slot_id]);
  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    setError('');
    try {
      const items = (await repository.list(false)).filter((record) =>
        slots.some((slot) => slot.id === record.slot_id),
      );
      const images = await repository.imageUrls(items);
      if (mounted.current && id === request.current) {
        setRecords(items);
        setUrls(images);
        setReady(true);
      }
    } catch (reason) {
      if (mounted.current && id === request.current)
        setError(messageOf(reason));
    } finally {
      if (mounted.current && id === request.current) setLoading(false);
    }
  }, [repository, slots]);
  useEffect(() => {
    mounted.current = true;
    void load();
    const timer = window.setInterval(
      () => {
        if (!mutation.current) void load();
      },
      50 * 60 * 1000,
    );
    return () => {
      mounted.current = false;
      ++request.current;
      window.clearInterval(timer);
    };
  }, [load]);
  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const clearForm = (items = records) => {
    setEditing(null);
    setMediaType('image');
    setFile(null);
    setConfirmDelete(false);
    const slotId = firstAvailableSlot(items, filter, slots);
    setDraft({ ...emptyDraft, slot_id: slotId });
    if (fileInput.current) fileInput.current.value = '';
    return slotId;
  };
  const edit = (record: ArtworkRecord) => {
    setEditing(record);
    setMediaType(record.youtube_url ? 'youtube' : 'image');
    setDraft({
      youtube_url: record.youtube_url ?? '',
      frame_color: record.frame_color ?? DEFAULT_FRAME_COLOR,
      slot_id: record.slot_id,
      title: record.title,
      description: record.description,
      is_published: record.is_published,
    });
    setFile(null);
    setConfirmDelete(false);
    setError('');
    setNotice('');
    if (fileInput.current) fileInput.current.value = '';
  };
  async function save(event: FormEvent) {
    event.preventDefault();
    if (mutation.current || !ready) return;
    if (
      !canManage &&
      (draft.is_published !== (editing?.is_published ?? false) ||
        (editing && draft.slot_id !== editing.slot_id))
    ) {
      setError('공개 여부와 작품 배치는 전시 관리자만 변경할 수 있습니다.');
      return;
    }
    mutation.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    setConfirmDelete(false);
    try {
      if (mediaType === 'youtube' && !draft.youtube_url?.trim())
        throw new Error('유튜브 링크를 입력해 주세요.');
      const image =
        mediaType === 'image' && file ? await prepareArtworkImage(file) : null;
      const result = await repository.save(
        userId,
        {
          ...draft,
          youtube_url: mediaType === 'youtube' ? draft.youtube_url : '',
        },
        editing,
        image,
      );
      if (!mounted.current) return;
      const next = [
        ...records.filter((record) => record.id !== result.record.id),
        result.record,
      ];
      setRecords(next);
      clearForm(next);
      setNotice(
        result.warning ||
          '작품을 저장했습니다. 공개한 작품은 전시관을 새로 열면 반영됩니다.',
      );
      await load();
    } catch (reason) {
      if (mounted.current) setError(messageOf(reason));
    } finally {
      mutation.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function remove() {
    if (!editing || mutation.current || !canManage) return;
    mutation.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await repository.delete(editing);
      if (!mounted.current) return;
      const next = records.filter((record) => record.id !== editing.id);
      setRecords(next);
      clearForm(next);
      setNotice(result.warning || '작품을 삭제했습니다.');
      await load();
    } catch (reason) {
      if (mounted.current) setError(messageOf(reason));
    } finally {
      mutation.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  let videoPreview = '';
  try {
    if (draft.youtube_url)
      videoPreview = youtubeThumbnail(youtubeVideoId(draft.youtube_url));
  } catch {
    /* Show a hint until the URL is complete. */
  }
  const currentImage =
    mediaType === 'youtube'
      ? videoPreview
      : preview || (editing?.image_path ? urls.get(editing.image_path) : '');
  const recordImage = (record: ArtworkRecord) =>
    record.youtube_url
      ? youtubeThumbnail(youtubeVideoId(record.youtube_url))
      : record.image_path
        ? urls.get(record.image_path)
        : '';
  const visible = records.filter(
    (record) =>
      filter === 'ALL' ||
      slots.find((slot) => slot.id === record.slot_id)?.zone === filter,
  );
  return (
    <section className="admin-workspace">
      <div className="admin-title">
        <div>
          <span className="eyebrow">CURATE YOUR EXHIBITION</span>
          <h1>작품 관리</h1>
          <p>
            {rooms.ids.length}개 전시실, {slots.length}개의 액자에 사진과
            이야기를 전시해 보세요.
          </p>
        </div>
        <a className="admin-button" href="/">
          전시관 보기 ↗
        </a>
      </div>
      <p className="admin-help">
        {canManage
          ? '담당 전시실의 작품과 전시실 설정을 관리할 수 있습니다.'
          : '담당 전시실의 작품을 등록·수정할 수 있습니다. 공개 전환·배치 변경·삭제는 전시 관리자에게 요청해 주세요.'}
      </p>
      {canManage && (
        <RoomSettings
          rooms={rooms}
          canCreate={access.role === 'owner' || access.room_ids === null}
        />
      )}
      <div className="admin-summary">
        <span>
          등록{' '}
          <b>
            {records.length} / {slots.length}
          </b>
        </span>
        <span>
          공개 <b>{records.filter((row) => row.is_published).length}</b>
        </span>
        <span>
          비공개 <b>{records.filter((row) => !row.is_published).length}</b>
        </span>
      </div>
      {notice && (
        <p className="admin-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <div className="admin-error" role="alert">
          {error}{' '}
          <button disabled={busy || loading} onClick={() => void load()}>
            목록 다시 불러오기
          </button>
        </div>
      )}
      <div className="admin-columns">
        <section
          className="admin-card admin-library"
          aria-label="등록 작품 목록"
        >
          <div className="admin-library-heading">
            <h2>전시 작품</h2>
            <button
              disabled={busy || loading || !ready}
              onClick={() => {
                const slotId = clearForm();
                setError('');
                setNotice(
                  slotId
                    ? ''
                    : filter === 'ALL'
                      ? '모든 전시 위치가 사용 중입니다.'
                      : `${roomName(filter, rooms.names)}에 비어 있는 전시 위치가 없습니다. 다른 전시실을 선택해 주세요.`,
                );
              }}
            >
              + 새 작품
            </button>
          </div>
          <label className="admin-filter">
            전시실
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="ALL">전체 전시실</option>
              {rooms.ids.map((zone) => (
                <option key={zone} value={zone}>
                  {roomName(zone, rooms.names)}
                </option>
              ))}
            </select>
          </label>
          {loading && <p role="status">작품을 불러오는 중…</p>}
          {!loading && ready && visible.length === 0 && (
            <p className="admin-empty">
              아직 등록된 작품이 없습니다. 사진을 등록하고 공개하면 전시관에
              나타납니다.
            </p>
          )}
          <div className="admin-artwork-list">
            {visible.map((record) => (
              <button
                className={`admin-artwork${editing?.id === record.id ? ' is-selected' : ''}`}
                key={record.id}
                disabled={busy || loading}
                onClick={() => edit(record)}
              >
                <img src={recordImage(record)} alt="" loading="lazy" />
                <span>
                  <strong>{record.title}</strong>
                  <small>{slotLabel(record.slot_id, rooms.names, slots)}</small>
                  <em>
                    {record.youtube_url ? '영상 · ' : ''}
                    {record.is_published ? '공개' : '비공개'}
                  </em>
                </span>
              </button>
            ))}
          </div>
        </section>
        <section className="admin-card admin-editor">
          <h2>{editing ? '작품 수정' : '새 작품 등록'}</h2>
          <form onSubmit={save}>
            <fieldset disabled={busy || loading || !ready}>
              <label>
                전시 위치
                <select
                  value={draft.slot_id}
                  disabled={!canManage && !!editing}
                  onChange={(event) =>
                    setDraft({ ...draft, slot_id: event.target.value })
                  }
                  required
                >
                  <option value="" disabled>
                    빈 전시 위치를 선택하세요
                  </option>
                  {rooms.ids.map((zone) => (
                    <optgroup
                      key={zone}
                      label={`${roomName(zone, rooms.names)}`}
                    >
                      {slots
                        .filter((slot) => slot.zone === zone)
                        .map((slot) => {
                          const occupied = records.some(
                            (record) =>
                              record.slot_id === slot.id &&
                              record.id !== editing?.id,
                          );
                          return (
                            <option
                              key={slot.id}
                              value={slot.id}
                              disabled={occupied}
                            >
                              {slotLabel(slot.id, rooms.names, slots)}
                              {occupied ? ' · 사용 중' : ''}
                            </option>
                          );
                        })}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label>
                작품 유형
                <select
                  value={mediaType}
                  onChange={(event) => {
                    setMediaType(event.target.value as 'image' | 'youtube');
                    setFile(null);
                    setDraft({ ...draft, youtube_url: '' });
                    if (fileInput.current) fileInput.current.value = '';
                  }}
                >
                  <option value="image">사진</option>
                  <option value="youtube">유튜브 영상</option>
                </select>
              </label>
              {mediaType === 'youtube' ? (
                <>
                  <label>
                    유튜브 링크
                    <input
                      type="url"
                      value={draft.youtube_url ?? ''}
                      onChange={(event) =>
                        setDraft({ ...draft, youtube_url: event.target.value })
                      }
                      required
                      maxLength={2048}
                      placeholder="https://www.youtube.com/watch?v=…"
                    />
                  </label>
                  <p className="admin-help">
                    전시관에 입장하면 표시되는 영상이 음소거로 자동 재생됩니다.
                    영상 업로드는 필요하지 않습니다.
                  </p>
                </>
              ) : (
                <>
                  <label>
                    사진 {editing ? '교체 (선택)' : '파일'}
                    <input
                      ref={fileInput}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      required={!editing || !!editing.youtube_url}
                      onChange={(event) => {
                        const next = event.target.files?.[0] ?? null;
                        try {
                          if (next) validateImageFile(next);
                          setFile(next);
                          setError('');
                        } catch (reason) {
                          setError(messageOf(reason));
                          setFile(null);
                          event.target.value = '';
                        }
                      }}
                    />
                  </label>
                  <p className="admin-help">
                    JPG·PNG·WebP, 최대 10MB. 긴 변 1,920px 이내로 조정해
                    저장합니다.
                  </p>
                </>
              )}
              <label>
                액자 색상
                <input
                  type="color"
                  value={draft.frame_color ?? DEFAULT_FRAME_COLOR}
                  onChange={(event) => setDraft({ ...draft, frame_color: event.target.value })}
                />
              </label>
              <div className="admin-image-preview">
                {currentImage ? (
                  <img
                    src={currentImage}
                    alt="선택한 작품 미리보기"
                    style={{ borderColor: draft.frame_color ?? DEFAULT_FRAME_COLOR }}
                  />
                ) : (
                  <span>
                    {mediaType === 'youtube'
                      ? '유튜브 링크를 입력하면 썸네일이 표시됩니다.'
                      : '사진을 선택하면 미리보기가 표시됩니다.'}
                  </span>
                )}
              </div>
              <label>
                작품 제목
                <input
                  value={draft.title}
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                  maxLength={120}
                  required
                />
              </label>
              <label>
                작품 설명
                <textarea
                  value={draft.description}
                  onChange={(event) =>
                    setDraft({ ...draft, description: event.target.value })
                  }
                  rows={4}
                  maxLength={2000}
                />
              </label>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={draft.is_published}
                  disabled={!canManage}
                  onChange={(event) =>
                    setDraft({ ...draft, is_published: event.target.checked })
                  }
                />
                전시관에 공개
              </label>
              <p className="admin-help">
                비공개 작품은 방문자의 전시관에 표시되지 않습니다.
              </p>
              <div className="admin-actions">
                <button className="admin-primary" type="submit">
                  {busy ? '처리 중…' : editing ? '수정 저장' : '작품 등록'}
                </button>
                <button type="button" onClick={() => clearForm()}>
                  입력 초기화
                </button>
              </div>
            </fieldset>
          </form>
          {canManage && editing && !confirmDelete && (
            <button
              className="admin-delete"
              disabled={busy || loading}
              onClick={() => {
                setError('');
                setConfirmDelete(true);
              }}
            >
              이 작품 삭제
            </button>
          )}
          {canManage && editing && confirmDelete && (
            <DeleteConfirmDialog
              busy={busy}
              error={error}
              onCancel={() => setConfirmDelete(false)}
              onConfirm={() => void remove()}
            >
              ‘{editing.title}’ 작품
              {editing.youtube_url ? '의 영상 연결' : '과 사진 파일'}을
              삭제합니다. 삭제하면 복구할 수 없습니다.
            </DeleteConfirmDialog>
          )}
        </section>
      </div>
    </section>
  );
}
