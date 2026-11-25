import { memo, useLayoutEffect, useRef } from 'react';
import {
  CatmullRomCurve3, Color, LatheGeometry, Matrix4, Shape, Vector2, Vector3,
  type InstancedMesh,
} from 'three';
import { lobbyTree } from './layout';

type Position = [number, number, number];
type Decoration = { position: Position; color: string; radius: number };

// Both endpoints of every cord are on the same wall segment.
const wallSpans: [Position, Position][] = [
  [[-7.55, 4.12, -5.75], [-2.35, 4.12, -5.75]],
  [[2.35, 4.12, -5.75], [7.55, 4.12, -5.75]],
  ...([-7.75, 7.75] as const).flatMap((x): [Position, Position][] => [
    [[x, 4.12, -5.7], [x, 4.12, -1.38]],
    [[x, 4.12, 3.38], [x, 4.12, 9.55]],
  ]),
  [[-7.52, 4.12, 9.74], [-4.5, 4.12, 9.74]],
  [[4.5, 4.12, 9.74], [7.52, 4.12, 9.74]],
];
const wallCords = wallSpans.map(([start, end]) => {
  const a = new Vector3(...start);
  const b = new Vector3(...end);
  const length = a.distanceTo(b);
  return new CatmullRomCurve3(Array.from({ length: 13 }, (_, index) => {
    const t = index / 12;
    return a.clone().lerp(b, t).add(new Vector3(0, -4 * t * (1 - t) * length * 0.09, 0));
  }));
});
const wallSockets: Decoration[] = [];
const wallBulbs: Decoration[] = wallCords.flatMap((cord) => {
  const count = Math.round(cord.getLength() / 0.43);
  return Array.from({ length: count }, (_, index) => {
    const { x, y, z } = cord.getPoint((index + 0.5) / count);
    wallSockets.push({ position: [x, y - 0.035, z], color: '#4b4435', radius: 0.036 });
    return { position: [x, y - 0.098, z], color: index % 3 ? '#ffd18a' : '#ffe5ac', radius: 0.065 };
  });
});

const tiers = [
  { y: 0.43, radius: 1.21, height: 1.35, color: '#163e30' },
  { y: 0.88, radius: 1.08, height: 1.32, color: '#1a4934' },
  { y: 1.36, radius: 0.9, height: 1.25, color: '#1b4936' },
  { y: 1.84, radius: 0.73, height: 1.13, color: '#20533a' },
  { y: 2.28, radius: 0.57, height: 1.02, color: '#24563e' },
  { y: 2.69, radius: 0.42, height: 0.95, color: '#265c42' },
  { y: 3.06, radius: 0.29, height: 0.76, color: '#2a6347' },
];
const foliage = new LatheGeometry([
  new Vector2(0, 0.12), new Vector2(0.66, 0.025), new Vector2(1, 0.03),
  new Vector2(0.82, 0.17), new Vector2(0.62, 0.32), new Vector2(0.43, 0.51),
  new Vector2(0.22, 0.74), new Vector2(0, 1),
], 48);
const vertices = foliage.attributes.position;
for (let i = 0; i < vertices.count; i++) {
  const x = vertices.getX(i);
  const z = vertices.getZ(i);
  const y = vertices.getY(i);
  const theta = Math.atan2(x, z);
  const edge = Math.min(1, Math.hypot(x, z));
  const ripple = 0.065 * Math.cos(theta * 8) + 0.03 * Math.sin(theta * 5);
  vertices.setXYZ(i, x * (1 + ripple), y + edge * 0.025 * Math.sin(theta * 7), z * (1 + ripple));
}
foliage.computeVertexNormals();

const ornamentColors = ['#a62734', '#cf962d', '#c53740', '#eee0b5'];
const baubles: Decoration[] = tiers.flatMap((tier, ring) =>
  Array.from({ length: 9 - ring }, (_, index) => {
    const angle = index * Math.PI * 2 / (9 - ring) + ring * 1.43;
    const radius = tier.radius * (0.83 + 0.12 * (index % 2));
    return {
      position: [Math.sin(angle) * radius, tier.y + 0.13 + 0.08 * (index % 2), Math.cos(angle) * radius],
      color: ornamentColors[(index + ring) % ornamentColors.length],
      radius: 0.082 - ring * 0.006,
    };
  }),
);
const treeBulbs: Decoration[] = tiers.flatMap((tier, ring) =>
  Array.from({ length: 15 - ring }, (_, index) => {
    const angle = index * Math.PI * 2 / (15 - ring) + ring * 1.61;
    const radius = tier.radius * 0.96;
    return {
      position: [Math.sin(angle) * radius, tier.y + 0.15 + 0.06 * Math.sin(angle * 2), Math.cos(angle) * radius],
      color: index % 4 ? '#ffcf7b' : '#fff0c3',
      radius: 0.034,
    };
  }),
);
const star = new Shape();
for (let i = 0; i < 10; i++) {
  const angle = Math.PI / 2 + i * Math.PI / 5;
  const radius = i % 2 === 0 ? 0.27 : 0.125;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  if (i === 0) star.moveTo(x, y);
  else star.lineTo(x, y);
}
star.closePath();

function OrnamentBatch({ items, glow = false, elongation = 1 }: {
  items: Decoration[];
  glow?: boolean;
  elongation?: number;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current!;
    const matrix = new Matrix4();
    const color = new Color();
    items.forEach(({ position, radius, color: tone }, index) => {
      matrix.makeScale(radius, radius * elongation, radius).setPosition(...position);
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, color.set(tone));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, elongation]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]}>
      <sphereGeometry args={[1, 8, 6]} />
      {glow ? <meshBasicMaterial toneMapped={false} /> : <meshStandardMaterial roughness={0.32} metalness={0.22} />}
    </instancedMesh>
  );
}

function Gift({ position, size, color, ribbon }: {
  position: Position; size: Position; color: string; ribbon: string;
}) {
  const [width, height, depth] = size;
  return (
    <group position={position} rotation={[0, 0.15, 0]}>
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.75} />
      </mesh>
      {([[width + 0.006, height + 0.008, 0.065], [0.065, height + 0.007, depth + 0.006]] as Position[]).map((dimensions, index) => (
        <mesh key={index}>
          <boxGeometry args={dimensions} />
          <meshStandardMaterial color={ribbon} roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}

export default memo(function LobbyChristmas() {
  return (
    <group name="lobby-christmas">
      {wallCords.map((cord, index) => (
        <mesh key={index}>
          <tubeGeometry args={[cord, 24, 0.013, 5, false]} />
          <meshStandardMaterial color="#514432" roughness={0.92} />
        </mesh>
      ))}
      <OrnamentBatch items={wallSockets} elongation={1.35} />
      <OrnamentBatch items={wallBulbs} glow elongation={1.18} />
      <group name="christmas-tree" position={[lobbyTree.x, 0, lobbyTree.z]}>
        <mesh position={[0, 0.02, 0]} receiveShadow>
          <cylinderGeometry args={[1.24, 1.24, 0.035, 40]} />
          <meshStandardMaterial color="#8b2633" roughness={0.96} />
        </mesh>
        <mesh position={[0, 0.039, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.17, 1.2, 40]} />
          <meshStandardMaterial color="#c4a151" />
        </mesh>
        <mesh position={[0, 0.33, 0]}>
          <cylinderGeometry args={[0.095, 0.14, 0.65, 12]} />
          <meshStandardMaterial color="#62422b" />
        </mesh>
        {tiers.map(({ y, radius, height, color }, index) => (
          <mesh key={y} geometry={foliage} position={[0, y, 0]} scale={[radius, height, radius]} rotation={[0, index * 0.23, 0]} castShadow>
            <meshStandardMaterial color={color} roughness={0.93} />
          </mesh>
        ))}
        <mesh position={[0, 3.89, 0]} rotation={[0, 0.22, 0]}>
          <extrudeGeometry args={[star, { depth: 0.045, bevelSize: 0.017, bevelThickness: 0.014, bevelSegments: 1 }]} />
          <meshStandardMaterial color="#f4c254" emissive="#e5a72e" emissiveIntensity={0.45} metalness={0.27} roughness={0.34} />
        </mesh>
        <OrnamentBatch items={baubles} />
        <OrnamentBatch items={treeBulbs} glow />
        <Gift position={[-0.6, 0.16, 0.72]} size={[0.52, 0.32, 0.45]} color="#b03b43" ribbon="#eec981" />
        <Gift position={[0.08, 0.125, 0.92]} size={[0.41, 0.25, 0.37]} color="#d3ae62" ribbon="#8c2933" />
        <Gift position={[0.61, 0.18, 0.57]} size={[0.46, 0.36, 0.51]} color="#efe3ca" ribbon="#2c6047" />
      </group>
    </group>
  );
});
