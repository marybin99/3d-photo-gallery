import { useRef, type RefObject } from 'react';
import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { MathUtils, Shape, ShapeGeometry, type Group } from 'three';

const HEART = new Shape()
  .moveTo(0, -0.052)
  .bezierCurveTo(-0.026, -0.031, -0.058, -0.008, -0.058, 0.019)
  .bezierCurveTo(-0.058, 0.053, -0.019, 0.064, 0, 0.032)
  .bezierCurveTo(0.019, 0.064, 0.058, 0.053, 0.058, 0.019)
  .bezierCurveTo(0.058, -0.008, 0.026, -0.031, 0, -0.052);
const geometry = new ShapeGeometry(HEART);
const POPS = [
  { delay: 0, x: -0.105, y: 0.01, tilt: 0.19, size: 0.82 },
  { delay: 0.18, x: 0.015, y: 0.065, tilt: -0.08, size: 1.05 },
  { delay: 0.36, x: 0.13, y: 0.025, tilt: -0.18, size: 0.75 },
];

export default function HamsterHearts({ remaining, duration, reducedMotion }: {
  remaining: RefObject<number>;
  duration: number;
  reducedMotion: MediaQueryList;
}) {
  const hearts = useRef<(Group | null)[]>([]);

  useFrame(() => {
    const elapsed = duration - remaining.current;
    for (const [index, pop] of POPS.entries()) {
      const heart = hearts.current[index];
      if (!heart) continue;
      const age = elapsed - pop.delay;
      const still = reducedMotion.matches;
      heart.visible = still || (age >= 0 && age < 1.05);
      if (!heart.visible) continue;
      const progress = still ? 0.62 : MathUtils.clamp(age / 1.05, 0, 1);
      const scale = still ? 1 : MathUtils.smoothstep(progress, 0, 0.17)
        * (1 - MathUtils.smoothstep(progress, 0.64, 1));
      heart.position.set(pop.x * (0.55 + progress * 0.6), pop.y + progress * 0.25, 0);
      heart.scale.setScalar(pop.size * scale);
    }
  });

  return (
    <Billboard name="hamster-hearts" position={[0, 0.255, 0.12]}>
      {POPS.map((pop, index) => (
        <group key={pop.delay} ref={(heart) => { hearts.current[index] = heart; }} visible={false}
          rotation={[0, 0, pop.tilt]}>
          <mesh geometry={geometry} scale={1.13} raycast={() => null}>
            <meshBasicMaterial color="#a4b8c9" toneMapped={false} />
          </mesh>
          <mesh name="hamster-white-heart" geometry={geometry} position={[0, 0, 0.002]} raycast={() => null}>
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </Billboard>
  );
}
