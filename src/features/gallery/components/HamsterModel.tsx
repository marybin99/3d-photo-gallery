import type { RefObject } from 'react';
import {
  Color, Float32BufferAttribute, LatheGeometry, MathUtils, QuadraticBezierCurve3,
  SphereGeometry, Vector2, Vector3, type Group,
} from 'three';

const WIDTH = 0.18;
const HEIGHT = 0.18;
export const HAMSTER_HALF_LENGTH = 0.241;
const CREAM = new Color('#f3ddba');
const APRICOT = new Color('#dd9356');
const BROWN = new Color('#8b6554');
const INK = '#4a3024';

function coatColor(x: number, y: number, z: number, color: Color) {
  const belly = -0.078 + 0.028 * Math.sin(z * 17 + 0.7) + 0.013 * Math.sin(x * 20 - z * 12) - y;
  const blazeCenter = 0.021 * Math.sin(z * 17 + 0.4) - 0.013 * Math.sin(y * 23);
  const blazeWidth = 0.032 + 0.115 * (1 - MathUtils.smoothstep(y, -0.074, 0.132));
  const face = Math.min(
    blazeWidth - Math.abs(x - blazeCenter),
    z - 0.06 - 0.054 * Math.sin(x * 18 + 0.3),
  );
  const stripe = Math.min(
    0.035 + 0.016 * Math.sin(z * 16) - Math.abs(x - blazeCenter),
    y - 0.065,
    z + 0.165,
  );
  const rump = -0.092 + 0.050 * Math.sin(y * 16 + x * 15) + 0.04 * x - z;
  const cap = 0.085 * (1 - Math.hypot(
    (x + 0.127 + 0.021 * Math.sin(z * 16)) / 0.082,
    (y - 0.134) / 0.104,
    (z - 0.096) / 0.18,
  ));
  const pale = MathUtils.smoothstep(Math.max(belly, face, stripe), -0.005, 0.005);
  const dark = MathUtils.smoothstep(Math.max(rump, cap), -0.005, 0.005)
    * (1 - MathUtils.smoothstep(belly, -0.01, 0.012));
  color.copy(APRICOT).lerp(CREAM, pale).lerp(BROWN, dark);
}

function createBody() {
  const geometry = new SphereGeometry(1, 96, 72);
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const colors = new Float32Array(positions.count * 3);
  const shade = new Color();
  const normal = new Vector3();

  for (let vertex = 0; vertex < positions.count; vertex++) {
    const across = positions.getX(vertex);
    const length = positions.getY(vertex);
    const height = -positions.getZ(vertex);
    const width = WIDTH * (1 + 0.06 * length);
    const rawY = HEIGHT * height + 0.008 * length;
    const flatten = rawY < -0.096 ? Math.tanh((rawY + 0.096) / 0.065) : 0;
    const y = rawY < -0.096 ? -0.096 + 0.065 * flatten : rawY;
    const x = across * width;
    const z = length * HAMSTER_HALF_LENGTH;

    positions.setXYZ(vertex, x, y, z);
    normal.set(across / width, height / (HEIGHT * (1 - flatten ** 2)), 0);
    normal.z = (length - normal.x * across * WIDTH * 0.06 - normal.y * 0.008) / HAMSTER_HALF_LENGTH;
    normal.normalize();
    normals.setXYZ(vertex, normal.x, normal.y, normal.z);
    coatColor(x, y, z, shade);
    shade.toArray(colors, vertex * 3);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

function createEar() {
  // The profile curls back toward the center on the front side to form a shallow cup.
  const geometry = new LatheGeometry([
    new Vector2(0, -0.023), new Vector2(0.027, -0.023), new Vector2(0.046, -0.015),
    new Vector2(0.055, -0.003), new Vector2(0.056, 0.012), new Vector2(0.05, 0.025),
    new Vector2(0.043, 0.028), new Vector2(0.036, 0.022), new Vector2(0.03, 0.012),
    new Vector2(0.019, 0.006), new Vector2(0, 0.006),
  ], 32);
  const positions = geometry.getAttribute('position');
  const tones = new Float32Array(positions.count * 3);
  const inside = new Color('#d8a67e');
  const shade = new Color();
  for (let vertex = 0; vertex < positions.count; vertex++) {
    const radius = Math.hypot(positions.getX(vertex), positions.getZ(vertex));
    const cup = (1 - MathUtils.smoothstep(radius, 0.026, 0.046))
      * MathUtils.smoothstep(positions.getY(vertex), -0.002, 0.006);
    shade.copy(BROWN).lerp(inside, cup).toArray(tones, vertex * 3);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(tones, 3));
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

function facePoint(x: number, y: number, raised = 0.004) {
  let inner = 0.55;
  let outer = 1;
  for (let step = 0; step < 14; step++) {
    const length = (inner + outer) / 2;
    const across = x / (WIDTH * (1 + 0.06 * length));
    const height = (y - 0.008 * length) / HEIGHT;
    if (across ** 2 + height ** 2 + length ** 2 <= 1) inner = length;
    else outer = length;
  }
  return new Vector3(x, y, inner * HAMSTER_HALF_LENGTH + raised);
}

const coat = createBody();
const ear = createEar();
const mouth = [
  new QuadraticBezierCurve3(facePoint(-0.012, -0.002), facePoint(0, -0.015), facePoint(0, -0.012)),
  new QuadraticBezierCurve3(facePoint(0.012, -0.002), facePoint(0, -0.015), facePoint(0, -0.012)),
  new QuadraticBezierCurve3(facePoint(0, -0.012), facePoint(0, -0.021), facePoint(0, -0.03)),
  new QuadraticBezierCurve3(facePoint(0, -0.03), facePoint(-0.009, -0.044), facePoint(-0.021, -0.036)),
  new QuadraticBezierCurve3(facePoint(0, -0.03), facePoint(0.009, -0.044), facePoint(0.021, -0.036)),
];
const eyes = [-1, 1].map(side => facePoint(side * 0.079, 0.037));
const smileEye = new QuadraticBezierCurve3(
  new Vector3(-0.015, -0.004, 0),
  new Vector3(0, 0.022, 0.004),
  new Vector3(0.015, -0.004, 0),
);

export default function HamsterModel({ paws, happy }: { paws: RefObject<(Group | null)[]>; happy: boolean }) {
  return (
    <>
      <mesh name="hamster-coat" geometry={coat} castShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      {[-1, 1].map((side, index) => (
        <group key={side}>
          <mesh geometry={ear} position={[side * 0.11, 0.145, 0.076]} rotation={[-0.18, side * 0.47, -side * 0.27]} castShadow>
            <meshStandardMaterial vertexColors roughness={0.92} />
          </mesh>
          <group position={eyes[index]} rotation={[-0.2, side * 0.55, side * 0.12]}>
            {happy ? (
              <mesh name="hamster-happy-eye">
                <tubeGeometry args={[smileEye, 10, 0.004, 6, false]} />
                <meshStandardMaterial color={INK} roughness={0.91} />
              </mesh>
            ) : (
              <mesh scale={[0.014, 0.017, 0.007]}>
                <sphereGeometry args={[1, 20, 14]} />
                <meshStandardMaterial color={INK} roughness={0.91} />
              </mesh>
            )}
          </group>
          {[0.123, -0.095].map((z, foot) => (
            <group key={z} position={[side * 0.075, -0.149, z]}
              ref={(paw) => { paws.current[index * 2 + foot] = paw; }}>
              <mesh scale={[0.032, 0.016, 0.032]}>
                <sphereGeometry args={[1, 16, 12]} />
                <meshStandardMaterial color="#e8a58e" roughness={0.88} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      {mouth.map((line, index) => (
        <mesh key={index}>
          <tubeGeometry args={[line, 10, 0.0038, 6, false]} />
          <meshStandardMaterial color={INK} roughness={0.9} />
        </mesh>
      ))}
    </>
  );
}
