import {
  BufferGeometry,
  CatmullRomCurve3,
  Euler,
  Float32BufferAttribute,
  LatheGeometry,
  MathUtils,
  Matrix4,
  Quaternion,
  SphereGeometry,
  SplineCurve,
  Vector2,
  Vector3,
} from 'three';
import type { Hairstyle } from '../avatar';
import { plush } from './avatarMaterials';

const brim = new LatheGeometry(
  new SplineCurve([
    new Vector2(.416, -.055),
    new Vector2(.484, -.058),
    new Vector2(.52, -.03),
    new Vector2(.524, .02),
    new Vector2(.498, .057),
    new Vector2(.436, .061),
    new Vector2(.413, .022),
    new Vector2(.416, -.055),
  ]).getPoints(28),
  48,
);
const pompom = new SphereGeometry(1, 26, 18);

function createCap() {
  const centerline = new CatmullRomCurve3([
    new Vector3(0, -.025, 0),
    new Vector3(-.01, .11, .012),
    new Vector3(-.035, .25, .02),
    new Vector3(-.091, .39, .02),
    new Vector3(-.209, .48, .01),
    new Vector3(-.356, .45, -.015),
    new Vector3(-.468, .363, -.028),
    new Vector3(-.545, .273, -.035),
  ]);
  const radii = new SplineCurve([
    new Vector2(.49, .411),
    new Vector2(.452, .384),
    new Vector2(.369, .315),
    new Vector2(.266, .224),
    new Vector2(.19, .152),
    new Vector2(.119, .095),
    new Vector2(.065, .058),
    new Vector2(.014, .014),
  ]);

  const rows = 36;
  const sides = 48;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const center = centerline.getPoint(t);
    const tangent = centerline.getTangent(t);
    const cross = new Vector2(tangent.y, -tangent.x).normalize();
    const radius = radii.getPoint(t);
    for (let side = 0; side < sides; side++) {
      const turn = side / sides * Math.PI * 2;
      const lateral = Math.cos(turn) * radius.x;
      positions.push(
        center.x + cross.x * lateral,
        center.y + cross.y * lateral,
        center.z + Math.sin(turn) * radius.y,
      );
      uvs.push(side / sides, t);
      if (row === rows) continue;
      const a = row * sides + side;
      const b = row * sides + (side + 1) % sides;
      indices.push(a, a + sides, b, b, a + sides, b + sides);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const cap = createCap();

const brimHeights: Partial<Record<Hairstyle, number>> = {
  classic: .866,
  curly: .874,
  mohawk: .879,
  bob: .865,
  bun: .879,
  braids: .865,
};

function hatFit(hair: Hairstyle) {
  return {
    position: new Vector3(0, brimHeights[hair] ?? .89, hair === 'bun' ? .049 : .026),
    rotation: new Euler(.025, 0, hair === 'mohawk' ? .066 : .045),
    scale: new Vector3(.75, 1, .83),
  };
}

export function fitHairUnderSantaHat(geometry: BufferGeometry, hair: Hairstyle, offsetY: number) {
  const { position, rotation, scale } = hatFit(hair);
  const hatToHead = new Matrix4().compose(position, new Quaternion().setFromEuler(rotation), scale);
  const headToHat = hatToHead.clone().invert();
  const original = geometry.getAttribute('position');
  const positions = new Float32BufferAttribute(new Float32Array(original.array), 3);
  const vertex = new Vector3();

  for (let i = 0; i < original.count; i++) {
    vertex.fromBufferAttribute(original, i);
    vertex.y += offsetY;
    vertex.applyMatrix4(headToHat);
    if (vertex.y <= -.1) continue;

    // Tuck the crown into the space inside the band, with a smooth transition below it.
    const tuck = MathUtils.smoothstep(vertex.y, -.1, .006);
    const radius = Math.hypot(vertex.x / .438, vertex.z / .354);
    const squeeze = MathUtils.lerp(1, 1 / Math.max(1, radius), tuck);
    vertex.x *= squeeze;
    vertex.z *= squeeze;
    if (vertex.y > -.018) {
      vertex.y = -.018 + .052 * (1 - Math.exp(-(vertex.y + .018) / .052));
    }

    vertex.applyMatrix4(hatToHead);
    positions.setXYZ(i, vertex.x, vertex.y - offsetY, vertex.z);
  }

  const fitted = new BufferGeometry();
  fitted.setAttribute('position', positions);
  fitted.setAttribute('normal', geometry.getAttribute('normal'));
  fitted.setAttribute('uv', geometry.getAttribute('uv'));
  return fitted;
}

export default function SantaHat({ hair }: { hair: Hairstyle }) {
  const { position, rotation, scale } = hatFit(hair);
  return (
    <group name="santa-hat" position={position} rotation={rotation} scale={scale}>
      <mesh scale={[1, .63, 1]} castShadow>
        <primitive object={cap} attach="geometry" />
        <primitive object={plush.hatRed} attach="material" />
      </mesh>
      <mesh scale={[1, .83, .855]} castShadow>
        <primitive object={brim} attach="geometry" />
        <primitive object={plush.hatFur} attach="material" />
      </mesh>
      <mesh position={[-.545, .173, -.035]} scale={[.07, .07, .069]} castShadow>
        <primitive object={pompom} attach="geometry" />
        <primitive object={plush.hatFur} attach="material" />
      </mesh>
    </group>
  );
}
