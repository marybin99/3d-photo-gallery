import { MathUtils } from 'three';
import { lobbyTree } from './layout.ts';

export type HamsterGroundPoint = { x: number; z: number };
export type HamsterGait = 'crawl' | 'roll' | 'tumble';

export const HAMSTER_START = { x: -0.66, z: 0.03 };
export const HAMSTER_PATCH = { x: lobbyTree.x + 2.61, z: lobbyTree.z + 0.18 };
export const HAMSTER_COLLISION_SIZE = 0.46;
export const HAMSTER_RANGE = { x: 0.83, z: 0.42 };
export const HAMSTER_GAITS: HamsterGait[] = ['crawl', 'roll', 'tumble'];

export function nextHamsterStop(from: HamsterGroundPoint, random = Math.random) {
  let best = from;
  let longest = 0;
  for (let candidate = 0; candidate < 8; candidate++) {
    const angle = random() * Math.PI * 2;
    const radius = 0.6 + random() * 0.4;
    const next = {
      x: Math.cos(angle) * radius * HAMSTER_RANGE.x,
      z: Math.sin(angle) * radius * HAMSTER_RANGE.z,
    };
    const distance = Math.hypot(next.x - from.x, next.z - from.z);
    if (distance >= 0.74) return next;
    if (distance > longest) {
      best = next;
      longest = distance;
    }
  }
  return best;
}

export function hamsterGaitAt(gait: HamsterGait, time: number) {
  const ease = MathUtils.smoothstep(time, 0, 1);
  if (gait === 'crawl') return { progress: ease, roll: 0, wiggle: 0 };
  if (gait === 'roll') return { progress: ease, roll: ease * Math.PI * 2, wiggle: 0 };

  const ontoBack = MathUtils.smoothstep(time, 0, 0.39);
  const ontoFeet = MathUtils.smoothstep(time, 0.66, 1);
  const progress = (ontoBack + ontoFeet) / 2;
  const wiggle = MathUtils.smoothstep(time, 0.33, 0.45) * (1 - MathUtils.smoothstep(time, 0.61, 0.72));
  return { progress, roll: progress * Math.PI * 2, wiggle };
}
