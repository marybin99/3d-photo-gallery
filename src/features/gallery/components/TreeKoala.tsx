import { CatmullRomCurve3, Vector3 } from 'three';

type Position = [number, number, number];

const FUR = '#8b909c';
const PALE_FUR = '#e1dbd6';
const NOSE = '#3c3640';
const perch = new CatmullRomCurve3([
  new Vector3(-0.28, -0.161, -0.31),
  new Vector3(-0.19, -0.149, -0.04),
  new Vector3(0, -0.137, 0.009),
  new Vector3(0.236, -0.122, 0.052),
]);
const fork = new CatmullRomCurve3([
  new Vector3(0.156, -0.126, 0.04),
  new Vector3(0.187, -0.057, 0.059),
  new Vector3(0.197, 0.051, 0.068),
]);

function KoalaShape({ position, scale, color, tilt = 0, castShadow = false }: {
  position: Position;
  scale: Position;
  color: string;
  tilt?: number;
  castShadow?: boolean;
}) {
  return (
    <mesh position={position} scale={scale} rotation={[0, 0, tilt]} castShadow={castShadow}>
      <sphereGeometry args={[1, 16, 12]} />
      <meshStandardMaterial color={color} roughness={0.88} />
    </mesh>
  );
}

export default function TreeKoala() {
  return (
    <group rotation={[0, -0.37, 0]}>
      <group name="tree-koala" position={[0, 1.37, 0.94]}>
        <KoalaShape position={[0, -0.01, 0]} scale={[0.137, 0.147, 0.115]} color={FUR} castShadow />
        <KoalaShape position={[0, -0.038, 0.086]} scale={[0.092, 0.1, 0.038]} color={PALE_FUR} />
        <mesh>
          <tubeGeometry args={[perch, 20, 0.03, 7, false]} />
          <meshStandardMaterial color="#75553c" roughness={0.98} />
        </mesh>
        <mesh>
          <tubeGeometry args={[fork, 12, 0.018, 7, false]} />
          <meshStandardMaterial color="#75553c" roughness={0.98} />
        </mesh>
        {[-1, 1].map((side) => (
          <KoalaShape key={side} position={[side * 0.093, -0.117, 0.066]} scale={[0.052, 0.041, 0.057]}
            color={FUR} tilt={side * 0.34} />
        ))}
        <KoalaShape position={[-0.104, -0.038, 0.074]} scale={[0.038, 0.063, 0.043]} color={FUR} tilt={-0.26} />
        <KoalaShape position={[-0.087, -0.084, 0.111]} scale={[0.033, 0.028, 0.026]} color="#aeb0b7" />
        <KoalaShape position={[0.125, -0.026, 0.069]} scale={[0.035, 0.062, 0.038]} color={FUR} tilt={-0.93} />
        <KoalaShape position={[0.175, 0.006, 0.091]} scale={[0.034, 0.029, 0.028]} color="#aeb0b7" />
        <group position={[0, 0.185, 0.04]} rotation={[0.05, 0.06, -0.13]}>
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 0.135, 0.039, -0.013]} rotation={[0, side * 0.16, 0]}>
              <KoalaShape position={[0, 0, 0]} scale={[0.072, 0.074, 0.036]} color={FUR} castShadow />
              <KoalaShape position={[side * 0.008, 0.001, 0.026]} scale={[0.05, 0.052, 0.018]} color={PALE_FUR} />
              <KoalaShape position={[side * 0.011, -0.006, 0.038]} scale={[0.032, 0.035, 0.009]} color="#c6adb0" />
            </group>
          ))}
          <KoalaShape position={[0, 0, 0]} scale={[0.15, 0.116, 0.104]} color="#a0a4ad" castShadow />
          <KoalaShape position={[0, -0.043, 0.077]} scale={[0.088, 0.051, 0.033]} color={PALE_FUR} />
          {[-1, 1].map((side) => (
            <KoalaShape key={side} position={[side * 0.066, 0.015, 0.094]}
              scale={[0.013, 0.015, 0.01]} color={NOSE} />
          ))}
          <KoalaShape position={[0, -0.012, 0.108]} scale={[0.036, 0.049, 0.026]} color={NOSE} />
        </group>
      </group>
    </group>
  );
}
