import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import Gallery, { SPAWN, type Pose } from './Gallery';
import { followCameraPosition } from './camera';
import { type Artwork } from './data';
import { areas, areaAt, BOOK } from './layout';
import { supabase } from './supabase';
import Guestbook from './Guestbook';
import MobileControls from './MobileControls';
import ControlsGuide from './ControlsGuide';
import { useArtworkCatalog } from './useArtworkCatalog';
import { useRoomNames } from './useRoomNames';
import { roomName, mapNameLines, type RoomNames } from './roomModel';
import './styles.css';
const AdminPage = lazy(() => import('./AdminPage'));

function App() {
  const [admin, setAdmin] = useState(() =>
    window.location.hash.startsWith('#/admin'),
  );
  useEffect(() => {
    const navigate = () => setAdmin(window.location.hash.startsWith('#/admin'));
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  return admin ? (
    <Suspense fallback={<p role="status">관리자 화면을 여는 중…</p>}>
      <AdminPage />
    </Suspense>
  ) : (
    <GalleryApp />
  );
}

function MiniMap({ pose, names }: { pose: Pose; names: RoomNames }) {
  const mapX = (x: number) => 110 + x * 4;
  const mapY = (z: number) => 100 + z * 4;
  return (
    <div className="minimap" aria-label="미니맵: 로비와 A·B·C 전시실">
      <div className="minimap-heading">
        <span>GALLERY MAP</span>
        <span className="live-dot" />
      </div>
      <svg
        viewBox="0 0 220 152"
        role="img"
        aria-label={`현재 위치: ${roomName(areaAt(pose.x, pose.z).id, names)}`}
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
              fontSize="7"
            >
              {mapNameLines(roomName(area.id, names)).map((line, index) => (
                <tspan key={index} x={mapX(area.x)} dy={index === 0 ? 0 : 9}>
                  {line}
                </tspan>
              ))}
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
      </svg>
    </div>
  );
}
function GalleryApp() {
  const catalog = useArtworkCatalog();
  const rooms = useRoomNames(supabase);
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
              artworks={catalog.items}
              roomNames={rooms.names}
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
            THE ROOM
            <small>ONLINE EXHIBITION</small>
          </div>
          <div className="location-badge" role="status">
            현재 위치 · {roomName(currentArea.id, rooms.names)}
            <small>
              {currentArea.id === 'LOBBY'
                ? '펼쳐진 책을 클릭하면 방명록이 열립니다'
                : '문을 통해 중앙 로비로 돌아갈 수 있습니다'}
            </small>
          </div>
        </div>
        {(catalog.loading ||
          catalog.error ||
          (!catalog.demo && catalog.items.length === 0)) && (
          <div
            className="catalog-status"
            role={catalog.error ? 'alert' : 'status'}
          >
            {catalog.error ||
              (catalog.loading
                ? '전시 작품을 불러오는 중…'
                : '아직 공개된 작품이 없습니다.')}
            {catalog.error && (
              <button onClick={() => void catalog.reload()}>다시 시도</button>
            )}
          </div>
        )}
        {minimap && <MiniMap pose={pose} names={rooms.names} />}
        <button className="map-toggle" onClick={() => setMinimap((v) => !v)}>
          {minimap ? '지도 숨기기' : '미니맵 보기'}
        </button>
        <div className="bottom-left">
          <div className="guide-anchor">
            <button
              aria-expanded={guideMode === 'compact'}
              aria-controls="compact-controls"
              onClick={() => {
                setGuideMode((mode) => (mode === 'compact' ? null : 'compact'));
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
          <button className="book-interact" onClick={() => setGuestbook(true)}>
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
                ARTWORK {selected.id} / {roomName(selected.zone, rooms.names)}
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
