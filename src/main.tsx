import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import Gallery, { SPAWN, type Pose } from './Gallery';
import { followCameraPosition, GALLERY_FOV } from './camera';
import { artworkSlots, type Artwork } from './data';
import {
  areaAt,
  BOOK,
  createGalleryLayout,
  reconcileGalleryPose,
} from './layout';
import { supabase } from './supabase';
import Guestbook from './Guestbook';
import MobileControls from './MobileControls';
import ControlsGuide from './ControlsGuide';
import { useArtworkCatalog } from './useArtworkCatalog';
import { useRoomNames } from './useRoomNames';
import { roomName } from './roomModel';
import MiniMap from './MiniMap';
import YouTubePlayer from './YouTubePlayer';
import MusicControls from './MusicControls';
import { createMusicRepository, type MusicTrack } from './galleryMusic';
import './styles.css';
const AdminPage = lazy(() => import('./AdminPage'));
const SNOW_PREFERENCE = 'gallery-lobby-snow';
const MOBILE_RENDERING = '(max-width: 680px), (any-pointer: coarse)';

function initialSnowEnabled() {
  try {
    const saved = localStorage.getItem(SNOW_PREFERENCE);
    if (saved === 'on' || saved === 'off') return saved === 'on';
  } catch {
    // The toggle still works when browser storage is unavailable.
  }
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

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

function GalleryApp() {
  const rooms = useRoomNames(supabase);
  const roomKey = rooms.ids.join(',');
  const slots = useMemo(() => artworkSlots(roomKey.split(',')), [roomKey]);
  const openKey = rooms.openIds.join(',');
  const layout = useMemo(
    () =>
      createGalleryLayout(
        roomKey.split(','),
        roomKey.split(',').filter((id) => !openKey.split(',').includes(id)),
      ),
    [roomKey, openKey],
  );
  const openSlots = useMemo(
    () => slots.filter((slot) => openKey.split(',').includes(slot.zone)),
    [slots, openKey],
  );
  const catalog = useArtworkCatalog(openSlots);
  const [pose, setPose] = useState<Pose>({ ...SPAWN });
  const poseRef = useRef<Pose>({ ...SPAWN });
  const previousLayout = useRef(layout);
  useEffect(() => {
    const next = reconcileGalleryPose(
      poseRef.current,
      previousLayout.current,
      layout,
    );
    previousLayout.current = layout;
    if (next !== poseRef.current) {
      poseRef.current = next;
      setPose({ ...next });
    }
  }, [layout]);
  const mobileInput = useRef({ forward: 0, right: 0 });
  const videoPositions = useRef(new Map<string, number>()).current;
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  useEffect(() => {
    if (!supabase) return;
    const repository = createMusicRepository(supabase);
    let request = 0;
    const reload = () => {
      const current = ++request;
      void repository
        .read()
        .then((settings) => {
          if (request === current) setMusicTracks(repository.tracks(settings));
        })
        .catch(() => {});
    };
    reload();
    window.addEventListener('focus', reload);
    return () => {
      ++request;
      window.removeEventListener('focus', reload);
    };
  }, []);
  const [selected, setSelected] = useState<Artwork | null>(null);
  const [guestbook, setGuestbook] = useState(false);
  const selectArtwork = useCallback(
    (art: Artwork) => {
      if (openKey.split(',').includes(art.zone)) setSelected(art);
    },
    [openKey],
  );
  useEffect(() => {
    setSelected((art) =>
      art && openSlots.some((slot) => slot.id === art.id) ? art : null,
    );
  }, [openSlots]);
  const [guideMode, setGuideMode] = useState<'welcome' | 'compact' | null>(
    'welcome',
  );
  const galleryView = useRef<HTMLDivElement>(null);
  const closeGuide = () => {
    setGuideMode(null);
    galleryView.current?.focus({ preventScroll: true });
  };
  const [minimap, setMinimap] = useState(true);
  const [mobileRendering, setMobileRendering] = useState(
    () => window.matchMedia(MOBILE_RENDERING).matches,
  );
  useEffect(() => {
    const media = window.matchMedia(MOBILE_RENDERING);
    const update = () => setMobileRendering(media.matches);
    media.addEventListener('change', update);
    update();
    return () => media.removeEventListener('change', update);
  }, []);
  const [snowEnabled, setSnowEnabled] = useState(initialSnowEnabled);
  const toggleSnow = () => {
    const next = !snowEnabled;
    setSnowEnabled(next);
    try {
      localStorage.setItem(SNOW_PREFERENCE, next ? 'on' : 'off');
    } catch {
      // Keep the current view usable without storage.
    }
  };
  const paused = selected !== null || guestbook || guideMode === 'welcome';
  const currentArea = areaAt(pose.x, pose.z, layout);
  const currentOpenRoomId = rooms.openIds.includes(currentArea.id)
    ? currentArea.id
    : null;
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
      <div
        className="gallery-view"
        data-expanded-wing={rooms.ids.length > 3}
        ref={galleryView}
        tabIndex={-1}
      >
        <Canvas
          className="gallery-canvas"
          shadows
          gl={{ alpha: true }}
          style={{ isolation: 'isolate' }}
          dpr={[1, mobileRendering ? 1.25 : 1.7]}
          camera={{ position: followCameraPosition(SPAWN), fov: GALLERY_FOV }}
        >
          <Suspense fallback={null}>
            <Gallery
              artworks={catalog.items}
              roomNames={rooms.names}
              entranceColors={rooms.entranceColors}
              signTextColors={rooms.signTextColors}
              snowEnabled={snowEnabled}
              mobileRendering={mobileRendering}
              slots={slots}
              layout={layout}
              onSelect={selectArtwork}
              onGuestbook={() => setGuestbook(true)}
              pose={poseRef}
              onPose={setPose}
              mobileInput={mobileInput}
              paused={paused}
              videoRoomId={paused ? null : currentOpenRoomId}
              videoPositions={videoPositions}
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
                : currentArea.id === 'CORRIDOR'
                  ? '통로 양옆의 문으로 전시실에 들어갈 수 있습니다'
                  : '입구를 통해 로비와 다른 전시실로 이어집니다'}
            </small>
          </div>
          {musicTracks.length > 0 && <MusicControls tracks={musicTracks} />}
        </div>
        {(rooms.loading ||
          rooms.error ||
          catalog.loading ||
          catalog.error ||
          (!catalog.demo && catalog.items.length === 0)) && (
          <div
            className="catalog-status"
            role={rooms.error || catalog.error ? 'alert' : 'status'}
          >
            {rooms.error ||
              catalog.error ||
              (rooms.loading
                ? '전시실 오픈 정보를 확인하는 중…'
                : catalog.loading
                  ? '전시 작품을 불러오는 중…'
                  : rooms.openIds.length === 0
                    ? '새로운 전시를 준비하고 있습니다.'
                    : '아직 공개된 작품이 없습니다.')}
            {(rooms.error || catalog.error) && (
              <button
                onClick={() => {
                  void rooms.reload();
                  void catalog.reload();
                }}
              >
                다시 시도
              </button>
            )}
          </div>
        )}
        <div className="map-controls">
          {minimap && (
            <MiniMap pose={pose} names={rooms.names} layout={layout} />
          )}
          <div className="map-actions">
            <button
              className="map-toggle"
              onClick={() => setMinimap((v) => !v)}
            >
              {minimap ? '지도 숨기기' : '미니맵 보기'}
            </button>
            <button
              type="button"
              className="map-toggle snow-toggle"
              aria-pressed={snowEnabled}
              onClick={toggleSnow}
            >
              <span aria-hidden="true">❄</span> 눈 효과
            </button>
          </div>
        </div>
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
          <label className="room-navigation">
            <span className="room-navigation-label">전시실 이동</span>
            <select
              value={currentArea.id === 'LOBBY' ? '' : currentArea.id}
              disabled={paused || rooms.openIds.length === 0}
              onChange={(event) => {
                const id = event.target.value;
                if (!rooms.openIds.includes(id)) return;
                const area = layout.areas.find((area) => area.id === id);
                if (area) {
                  const next = { x: area.x, z: area.z + 3, yaw: 0 };
                  poseRef.current = next;
                  setPose({ ...next });
                }
              }}
            >
              <option value="" disabled hidden>
                {rooms.openIds.length ? '전시실 선택' : '오픈한 전시실 없음'}
              </option>
              {currentArea.id === 'CORRIDOR' && (
                <option value="CORRIDOR" disabled>
                  연결 통로
                </option>
              )}
              {rooms.ids.map((id) => (
                <option
                  key={id}
                  value={id}
                  disabled={!rooms.openIds.includes(id)}
                >
                  {roomName(id, rooms.names)}
                  {rooms.openIds.includes(id) ? '' : ' · 준비 중'}
                </option>
              ))}
            </select>
          </label>
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
              {selected.youtubeId && selected.zone === currentOpenRoomId ? (
                <YouTubePlayer
                  artworkId={selected.id}
                  videoId={selected.youtubeId}
                  title={selected.title}
                  positions={videoPositions}
                />
              ) : (
                <img src={selected.image} alt={selected.title} />
              )}
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
