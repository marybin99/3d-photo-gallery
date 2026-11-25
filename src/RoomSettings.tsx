import { useEffect, useState, type FormEvent } from 'react';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import { DEFAULT_ENTRANCE_COLOR } from './galleryColors';
import type { RoomRecord } from './roomModel';
import type { useRoomNames } from './useRoomNames';

export default function RoomSettings({
  rooms,
  canCreate = true,
}: {
  rooms: ReturnType<typeof useRoomNames>;
  canCreate?: boolean;
}) {
  const [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_ENTRANCE_COLOR);
  const [deleting, setDeleting] = useState<RoomRecord | null>(null);
  const createDisabled = saving || rooms.loading || !!rooms.error || rooms.ids.length >= 26;
  async function remove() {
    if (!deleting || saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await rooms.remove(deleting);
      setNotice(`‘${deleting.name}’ 전시실을 삭제했습니다.`);
      setDeleting(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : '삭제하지 못했습니다.',
      );
    } finally {
      setSaving(false);
    }
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const next = await rooms.create(newName, newColor);
      setNewName('');
      setNewColor(DEFAULT_ENTRANCE_COLOR);
      setNotice(
        `‘${next.name}’ 전시실과 액자 12개를 추가했습니다. 전시 준비가 끝나면 오픈해 주세요.`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : '추가하지 못했습니다.',
      );
    } finally {
      setSaving(false);
    }
  }
  async function setOpen(record: RoomRecord, isOpen: boolean) {
    if (saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const next = await rooms.setOpen(record, isOpen);
      setNotice(
        isOpen
          ? `‘${next.name}’ 전시실을 오픈했습니다.`
          : `‘${next.name}’ 전시실을 준비 중으로 변경했습니다. 입장이 제한됩니다.`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : '오픈 여부를 저장하지 못했습니다.',
      );
    } finally {
      setSaving(false);
    }
  }
  async function save(record: RoomRecord, name: string, color: string) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const next = await rooms.save(record, name, color);
      setNotice(`‘${next.name}’ 전시실 설정을 저장했습니다.`);
      return next;
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : '저장하지 못했습니다.',
      );
      return null;
    } finally {
      setSaving(false);
    }
  }
  return (
    <section
      className="admin-card admin-room-settings"
      aria-label="전시실 관리"
    >
      <h2>전시실 관리</h2>
      <p className="admin-help">
        전시실 입구·미니맵·현재 위치·작품 위치 선택에 표시됩니다. 추가 전시실은
        로비 뒤 연결 통로로 이어지며, 각 전시실에는 액자 12개가 제공됩니다.
        오픈한 전시실만 관람할 수 있습니다. 준비 중인 전시실에도 작품을 등록할
        수 있으며, 작품이 없는 추가 전시실만 삭제할 수 있습니다.
      </p>
      {(rooms.error || error) && (
        <p className="admin-error" role="alert">
          {error || rooms.error}{' '}
          <button
            disabled={saving || rooms.loading}
            onClick={() => {
              setError('');
              void rooms.reload();
            }}
          >
            다시 불러오기
          </button>
        </p>
      )}
      {notice && (
        <p className="admin-notice" role="status">
          {notice}
        </p>
      )}
      {rooms.loading && (
        <p className="admin-help" role="status">
          전시실 정보를 불러오는 중…
        </p>
      )}
      {canCreate && (
        <form className="admin-room-create" onSubmit={create}>
          <label className="admin-room-name">
            새 전시실 이름
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              maxLength={24}
              required
              disabled={createDisabled}
              placeholder="예: 계절의 기억"
            />
          </label>
          <label>
            입구 색상
            <input
              type="color"
              value={newColor}
              onChange={(event) => setNewColor(event.target.value)}
              disabled={createDisabled}
            />
          </label>
          <button
            className="admin-primary"
            type="submit"
            disabled={createDisabled || !newName.trim()}
          >
            {saving ? '저장 중…' : '+ 전시실 추가'}
          </button>
        </form>
      )}
      {rooms.ids.length >= 26 && (
        <p className="admin-help">전시실은 최대 26개까지 추가할 수 있습니다.</p>
      )}
      <div className="admin-room-forms">
        {rooms.records.map((record) => (
          <div className="admin-room-item" key={record.id}>
            <RoomAppearanceForm
              record={record}
              disabled={saving || rooms.loading}
              save={save}
              onDelete={() => {
                setError('');
                setNotice('');
                setDeleting(record);
              }}
            />
            <label className="admin-room-toggle">
              <input
                type="checkbox"
                role="switch"
                aria-label={`${record.name} 오픈`}
                checked={record.is_open}
                disabled={saving || rooms.loading}
                onChange={(event) => void setOpen(record, event.target.checked)}
              />
              <span>{record.is_open ? '오픈' : '준비 중 · COMING SOON'}</span>
            </label>
          </div>
        ))}
      </div>
      {deleting && (
        <DeleteConfirmDialog
          busy={saving}
          error={error}
          onCancel={() => {
            setDeleting(null);
            setError('');
          }}
          onConfirm={() => void remove()}
        >
          ‘{deleting.name}’ 전시실과 빈 액자 12개를 삭제합니다. 등록된 작품이
          있으면 먼저 다른 전시실로 이동하거나 삭제해 주세요.
        </DeleteConfirmDialog>
      )}
    </section>
  );
}
function RoomAppearanceForm({
  record,
  disabled,
  save,
  onDelete,
}: {
  record: RoomRecord;
  disabled: boolean;
  save: (record: RoomRecord, name: string, color: string) => Promise<RoomRecord | null>;
  onDelete: () => void;
}) {
  const [base, setBase] = useState(record),
    [name, setName] = useState(record.name);
  const baseColor = base.entrance_color ?? DEFAULT_ENTRANCE_COLOR;
  const recordColor = record.entrance_color ?? DEFAULT_ENTRANCE_COLOR;
  const [color, setColor] = useState(recordColor);
  const dirty = name !== base.name || color !== baseColor;
  useEffect(() => {
    // A change to the open status alone need not invalidate appearance edits.
    if (record.name === base.name && recordColor === baseColor) {
      setBase(record);
    } else if (!dirty) {
      setBase(record);
      setName(record.name);
      setColor(recordColor);
    }
  }, [record, recordColor, base.name, baseColor, dirty]);
  const stale = base.updated_at !== record.updated_at &&
    (base.name !== record.name || baseColor !== recordColor);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || stale) return;
    const next = await save(base, name, color);
    if (next) {
      setBase(next);
      setName(next.name);
      setColor(next.entrance_color ?? DEFAULT_ENTRANCE_COLOR);
    }
  }
  return (
    <form onSubmit={submit}>
      <label className="admin-room-name">
        전시실 {record.id}
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={24}
          required
          disabled={disabled}
        />
      </label>
      <label>
        입구 색상
        <input
          type="color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
          disabled={disabled}
        />
      </label>
      {stale ? (
        <button type="button" disabled={disabled} onClick={() => {
          setBase(record);
          setName(record.name);
          setColor(recordColor);
        }}>
          최신 설정 불러오기
        </button>
      ) : (
        <button type="submit" disabled={disabled || !dirty}>
          저장
        </button>
      )}
      {/^[D-Z]$/.test(record.id) && (
        <button
          type="button"
          className="admin-room-delete"
          disabled={disabled}
          onClick={onDelete}
        >
          삭제
        </button>
      )}
    </form>
  );
}
