import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DataTexture, DynamicDrawUsage, LinearFilter, type BufferAttribute } from 'three';

const FLAKE_COUNT = 260;
const MIN_Y = 0.12;
const MAX_Y = 4.75;
const TEXTURE_SIZE = 16;
const pixels = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

for (let y = 0; y < TEXTURE_SIZE; y++) {
  for (let x = 0; x < TEXTURE_SIZE; x++) {
    const radius = Math.hypot(x + 0.5 - TEXTURE_SIZE / 2, y + 0.5 - TEXTURE_SIZE / 2) / (TEXTURE_SIZE / 2);
    const index = (y * TEXTURE_SIZE + x) * 4;
    pixels.set([255, 255, 255, Math.round(255 * Math.max(0, 1 - radius ** 2) ** 2)], index);
  }
}
const snowflake = new DataTexture(pixels, TEXTURE_SIZE, TEXTURE_SIZE);
snowflake.magFilter = LinearFilter;
snowflake.minFilter = LinearFilter;
snowflake.needsUpdate = true;

export default function LobbySnow() {
  const positions = useRef<BufferAttribute>(null);
  const { coordinates, speed } = useMemo(() => {
    const coordinates = new Float32Array(FLAKE_COUNT * 3);
    const speed = new Float32Array(FLAKE_COUNT);
    for (let i = 0; i < FLAKE_COUNT; i++) {
      // Leave a margin at the walls so drifting flakes stay inside the lobby.
      coordinates[i * 3] = Math.random() * 14.3 - 7.15;
      coordinates[i * 3 + 1] = MIN_Y + Math.random() * (MAX_Y - MIN_Y);
      coordinates[i * 3 + 2] = Math.random() * 14.3 - 5.15;
      speed[i] = 0.34 + Math.random() * 0.51;
    }
    return { coordinates, speed };
  }, []);

  useFrame(({ clock }, delta) => {
    const step = Math.min(delta, 0.05);
    for (let i = 0; i < FLAKE_COUNT; i++) {
      const index = i * 3;
      const sway = clock.elapsedTime * 1.25 + i * 2.17;
      coordinates[index] += Math.sin(sway) * step * 0.19;
      coordinates[index + 1] -= speed[i] * step;
      coordinates[index + 2] += Math.cos(sway) * step * 0.12;
      if (coordinates[index + 1] < MIN_Y) coordinates[index + 1] += MAX_Y - MIN_Y;
    }
    if (positions.current) positions.current.needsUpdate = true;
  });

  return (
    <points name="lobby-snow" frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute ref={positions} attach="attributes-position" args={[coordinates, 3]} usage={DynamicDrawUsage} />
      </bufferGeometry>
      <pointsMaterial
        size={0.10}
        sizeAttenuation
        color="#f6fbff"
        map={snowflake}
        transparent
        opacity={0.86}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}
