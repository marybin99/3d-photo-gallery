import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import { Group, MathUtils, MeshBasicMaterial, QuadraticBezierCurve3, Vector2, Vector3, type Box3 } from 'three';
import { createFoxHeartTexture } from '../foxHeart';
import { createFoxRoute } from '../foxRoute';
import { overlapsBarrier } from '../layout';
import { turnTowards, updateCharacterMotion } from '../locomotion';
import type { Barrier, CharacterMotion, GalleryLayout, Pose } from '../types';
import { usePetInteraction, type PetTarget } from './usePetInteraction';

const FUR = '#ce541d';
const HEAD = '#e16929';
const CREAM = '#fff0ce';
const DARK = '#372120';
const PACE = 1.45;
const STRIDE = 0.5;
const STANCE = 0.56;
const START_YAW = 2.65;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const PET_DURATION = 1.7;
const SMILE_EYE = new QuadraticBezierCurve3(
  new Vector3(-0.033, -0.004, 0),
  new Vector3(0, 0.045, -0.016),
  new Vector3(0.033, -0.004, 0),
);
const WHISKERS = [
  new QuadraticBezierCurve3(
    new Vector3(0.167, -0.064, -0.282),
    new Vector3(0.237, -0.043, -0.276),
    new Vector3(0.318, -0.038, -0.208),
  ),
  new QuadraticBezierCurve3(
    new Vector3(0.164, -0.081, -0.284),
    new Vector3(0.253, -0.076, -0.278),
    new Vector3(0.325, -0.086, -0.216),
  ),
  new QuadraticBezierCurve3(
    new Vector3(0.167, -0.097, -0.279),
    new Vector3(0.229, -0.109, -0.264),
    new Vector3(0.299, -0.127, -0.211),
  ),
];
const PAWS = [
  { x: -0.15, z: -0.24, offset: 0.25 },
  { x: 0.15, z: -0.24, offset: 0.75 },
  { x: -0.15, z: 0.24, offset: 0 },
  { x: 0.15, z: 0.24, offset: 0.5 },
];
const TAIL_BASE = [
  new Vector2(0.065, 0),
  new Vector2(0.11, 0.12),
  new Vector2(0.166, 0.28),
  new Vector2(0.157, 0.42),
  new Vector2(0.14, 0.48),
];
const TAIL_TIP = [
  TAIL_BASE[4],
  new Vector2(0.11, 0.55),
  new Vector2(0.057, 0.63),
  new Vector2(0, 0.68),
];

function FurShape({
  position,
  scale,
  color,
  castShadow = false,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  castShadow?: boolean;
}) {
  return (
    <mesh position={position} scale={scale} castShadow={castShadow}>
      <sphereGeometry args={[1, 14, 10]} />
      <meshStandardMaterial color={color} roughness={0.86} />
    </mesh>
  );
}

export default function GalleryFox({
  layout,
  paused,
  playerPose,
  body,
  viewObstacles,
  shortcut,
}: {
  layout: GalleryLayout;
  paused: boolean;
  playerPose: RefObject<Pose>;
  body: RefObject<Barrier>;
  viewObstacles: Box3[];
  shortcut: RefObject<PetTarget | null>;
}) {
  const route = useMemo(() => createFoxRoute(layout), [layout]);
  const heartTexture = useMemo(createFoxHeartTexture, []);
  const root = useRef<Group>(null);
  const rig = useRef<Group>(null);
  const head = useRef<Group>(null);
  const tail = useRef<Group>(null);
  const legs = useRef<(Group | null)[]>([]);
  const heart = useRef<Group>(null);
  const heartMaterial = useRef<MeshBasicMaterial>(null);
  const petTime = useRef(0);
  const [petted, setPetted] = useState(false);
  const motion = useRef<CharacterMotion>({ speed: 0, distance: 0, facing: START_YAW });
  const patrol = useRef({ route, next: 1, wait: route[0].pause ?? 0, speed: 0 });
  const gait = useRef(0);
  const time = useRef(0);
  const tailPhase = useRef(0);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia(REDUCED_MOTION).matches,
  );
  useEffect(() => () => heartTexture.dispose(), [heartTexture]);
  useEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION);
    const update = () => setReducedMotion(query.matches);
    query.addEventListener('change', update);
    update();
    return () => query.removeEventListener('change', update);
  }, []);

  const startPetting = useCallback(() => {
    petTime.current = PET_DURATION;
    setPetted(true);
  }, []);
  const pet = usePetInteraction(root, 0.46, !paused, viewObstacles, shortcut, startPetting);

  useFrame((_, delta) => {
    const fox = root.current;
    if (!fox || !rig.current || !head.current || !tail.current) return;
    if (patrol.current.route !== route) {
      patrol.current = { route, next: 1, wait: route[0].pause ?? 0, speed: 0 };
      motion.current = { speed: 0, distance: 0, facing: START_YAW };
      fox.position.set(route[0].x, 0, route[0].z);
    }

    const d = Math.min(delta, 0.06);
    if (petTime.current > 0) {
      petTime.current = paused ? 0 : Math.max(0, petTime.current - d);
      if (petTime.current === 0) setPetted(false);
    }
    const happy = petTime.current > 0;
    let dx = 0;
    let dz = 0;
    const state = patrol.current;
    const player = playerPose.current;
    if (!paused && !reducedMotion) {
      time.current += d;
    }
    if (!paused && !reducedMotion && !happy) {
      if (state.wait > 0) {
        state.wait -= d;
      } else {
        const target = route[state.next];
        const x = target.x - fox.position.x;
        const z = target.z - fox.position.z;
        const distance = Math.hypot(x, z);
        const targetSpeed = target.pause
          ? Math.min(PACE, Math.sqrt(4.4 * distance))
          : PACE;
        state.speed = MathUtils.damp(state.speed, targetSpeed, 5, d);
        const step = Math.min(distance, state.speed * d);
        const nextX = distance > 0 ? fox.position.x + (x / distance) * step : target.x;
        const nextZ = distance > 0 ? fox.position.z + (z / distance) * step : target.z;
        const nextBody = { ...body.current, x: nextX, z: nextZ };
        // Allow the fox to walk away if room navigation placed the visitor inside its body.
        const separating =
          overlapsBarrier(player.x, player.z, body.current) &&
          Math.hypot(player.x - nextX, player.z - nextZ) >
          Math.hypot(player.x - fox.position.x, player.z - fox.position.z);
        if (overlapsBarrier(player.x, player.z, nextBody) && !separating) {
          state.speed = 0;
        } else {
          dx = nextX - fox.position.x;
          dz = nextZ - fox.position.z;
          fox.position.set(nextX, 0, nextZ);
          if (step === distance) {
            state.next = (state.next + 1) % route.length;
            state.wait = target.pause ?? 0;
            if (state.wait > 0) state.speed = 0;
          }
        }
      }
    } else {
      state.speed = 0;
    }

    body.current.x = fox.position.x;
    body.current.z = fox.position.z;
    const movement = motion.current;
    updateCharacterMotion(movement, dx, dz, d);
    if (happy) {
      const angle = Math.atan2(fox.position.x - player.x, fox.position.z - player.z);
      movement.facing = reducedMotion ? angle : turnTowards(movement.facing, angle, d);
    }
    fox.rotation.y = movement.facing;
    gait.current = reducedMotion
      ? 0
      : MathUtils.damp(gait.current, movement.speed / PACE, 14, d);
    const weight = gait.current;
    const cycle = movement.distance / STRIDE;
    const phase = cycle * Math.PI * 2;
    if (!paused && !reducedMotion) tailPhase.current += d * (happy ? 8 : 4);
    if (heart.current && heartMaterial.current) {
      const progress = 1 - petTime.current / PET_DURATION;
      heart.current.position.y = reducedMotion ? 1.22 : 1.12 + progress * 0.4;
      heart.current.scale.setScalar(reducedMotion ? 1 : 0.72 + MathUtils.smoothstep(progress, 0, 0.2) * 0.28);
      heartMaterial.current.opacity = reducedMotion ? 1 : 1 - MathUtils.smoothstep(progress, 0.65, 1);
    }
    const sniff = !paused && !reducedMotion && !happy && state.wait > 0;
    const headTilt = happy ? 0.28 : 0;

    rig.current.position.y = (1 - Math.cos(phase * 2)) * 0.0035 * weight;
    rig.current.rotation.z = Math.sin(phase) * 0.018 * weight;
    head.current.rotation.x = MathUtils.damp(
      head.current.rotation.x,
      reducedMotion ? 0 : headTilt - (sniff ? 0.24 + Math.sin(time.current * 17) * 0.1 : 0),
      12,
      d,
    );
    tail.current.rotation.y = reducedMotion
      ? 0
      : MathUtils.damp(
          tail.current.rotation.y,
          Math.sin(tailPhase.current) * (happy ? 0.27 : 0.1 + 0.12 * weight),
          18,
          d,
        );
    for (const [index, leg] of legs.current.entries()) {
      if (!leg) continue;
      const paw = PAWS[index];
      const progress = (cycle + paw.offset) % 1;
      const swing = MathUtils.clamp((progress - STANCE) / (1 - STANCE), 0, 1);
      // A planted paw moves backward relative to the body, then lifts and swings forward.
      const reach = progress < STANCE
        ? progress / STANCE
        : 1 - MathUtils.smoothstep(swing, 0, 1);
      const offset = (reach - 0.5) * STRIDE * STANCE * weight;
      leg.position.z = paw.z + offset * 0.65;
      leg.position.y = 0.25 + Math.sin(swing * Math.PI) ** 2 * 0.042 * weight;
      leg.rotation.x = -offset * 2;
    }
  }, -1);

  return (
    <group
      ref={root}
      name="gallery-fox"
      position={[route[0].x, 0, route[0].z]}
      rotation={[0, START_YAW, 0]}
      scale={0.9}
      onClick={(event) => {
        if (pet(event.point)) event.stopPropagation();
      }}
    >
      {petted && (
        <Billboard ref={heart} position={[0, 1.12, -0.295]} raycast={() => null}>
          <mesh name="fox-heart" raycast={() => null}>
            <planeGeometry args={[0.38, 0.38]} />
            <meshBasicMaterial
              ref={heartMaterial}
              map={heartTexture}
              toneMapped={false}
              transparent
              alphaTest={0.015}
              depthWrite={false}
            />
          </mesh>
        </Billboard>
      )}
      <group ref={rig}>
        <FurShape position={[0, 0.33, 0.06]} scale={[0.24, 0.21, 0.43]} color={FUR} castShadow />
        <FurShape position={[0, 0.355, -0.245]} scale={[0.21, 0.2, 0.19]} color={CREAM} />
        <group ref={tail} position={[0, 0.31, 0.39]}>
          <group rotation={[1.02, 0, 0.17]}>
            <mesh castShadow>
              <latheGeometry args={[TAIL_BASE, 16]} />
              <meshStandardMaterial color={FUR} />
            </mesh>
            <mesh castShadow>
              <latheGeometry args={[TAIL_TIP, 16]} />
              <meshStandardMaterial color={CREAM} />
            </mesh>
          </group>
        </group>
        <group ref={head} position={[0, 0.55, -0.295]}>
          <FurShape position={[0, 0, 0]} scale={[0.281, 0.235, 0.243]} color={HEAD} castShadow />
          {[-1, 1].map((side) => (
            <group key={side}>
              <group position={[side * 0.159, 0.22, 0.025]} rotation={[0, 0, -side * 0.27]}>
                <mesh scale={[1, 1, 0.56]} castShadow>
                  <coneGeometry args={[0.139, 0.294, 4, 1]} />
                  <meshStandardMaterial color={FUR} />
                </mesh>
                <mesh position={[0, -0.015, -0.031]} scale={[1, 1, 0.49]}>
                  <coneGeometry args={[0.091, 0.198, 4, 1]} />
                  <meshStandardMaterial color="#e6a187" />
                </mesh>
              </group>
              <FurShape position={[side * 0.143, -0.08, -0.158]} scale={[0.147, 0.106, 0.122]} color={CREAM} />
              <group scale={[side, 1, 1]}>
                {WHISKERS.map((curve, index) => (
                  <mesh key={index} name="fox-whisker">
                    <tubeGeometry args={[curve, 8, 0.0055, 5, false]} />
                    <meshStandardMaterial color="#ffffff" roughness={0.95} />
                  </mesh>
                ))}
              </group>
              {petted ? (
                <mesh name="fox-smiling-eye" position={[side * 0.123, 0.035, -0.236]}>
                  <tubeGeometry args={[SMILE_EYE, 12, 0.008, 5, false]} />
                  <meshStandardMaterial color={DARK} />
                </mesh>
              ) : (
                <>
                  <FurShape position={[side * 0.123, 0.035, -0.214]} scale={[0.037, 0.046, 0.024]} color={DARK} />
                  <FurShape position={[side * 0.123 - 0.009, 0.049, -0.234]} scale={[0.011, 0.013, 0.007]} color="#fff9eb" />
                </>
              )}
            </group>
          ))}
          <FurShape position={[0, -0.073, -0.227]} scale={[0.127, 0.087, 0.139]} color={CREAM} />
          <FurShape position={[0, -0.038, -0.35]} scale={[0.058, 0.037, 0.037]} color={DARK} />
        </group>
        {PAWS.map(({ x, z }, index) => (
          <group key={index} position={[x, 0.25, z]} ref={(leg) => { legs.current[index] = leg; }}>
            <FurShape position={[0, -0.069, 0]} scale={[0.069, 0.128, 0.071]} color={FUR} />
            <FurShape position={[0, -0.176, -0.025]} scale={[0.062, 0.072, 0.09]} color={DARK} castShadow />
          </group>
        ))}
      </group>
    </group>
  );
}
