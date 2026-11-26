import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils, type Box3, type Group } from 'three';
import {
  HAMSTER_GAITS, HAMSTER_PATCH, HAMSTER_START, hamsterGaitAt, nextHamsterStop,
  type HamsterGait, type HamsterGroundPoint,
} from '../hamsterRoam';
import { createHamsterSnowfield, SNOW_HEIGHT, SNOW_TRACK_DEPTH } from '../hamsterSnow';
import { overlapsBarrier } from '../layout';
import { turnTowards } from '../locomotion';
import type { Barrier, Pose } from '../types';
import HamsterHearts from './HamsterHearts';
import HamsterModel, { HAMSTER_HALF_LENGTH } from './HamsterModel';
import { usePetInteraction, type PetTarget } from './usePetInteraction';

type Position = [number, number, number];

const HAMSTER_Y = SNOW_HEIGHT + 0.175;
const PET_DURATION = 1.62;

type Trip = {
  from: HamsterGroundPoint;
  to: HamsterGroundPoint;
  gait: HamsterGait;
  elapsed: number;
  duration: number;
  yaw: number;
  turn: number;
};

const snowPiles: [position: Position, scale: Position][] = [
  [[-0.78, 0.096, -0.48], [0.33, 0.095, 0.165]],
  [[-0.45, 0.093, -0.57], [0.3, 0.11, 0.145]],
  [[0.39, 0.09, -0.57], [0.34, 0.10, 0.16]],
  [[0.76, 0.092, -0.47], [0.255, 0.083, 0.16]],
  [[1.05, 0.081, 0.26], [0.18, 0.075, 0.14]],
  [[0.56, 0.084, 0.57], [0.27, 0.083, 0.13]],
  [[-0.8, 0.082, 0.49], [0.20, 0.074, 0.115]],
];

function SnowPuff({ position, scale }: {
  position: Position;
  scale: Position;
}) {
  return (
    <mesh position={position} scale={scale}>
      <sphereGeometry args={[1, 20, 14]} />
      <meshStandardMaterial color="#e9f6ff" roughness={0.97} />
    </mesh>
  );
}

export default memo(function LobbyHamster({ active, paused, body, playerPose, viewObstacles, shortcut }: {
  active: boolean;
  paused: boolean;
  body: RefObject<Barrier>;
  playerPose: RefObject<Pose>;
  viewObstacles: Box3[];
  shortcut: RefObject<PetTarget | null>;
}) {
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)'), []);
  const snow = useMemo(createHamsterSnowfield, []);
  const hamster = useRef<Group>(null);
  const rollRig = useRef<Group>(null);
  const paws = useRef<(Group | null)[]>([]);
  const trip = useRef<Trip | null>(null);
  const gaits = useRef<HamsterGait[]>([]);
  const snowClock = useRef(0);
  const lastTrack = useRef<HamsterGroundPoint>(HAMSTER_START);
  const packedDepth = useRef(0);
  const petTime = useRef(0);
  const [petted, setPetted] = useState(false);
  const startPetting = useCallback(() => {
    petTime.current = PET_DURATION;
    trip.current = null;
    setPetted(true);
  }, []);
  const pet = usePetInteraction(hamster, 0.065, active && !paused, viewObstacles, shortcut, startPetting);

  useEffect(() => () => snow.geometry.dispose(), [snow]);

  useFrame((_, delta) => {
    const animal = hamster.current;
    const rig = rollRig.current;
    if (!animal || !rig) return;
    if (!active || paused) {
      if (petTime.current > 0) {
        petTime.current = 0;
        setPetted(false);
      }
      return;
    }
    const step = Math.min(delta, 0.06);
    const player = playerPose.current;
    if (petTime.current > 0 || reducedMotion.matches) {
      trip.current = null;
      const upright = Math.round(rig.rotation.x / (Math.PI * 2)) * Math.PI * 2;
      rig.rotation.x = reducedMotion.matches ? upright : MathUtils.damp(rig.rotation.x, upright, 11, step);
      rig.rotation.z = reducedMotion.matches ? 0 : MathUtils.damp(rig.rotation.z, 0, 11, step);
      const grounded = HAMSTER_Y - packedDepth.current + rollLift(rig.rotation.x);
      animal.position.y = reducedMotion.matches ? grounded : MathUtils.damp(animal.position.y, grounded, 14, step);
      for (const paw of paws.current) {
        if (!paw) continue;
        paw.rotation.x = reducedMotion.matches ? 0 : MathUtils.damp(paw.rotation.x, 0, 11, step);
        paw.scale.z = 1;
      }
      if (petTime.current > 0) {
        const yaw = Math.atan2(player.x - body.current.x, player.z - body.current.z);
        animal.rotation.y = reducedMotion.matches ? yaw : turnTowards(animal.rotation.y, yaw, step);
        petTime.current = Math.max(0, petTime.current - step);
        if (petTime.current === 0) setPetted(false);
      }
      return;
    }

    if (!trip.current) {
      const from = { x: animal.position.x, z: animal.position.z };
      const to = nextHamsterStop(from);
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      const yaw = animal.rotation.y;
      const angle = Math.atan2(dx, dz) - yaw;
      if (gaits.current.length === 0) gaits.current = [...HAMSTER_GAITS];
      const [gait] = gaits.current.splice(Math.floor(Math.random() * gaits.current.length), 1);
      trip.current = {
        from, to, gait, yaw,
        elapsed: 0,
        duration: (gait === 'tumble' ? 2.35 : 1.4) + Math.hypot(dx, dz) * 0.66,
        turn: Math.atan2(Math.sin(angle), Math.cos(angle)),
      };
    }

    const motion = trip.current;
    motion.elapsed += step;
    const time = MathUtils.clamp((motion.elapsed - 0.66) / motion.duration, 0, 1);
    const { progress, roll, wiggle } = hamsterGaitAt(motion.gait, time);
    const crawling = motion.gait === 'crawl' ? Math.sin(time * Math.PI) : 0;
    const footbeat = time * motion.duration * 19;
    const bounce = rollLift(roll) + Math.sin(roll / 2) * 0.024 + (1 - Math.cos(footbeat * 2)) * 0.004 * crawling;
    const x = MathUtils.lerp(motion.from.x, motion.to.x, progress);
    const z = MathUtils.lerp(motion.from.z, motion.to.z, progress);
    const nextBody = { ...body.current, x: HAMSTER_PATCH.x + x, z: HAMSTER_PATCH.z + z };
    if (overlapsBarrier(player.x, player.z, nextBody)) {
      const isLeavingContact = overlapsBarrier(player.x, player.z, body.current)
        && Math.hypot(player.x - nextBody.x, player.z - nextBody.z)
          > Math.hypot(player.x - body.current.x, player.z - body.current.z);
      if (!isLeavingContact) {
        motion.elapsed -= step;
        return;
      }
    }
    body.current.x = nextBody.x;
    body.current.z = nextBody.z;
    snowClock.current += step;
    if (snowClock.current >= 0.075) {
      const current = { x, z };
      if (Math.hypot(x - lastTrack.current.x, z - lastTrack.current.z) > 0.002) {
        packedDepth.current = SNOW_TRACK_DEPTH;
      }
      snow.updateTrail(lastTrack.current, current, snowClock.current);
      lastTrack.current = current;
      snowClock.current = 0;
    }
    animal.position.set(x, HAMSTER_Y + bounce - packedDepth.current, z);
    animal.rotation.y = motion.yaw + motion.turn * MathUtils.smoothstep(motion.elapsed, 0.21, 0.68);
    rig.rotation.x = roll;
    rig.rotation.z = Math.sin(footbeat * 0.55) * (wiggle * 0.18 + crawling * 0.035);
    for (const [index, paw] of paws.current.entries()) {
      if (!paw) continue;
      const kick = Math.sin(footbeat + index * Math.PI * 0.75);
      paw.rotation.x = kick * (wiggle * 0.9 + crawling * 0.42);
      paw.scale.z = 1 + kick * wiggle * 0.25;
    }
    if (time === 1) trip.current = null;
  }, -1);

  return (
    <group name="lobby-hamster-snowfield" visible={active} position={[HAMSTER_PATCH.x, 0, HAMSTER_PATCH.z]}>
      <mesh name="hamster-snow" geometry={snow.geometry} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.97} />
      </mesh>
      {snowPiles.map(([position, scale], index) => (
        <SnowPuff key={index} position={position} scale={scale} />
      ))}
      <group ref={hamster} name="lobby-hamster" position={[HAMSTER_START.x, HAMSTER_Y, HAMSTER_START.z]}
        onClick={(event) => { if (pet(event.point)) event.stopPropagation(); }}>
        {petted && <HamsterHearts remaining={petTime} duration={PET_DURATION} reducedMotion={reducedMotion} />}
        <group ref={rollRig} name="hamster-tumble">
          <HamsterModel paws={paws} happy={petted} />
        </group>
      </group>
    </group>
  );
});

function rollLift(roll: number) {
  return Math.hypot(0.175 * Math.cos(roll), HAMSTER_HALF_LENGTH * Math.sin(roll)) - 0.175;
}
