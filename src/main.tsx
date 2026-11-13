import React, { Suspense, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import Gallery, { SPAWN, type Pose } from './Gallery';
import { followCameraPosition } from './camera';
import { type Artwork } from './data';
import { areas, areaAt, BOOK } from './layout';
import { demoRead, demoWrite, supabase, type GuestbookEntry } from './supabase';
import MobileControls from './MobileControls';
import ControlsGuide from './ControlsGuide';
import './styles.css';

function MiniMap({ pose }: { pose: Pose }) {
  const mapX = (x: number) => 110 + x * 4;
  const mapY = (z: number) => 100 + z * 4;
  return (
    <div className="minimap" aria-label="미니맵: 로비와 A·B·C 전시실">
      <div className="minimap-heading">
        <span>GALLERY MAP</span>
        <span className="live-dot" />
      </div>
      <svg
        viewBox="0 0 220 172"
        role="img"
        aria-label={`현재 위치: ${areaAt(pose.x, pose.z).label}`}
      >
        {areas.map((area) => (
          <g key={area.id}>
            <rect
              x={mapX(area.x - area.width / 2)}
              y={mapY(area.z - area.depth / 2)}
              width={area.width * 4}
              height={area.depth * 4}
              fill={area.color}
              stroke="#8b7c6b"
              strokeWidth="2"
            />
            <text
              x={mapX(area.x)}
              y={mapY(area.z) - 7}
              textAnchor="middle"
              fill="#54483c"
              fontSize="10"
            >
              {area.id}
            </text>
          </g>
        ))}
        <path
          d="M78 96V112 M142 96V112 M102 76H118"
          stroke="#c7b49b"
          strokeWidth="4"
        />
        <g
          aria-label="로비 방명록"
          transform={`translate(${mapX(BOOK.x)} ${mapY(BOOK.z)})`}
        >
          <rect
            x="-5"
            y="-3"
            width="10"
            height="6"
            fill="#fff8e5"
            stroke="#80684f"
          />
          <path d="M0 -3V3" stroke="#80684f" />
        </g>
        <g
          transform={`translate(${mapX(pose.x)} ${mapY(pose.z)}) rotate(${(-pose.yaw * 180) / Math.PI})`}
        >
          <circle r="4" fill="#7e637d" stroke="white" strokeWidth="1.5" />
          <path d="M0 -9L-3 -3L3 -3Z" fill="#7e637d" />
        </g>
        <text x="110" y="162" textAnchor="middle" fontSize="8" fill="#80766b">
          책 아이콘 · 로비 방명록
        </text>
      </svg>
    </div>
  );
}
function Guestbook({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<GuestbookEntry[]>([]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let canceled = false;
    async function load() {
      if (supabase) {
        const { data, error } = await supabase
          .from('guestbook_entries')
          .select('id,nickname,message,created_at')
          .eq('is_visible', true)
          .order('created_at', { ascending: false })
          .limit(50);
        if (!canceled) {
          if (error) setError('방명록을 불러오지 못했습니다.');
          else setItems(data ?? []);
        }
      } else setItems(demoRead());
    }
    void load();
    return () => {
      canceled = true;
    };
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const nick = name.trim(),
      text = message.trim();
    if (!nick || !text || busy) return;
    setBusy(true);
    setError('');
    try {
      if (supabase) {
        const { error } = await supabase
          .from('guestbook_entries')
          .insert({ nickname: nick, message: text });
        if (error) throw error;
        const { data } = await supabase
          .from('guestbook_entries')
          .select('id,nickname,message,created_at')
          .eq('is_visible', true)
          .order('created_at', { ascending: false })
          .limit(50);
        setItems(data ?? []);
      } else setItems([demoWrite(nick, text), ...items]);
      setName('');
      setMessage('');
    } catch {
      setError('등록에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="overlay" onMouseDown={onClose}>
      <section
        className="panel guestbook"
        onMouseDown={(e) => e.stopPropagation()}
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
        {!supabase && (
          <p className="demo-notice">
            시제품 모드 · 작성한 글은 현재 브라우저에만 저장됩니다.
          </p>
        )}
        <form onSubmit={submit}>
          <label>
            이름 또는 별명
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              placeholder="당신의 이름"
              required
            />
          </label>
          <label>
            남기고 싶은 말
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={280}
              placeholder="전시를 보고 느낀 점을 적어주세요."
              rows={3}
              required
            />
          </label>
          <button className="primary" disabled={busy} type="submit">
            {busy ? '등록 중…' : '방명록 남기기'}
          </button>
        </form>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="notes">
          {items.length === 0 ? (
            <p className="muted">첫 번째 방문의 흔적을 남겨보세요.</p>
          ) : (
            items.map((item) => (
              <article className="note" key={item.id}>
                <div>
                  <b>{item.nickname}</b>
                  <time>
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
function App() {
  const [pose, setPose] = useState<Pose>({ ...SPAWN });
  const poseRef = useRef<Pose>({ ...SPAWN });
  const mobileInput = useRef({ forward: 0, right: 0 });
  const [selected, setSelected] = useState<Artwork | null>(null);
  const [guestbook, setGuestbook] = useState(false);
  const [guideMode, setGuideMode] = useState<'welcome' | 'compact' | null>(
    'welcome',
  );
  const galleryView = useRef<HTMLDivElement>(null);
  const closeGuide = () => {
    setGuideMode(null);
    galleryView.current?.focus({ preventScroll: true });
  };
  const [minimap, setMinimap] = useState(true);
  const paused = selected !== null || guestbook || guideMode === 'welcome';
  const currentArea = areaAt(pose.x, pose.z);
  const nearBook = Math.hypot(pose.x - BOOK.x, pose.z - BOOK.z) < 3.2;
  useEffect(() => {
    const interact = (event: KeyboardEvent) => {
      if (
        paused ||
        !nearBook ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      if (
        event.target instanceof HTMLElement &&
        event.target.closest(
          'input, textarea, select, button, [contenteditable]',
        )
      )
        return;
      if (event.key.toLowerCase() === 'e') {
        event.preventDefault();
        setGuestbook(true);
      }
    };
    window.addEventListener('keydown', interact);
    return () => window.removeEventListener('keydown', interact);
  }, [paused, nearBook]);
  useEffect(() => {
    mobileInput.current = { forward: 0, right: 0 };
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelected(null);
        setGuestbook(false);
        setGuideMode(null);
        galleryView.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [paused]);
  const reset = () => {
    poseRef.current = { ...SPAWN };
    setPose({ ...SPAWN });
  };
  return (
    <main>
      <div className="gallery-view" ref={galleryView} tabIndex={-1}>
        <Canvas
          shadows
          dpr={[1, 1.7]}
          camera={{ position: followCameraPosition(SPAWN), fov: 64 }}
        >
          <Suspense fallback={null}>
            <Gallery
              onSelect={setSelected}
              onGuestbook={() => setGuestbook(true)}
              pose={poseRef}
              onPose={setPose}
              mobileInput={mobileInput}
              paused={paused}
            />
          </Suspense>
        </Canvas>
        <div className="top-left">
          <div className="brand">
            THE QUIET ROOM <small>ONLINE EXHIBITION</small>
          </div>
          <div className="location-badge" role="status">
            현재 위치 · {currentArea.label}
            <small>
              {currentArea.id === 'LOBBY'
                ? '펼쳐진 책을 클릭하면 방명록이 열립니다'
                : '문을 통해 중앙 로비로 돌아갈 수 있습니다'}
            </small>
          </div>
        </div>
        {minimap && <MiniMap pose={pose} />}
        <button className="map-toggle" onClick={() => setMinimap((v) => !v)}>
          {minimap ? '지도 숨기기' : '미니맵 보기'}
        </button>
        <div className="bottom-left">
          <div className="guide-anchor">
            <button
              aria-expanded={guideMode === 'compact'}
              aria-controls="compact-controls"
              onClick={() => {
                setGuideMode((mode) =>
                  mode === 'compact' ? null : 'compact',
                );
                galleryView.current?.focus({ preventScroll: true });
              }}
            >
              ⓘ 조작 안내
            </button>
            {guideMode === 'compact' && !selected && !guestbook && (
              <ControlsGuide variant="compact" onClose={closeGuide} />
            )}
          </div>
          <button onClick={reset}>⌂ 로비로 이동</button>
        </div>
        {guideMode === 'welcome' && (
          <ControlsGuide variant="welcome" onClose={closeGuide} />
        )}
        <MobileControls input={mobileInput} disabled={paused} />
        {nearBook && !paused && guideMode !== 'compact' && (
          <button
            className="book-interact"
            onClick={() => setGuestbook(true)}
          >
            <span>펼쳐진 방명록</span>책 열기 <kbd>E</kbd>
          </button>
        )}
        {selected && (
          <div className="overlay" onMouseDown={() => setSelected(null)}>
            <section
              className="panel art-detail"
              onMouseDown={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={selected.title}
            >
              <button
                className="close"
                onClick={() => setSelected(null)}
                aria-label="닫기"
              >
                ×
              </button>
              <img src={selected.image} alt={selected.title} />
              <span className="eyebrow">
                ARTWORK {selected.id} / ZONE {selected.zone}
              </span>
              <h2>{selected.title}</h2>
              <p>{selected.description}</p>
            </section>
          </div>
        )}
        {guestbook && <Guestbook onClose={() => setGuestbook(false)} />}
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
