import { useCallback, useEffect, useRef, useState } from 'react';
import type { MusicTrack } from './galleryMusic';

export default function MusicControls({ tracks }: { tracks: MusicTrack[] }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [currentPath, setCurrentPath] = useState(tracks[0].path);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState('');
  const index = Math.max(
    0,
    tracks.findIndex((track) => track.path === currentPath),
  );
  const track = tracks[index];

  const play = useCallback((player: HTMLAudioElement) => {
    const source = player.src;
    void player.play().catch((reason: unknown) => {
      if (
        audio.current !== player ||
        player.src !== source ||
        (reason instanceof DOMException && reason.name === 'AbortError')
      )
        return;
      setEnabled(false);
      setError('배경음악을 재생하지 못했습니다.');
    });
  }, []);

  useEffect(() => {
    if (enabled && audio.current?.paused) play(audio.current);
  }, [enabled, play, track.path]);

  function toggle() {
    if (!audio.current) return;
    setError('');
    setEnabled(!enabled);
    if (enabled) audio.current.pause();
    else play(audio.current);
  }

  function next() {
    setError('');
    setCurrentPath(tracks[(index + 1) % tracks.length].path);
  }

  return (
    <div className="music-controls">
      <button
        type="button"
        className="music-toggle text-btn"
        aria-pressed={enabled}
        aria-label={enabled ? '배경음악 소리 끄기' : '배경음악 소리 켜기'}
        onClick={toggle}
      >
        <span aria-hidden="true">♫</span> {enabled ? '소리 끄기' : '소리 켜기'}
      </button>
      {tracks.length > 1 && (enabled || error) && (
        <button type="button" className="music-next text-btn" onClick={next}>
          다음 곡
        </button>
      )}
      <audio
        ref={audio}
        src={track.source}
        preload="none"
        loop={tracks.length === 1}
        onEnded={enabled ? next : undefined}
      />
      {error && (
        <p className="music-playback-hint" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
