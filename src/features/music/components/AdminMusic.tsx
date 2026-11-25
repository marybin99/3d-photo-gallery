import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  audioFileFormat,
  createMusicRepository,
} from '../musicRepository';
import type { MusicSettings } from '../types';

export default function AdminMusic({
  client,
  userId,
}: {
  client: SupabaseClient;
  userId: string;
}) {
  const repository = useMemo(() => createMusicRepository(client), [client]);
  const [settings, setSettings] = useState<MusicSettings | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    void repository
      .read()
      .then((next) => {
        if (active) setSettings(next);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [repository, revision]);

  async function change(operation: () => Promise<MusicSettings>) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      setSettings(await operation());
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : '배경음악을 저장하지 못했습니다.',
      );
    } finally {
      setSaving(false);
    }
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!settings || loading || saving || !files.length) return;
    void change(async () => {
      const result = await repository.append(settings, files, userId);
      setNotice(`음원 ${files.length}곡을 추가했습니다.`);
      setFiles([]);
      form.reset();
      return result;
    });
  }

  const tracks = settings ? repository.tracks(settings) : [];
  const busy = loading || saving;
  return (
    <section
      className="admin-card admin-music"
      aria-labelledby="admin-music-heading"
    >
      <h2 id="admin-music-heading">배경음악</h2>
      <p className="admin-help">음원은 목록 순서대로 반복 재생됩니다.</p>
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="admin-notice">
          {notice}
        </p>
      )}
      {loading && (
        <p role="status" className="admin-help">
          배경음악 설정을 불러오는 중…
        </p>
      )}
      {settings && (
        <>
          <form key={revision} onSubmit={add}>
            <fieldset disabled={busy}>
              <label>
                음원 파일
                <input
                  type="file"
                  accept=".mp3,.m4a,.wav,.ogg"
                  multiple
                  required
                  onChange={(event) => {
                    const selected = Array.from(event.target.files ?? []);
                    setError('');
                    setNotice('');
                    try {
                      selected.forEach(audioFileFormat);
                      setFiles(selected);
                    } catch (reason) {
                      event.target.value = '';
                      setFiles([]);
                      setError((reason as Error).message);
                    }
                  }}
                />
              </label>
              <p className="admin-help">
                MP3, M4A, WAV, OGG · 파일당 최대 20MB
              </p>
              <button
                className="admin-primary"
                type="submit"
                disabled={!files.length}
              >
                {saving ? '저장 중…' : '음원 추가'}
              </button>
            </fieldset>
          </form>
          {tracks.length > 0 && (
            <ol className="admin-music-tracks" aria-label="배경음악 재생 목록">
              {tracks.map((track) => (
                <li key={track.path}>
                  <div className="admin-music-track">
                    <div>
                      <strong>{track.title}</strong>
                      <audio
                        aria-label={`${track.title} 미리 듣기`}
                        controls
                        preload="none"
                        src={track.source}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`${track.title} 삭제`}
                      onClick={() =>
                        void change(async () => {
                          const { settings: next, warning } =
                            await repository.remove(settings, track.path);
                          setNotice(warning || '목록에서 음원을 삭제했습니다.');
                          return next;
                        })
                      }
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {settings.youtube_id && (
            <div className="admin-music-legacy">
              <p className="admin-help">
                보관된 유튜브 링크는 배경음악 재생 목록에서 제외됩니다.
              </p>
              <a
                href={`https://www.youtube.com/watch?v=${settings.youtube_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                기존 링크 열기
              </a>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void change(async () => {
                    const next = await repository.removeYoutubeLink(settings);
                    setNotice('보관된 유튜브 링크를 삭제했습니다.');
                    return next;
                  })
                }
              >
                링크 삭제
              </button>
            </div>
          )}
        </>
      )}
      {error && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setLoading(true);
            setError('');
            setNotice('');
            setFiles([]);
            setRevision((previous) => previous + 1);
          }}
        >
          설정 다시 불러오기
        </button>
      )}
    </section>
  );
}
