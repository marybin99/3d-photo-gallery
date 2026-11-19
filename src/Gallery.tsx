import { useFrame, useThree } from '@react-three/fiber';
import { Html, Text } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { type Artwork } from './data';
import ArtworkImage from './ArtworkImage';
import YouTubePlayer from './YouTubePlayer';
import ClosedRoomCurtain from './ClosedRoomCurtain';
import { fillArtworkSlots } from './artworkModel';
import { roomName, type RoomNames } from './roomModel';
import {
  type GalleryLayout,
  moveAndSlide,
  SPAWN,
  BOOK,
  desk,
} from './layout';
import Character from './Character';
import { updateCharacterMotion, type CharacterMotion } from './locomotion';
import {
  bindMouseLook,
  DEFAULT_PITCH,
  mouseLook,
  movementDelta,
} from './controls';
import { followCameraPosition, CAMERA_LOOK_HEIGHT } from './camera';
export { SPAWN } from './layout';

export type Pose = { x: number; z: number; yaw: number };
function useKeyboard(enabled: boolean) {
  const keys = useRef(new Set<string>());
  useEffect(() => {
    const keyState = keys.current;
    keyState.clear();
    if (!enabled) return;
    const down = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, select, button, [contenteditable]')
      )
        return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (
        ![
          'w',
          'a',
          's',
          'd',
          'arrowup',
          'arrowdown',
          'arrowleft',
          'arrowright',
        ].includes(key)
      )
        return;
      event.preventDefault();
      keyState.add(key);
    };
    const up = (event: KeyboardEvent) =>
      keyState.delete(event.key.toLowerCase());
    const blur = () => keyState.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', blur);
    return () => {
      keyState.clear();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', blur);
    };
  }, [enabled]);
  return keys;
}
function Wall({
  position,
  args,
  color = '#f3eee5',
}: {
  position: [number, number, number];
  args: [number, number, number];
  color?: string;
}) {
  return (
    <mesh position={position} receiveShadow castShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  );
}
function ImageFrame({
  art,
  onSelect,
  playing,
}: {
  art: Artwork;
  onSelect: (a: Artwork) => void;
  playing: boolean;
}) {
  const isVideo=!!art.youtubeId;
  const frameHeight=isVideo?1.17875:1.52;
  const labelY=isVideo?-.73:-.88;
  return (
    <group
      position={art.position}
      rotation={[0, art.rotation, 0]}
      scale={1.4}
      onClick={art.image ? (event) => {
        event.stopPropagation();
        onSelect(art);
      } : undefined}
      onPointerOver={() => (document.body.style.cursor = art.image ? 'pointer' : 'auto')}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[1.94, frameHeight, 0.11]} />
        <meshStandardMaterial color="#806d59" roughness={0.65} />
      </mesh>
      <mesh position={[0, 0, 0.064]}>
        <planeGeometry args={isVideo?[1.82,1.05875]:[1.74,1.32]} />
        <meshBasicMaterial color="#fdfbf8" />
      </mesh>
      {art.image && <ArtworkImage url={art.image} width={isVideo?1.74:1.62} height={isVideo?.97875:1.2} />}
      {art.youtubeId&&!playing&&<Text position={[0,0,.09]} fontSize={.3} color="white">▶</Text>}
      {/* Blend the video through a depth-tested opening in the canvas so the
          character and other foreground geometry remain in front of it. */}
      {art.youtubeId&&playing&&<Html transform position={[0,0,.1]} distanceFactor={1.0875} pointerEvents="none" occlude="blending" zIndexRange={[2,0]}>
        <div className="artwork-video-screen"><YouTubePlayer videoId={art.youtubeId} title={art.title} controls={false}/></div>
      </Html>}
      <mesh position={[0, labelY, 0.08]}>
        <planeGeometry args={[1.35, 0.25]} />
        <meshBasicMaterial color="#f8f5ed" />
      </mesh>
      <Text
        fontSize={0.115}
        anchorX="center"
        color="#51483e"
        position={[0, labelY, 0.09]}
      >
        {art.title}
      </Text>
      {art.wall === 'front' && (
        <spotLight
          position={[0, 2, 1.8]}
          angle={0.5}
          penumbra={0.9}
          intensity={3.4}
          distance={5}
          color="#ffe8d0"
          target-position={[0, 0, 0]}
        />
      )}
    </group>
  );
}
function Player({
  pose,
  onPose,
  mobileInput,
  paused,
  layout,
}: {
  pose: React.RefObject<Pose>;
  onPose: (p: Pose) => void;
  mobileInput: React.RefObject<{ forward: number; right: number }>;
  paused: boolean;
  layout: GalleryLayout;
}) {
  const body = useRef<THREE.Group>(null);
  const motion = useRef<CharacterMotion>({
    speed: 0,
    distance: 0,
    facing: SPAWN.yaw,
  });
  const velocity = useRef({ x: 0, z: 0 });
  const lastPose = useRef(pose.current);
  const cameraReady = useRef(false);
  const { camera, gl, events } = useThree();
  const lookSurface = events.connected instanceof HTMLElement
    ? events.connected
    : gl.domElement.parentElement ?? gl.domElement;
  const pitch = useRef(DEFAULT_PITCH);
  useEffect(() => {
    if (paused) return;
    // HTML video depth blending disables pointer events on the canvas itself.
    // Its stable event container continues receiving drags during playback.
    return bindMouseLook(lookSurface, (dx, dy) => {
      const look = mouseLook(pose.current.yaw, pitch.current, dx, dy);
      pose.current.yaw = look.yaw;
      pitch.current = look.pitch;
    });
  }, [lookSurface, paused, pose]);
  const broadcast = useRef(0);
  const keys = useKeyboard(!paused);
  const target = useMemo(() => new THREE.Vector3(), []);
  const lookAt = useMemo(() => new THREE.Vector3(), []);
  const ray = useMemo(() => new THREE.Ray(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const cameraWalls = useMemo(
    () =>
      layout.obstacles.map(
        (w) =>
          new THREE.Box3(
            new THREE.Vector3(
              w.x - w.width / 2 - 0.2,
              0,
              w.z - w.depth / 2 - 0.2,
            ),
            new THREE.Vector3(
              w.x + w.width / 2 + 0.2,
              (w.height ?? 4.8) + 0.2,
              w.z + w.depth / 2 + 0.2,
            ),
          ),
      ),
    [layout],
  );
  useFrame((_, delta) => {
    const p = pose.current;
    if (!p) return;
    const d = Math.min(delta, 0.06);
    const keyState = keys.current;
    const forward = paused
      ? 0
      : THREE.MathUtils.clamp(
          (keyState.has('w') || keyState.has('arrowup') ? 1 : 0) -
            (keyState.has('s') || keyState.has('arrowdown') ? 1 : 0) +
            mobileInput.current.forward,
          -1,
          1,
        );
    const right = paused
      ? 0
      : THREE.MathUtils.clamp(
          (keyState.has('d') || keyState.has('arrowright') ? 1 : 0) -
            (keyState.has('a') || keyState.has('arrowleft') ? 1 : 0) +
            mobileInput.current.right,
          -1,
          1,
        );
    const resetCamera = !cameraReady.current || lastPose.current !== p;
    if (resetCamera) {
      lastPose.current = p;
      velocity.current = { x: 0, z: 0 };
      motion.current = { speed: 0, distance: 0, facing: p.yaw };
      pitch.current = DEFAULT_PITCH;
    }
    const desired = movementDelta(p.yaw, forward, right, 3.6);
    const damping = forward || right ? 12 : 20;
    velocity.current.x = paused
      ? 0
      : THREE.MathUtils.damp(velocity.current.x, desired.x, damping, d);
    velocity.current.z = paused
      ? 0
      : THREE.MathUtils.damp(velocity.current.z, desired.z, damping, d);
    if (Math.hypot(velocity.current.x, velocity.current.z) < 0.015)
      velocity.current = { x: 0, z: 0 };
    const next = moveAndSlide(
      p.x,
      p.z,
      velocity.current.x * d,
      velocity.current.z * d,
      undefined,
      layout,
    );
    updateCharacterMotion(motion.current, next.x - p.x, next.z - p.z, d);
    p.x = next.x;
    p.z = next.z;
    if (body.current) body.current.position.set(p.x, 0, p.z);
    target.set(...followCameraPosition(p, pitch.current));
    if (resetCamera) camera.position.copy(target);
    else camera.position.lerp(target, 1 - Math.exp(-14 * d));
    cameraReady.current = true;
    // Keep the follow camera on the player's side of room walls.
    lookAt.set(p.x, CAMERA_LOOK_HEIGHT, p.z);
    ray.origin.copy(lookAt);
    ray.direction.copy(camera.position).sub(lookAt).normalize();
    let distance = camera.position.distanceTo(lookAt);
    for (const box of cameraWalls) {
      if (ray.intersectBox(box, hit))
        distance = Math.min(
          distance,
          Math.max(0.15, lookAt.distanceTo(hit) - 0.15),
        );
    }
    camera.position.copy(lookAt).addScaledVector(ray.direction, distance);
    camera.lookAt(lookAt);
    broadcast.current += d;
    if (broadcast.current > 0.07) {
      broadcast.current = 0;
      onPose({ ...p });
    }
  });
  return (
    <group ref={body} position={[SPAWN.x, 0, SPAWN.z]}>
      <Character motion={motion} />
    </group>
  );
}

function GuestbookDesk({ onOpen }: { onOpen: () => void }) {
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    if (hovered) document.body.style.cursor = 'pointer';
    return () => {
      if (hovered) document.body.style.cursor = 'auto';
    };
  }, [hovered]);
  return (
    <group position={[BOOK.x, 0, BOOK.z]}>
      <Wall
        position={[0, 1.1, 0]}
        args={[desk.width, 0.16, desk.depth]}
        color="#80684f"
      />
      {[-0.95, 0.95].flatMap((x) =>
        [-0.45, 0.45].map((z) => (
          <Wall
            key={`${x}-${z}`}
            position={[x, 0.53, z]}
            args={[0.12, 1.06, 0.12]}
            color="#80684f"
          />
        )),
      )}
      <group
        position={[0, 1.27, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <mesh position={[0, -0.04, 0]}>
          <boxGeometry args={[1.65, 0.09, 1.06]} />
          <meshStandardMaterial color={hovered ? '#a87b52' : '#624c41'} />
        </mesh>
        {[-1, 1].map((side) => (
          <group
            key={side}
            position={[side * 0.39, 0.025, 0]}
            rotation={[0, 0, side * 0.09]}
          >
            <mesh castShadow>
              <boxGeometry args={[0.77, 0.08, 0.96]} />
              <meshStandardMaterial color={hovered ? '#fff7d9' : '#f5ead2'} />
            </mesh>
            {[0, 1, 2, 3, 4].map((line) => (
              <mesh
                key={line}
                position={[0, 0.045, -0.28 + line * 0.13]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <planeGeometry args={[0.5, 0.012]} />
                <meshBasicMaterial color="#b4a18a" />
              </mesh>
            ))}
          </group>
        ))}
        <mesh position={[0.64, 0.12, 0.1]} rotation={[0, 0.3, 0.3]}>
          <boxGeometry args={[0.025, 0.025, 0.55]} />
          <meshStandardMaterial color="#57483e" />
        </mesh>
      </group>
      <Text position={[0, 2.35, 0]} fontSize={0.22} color="#655143">
        GUESTBOOK
      </Text>
      <Text position={[0, 2.03, 0]} fontSize={0.13} color="#796955">
        CLICK THE OPEN BOOK
      </Text>
      <pointLight
        position={[0, 2.8, 0]}
        intensity={3}
        distance={5}
        color="#ffe1b0"
      />
    </group>
  );
}
function Doorway({
  position,
  rotation = 0,
  label,
  returnLabel,
  closed,
}: {
  position: [number, number, number];
  rotation?: number;
  label: string;
  returnLabel: string;
  closed: boolean;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {closed&&<ClosedRoomCurtain/>}
      <Wall position={[-2.05, 2, 0]} args={[0.16, 4, 0.42]} color="#ac9477" />
      <Wall position={[2.05, 2, 0]} args={[0.16, 4, 0.42]} color="#ac9477" />
      <Wall position={[0, 4.35, 0]} args={[4.3, 0.9, 0.42]} color="#ac9477" />
      <Text position={[0, 4.32, 0.24]} fontSize={0.28} maxWidth={3.6} overflowWrap="break-word" lineHeight={1.1} textAlign="center" anchorY="middle" color="#fff6e7">
        {label}
      </Text>
      <Text
        position={[0, 4.32, -0.24]}
        rotation={[0, Math.PI, 0]}
        fontSize={0.22}
        color="#fff6e7"
      >
        {returnLabel}
      </Text>
    </group>
  );
}
export default function Gallery({
  artworks,
  roomNames,
  slots,
  onSelect,
  onGuestbook,
  pose,
  onPose,
  mobileInput,
  paused,
  videoPaused=paused,
  layout,
}: {
  artworks: Artwork[];
  roomNames: RoomNames;
  slots: Artwork[];
  onSelect: (a: Artwork) => void;
  onGuestbook: () => void;
  pose: React.RefObject<Pose>;
  onPose: (p: Pose) => void;
  mobileInput: React.RefObject<{ forward: number; right: number }>;
  paused: boolean;
  videoPaused?: boolean;
  layout: GalleryLayout;
}) {
  // Keep the shader light count bounded as the connected wing grows.
  const focusX=Math.round(pose.current.x/8)*8;
  const focusZ=Math.round(pose.current.z/8)*8;
  const nearbyAreas=useMemo(()=>new Set(layout.areas.filter(area=>area.id!=='CORRIDOR'&&!layout.closedRoomIds.includes(area.id))
    .sort((a,b)=>Math.hypot(a.x-focusX,a.z-focusZ)-Math.hypot(b.x-focusX,b.z-focusZ))
    .slice(0,4).map(area=>area.id)),[layout,focusX,focusZ]);
  const visibleDoors=layout.doorways.filter(door=>Math.hypot(door.x-focusX,door.z-focusZ)<32);
  return (
    <>
      <color attach="background" args={['#e6dfd4']} />
      <ambientLight intensity={1.15} />
      <hemisphereLight args={['#fff6e9', '#a8a39b', 2.2]} />
      <directionalLight
        position={[3, 18, 6]}
        intensity={2.0}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-28}
        shadow-camera-right={28}
        shadow-camera-top={28}
        shadow-camera-bottom={-28}
        shadow-camera-far={70}
      />
      {layout.areas.map((area) => (
        <group key={area.id}>
          <mesh
            receiveShadow
            rotation={[-Math.PI / 2, 0, 0]}
            position={[area.x, -0.05, area.z]}
          >
            <planeGeometry args={[area.width, area.depth]} />
            <meshStandardMaterial color={area.color} roughness={0.9} />
          </mesh>
          {nearbyAreas.has(area.id)&&<pointLight
            position={[area.x, 4.5, area.z]}
            intensity={15}
            distance={22}
            color="#fff1db"
          />}
        </group>
      ))}
      {layout.walls.map((w, i) => (
        <Wall
          key={i}
          position={[w.x, 2.4, w.z]}
          args={[w.width, 4.8, w.depth]}
        />
      ))}
      {visibleDoors.map((door) => (
        <Doorway
          key={door.zone}
          position={[door.x, 0, door.z]}
          rotation={door.rotation}
          label={roomName(door.zone,roomNames)}
          returnLabel={roomName(door.returnZone ?? 'LOBBY',roomNames)}
          closed={layout.closedRoomIds.includes(door.zone)}
        />
      ))}
      {fillArtworkSlots(artworks, slots).filter(art=>nearbyAreas.has(art.zone)).map((art) => (
        <ImageFrame key={art.id} art={art} onSelect={onSelect} playing={!videoPaused} />
      ))}
      <Text
        position={[4, 2.8, 9.8]}
        rotation={[0, Math.PI, 0]}
        fontSize={0.4}
        color="#625549"
      >
        THE ROOM
      </Text>
      <Text
        position={[0, 0.01, 6.6]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.5}
        color="#86735c"
      >
        LOBBY
      </Text>
      <GuestbookDesk onOpen={onGuestbook} />
      <Player
        pose={pose}
        onPose={onPose}
        mobileInput={mobileInput}
        paused={paused}
        layout={layout}
      />
    </>
  );
}
