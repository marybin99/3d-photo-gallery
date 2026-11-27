import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, LatheGeometry, MathUtils, Shape, SphereGeometry, SplineCurve, Vector2, type BufferGeometry, type MeshStandardMaterial } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { DEFAULT_AVATAR, type AvatarChoice } from '../avatar';
import type { CharacterMotion } from '../types';
import AvatarHair from './AvatarHair';
import SantaHat from './SantaHat';
import { plush } from './avatarMaterials';

type Point = [number, number, number];

const sphere = new SphereGeometry(1, 32, 24);

function sculpt(geometry: BufferGeometry, profile: (x: number, y: number, z: number) => Point) {
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    positions.setXYZ(i, ...profile(positions.getX(i), positions.getY(i), positions.getZ(i)));
  }
  geometry.computeVertexNormals();
  return geometry;
}

function signedPower(value: number, exponent: number) {
  return Math.sign(value) * Math.abs(value) ** exponent;
}

const face = sculpt(new SphereGeometry(1, 56, 36), (x, y, z) => {
  const jawTaper = MathUtils.smoothstep(-y, .14, .84) * .038;
  const cheek = 1 - .11 * y - .05 * y ** 2 - jawTaper;
  return [
    signedPower(x, .72) * cheek,
    signedPower(y, .49),
    signedPower(z, .79) * (1 + .075 * y),
  ];
});

function taperedBox(segments: number, radius: number, widthSlope: number, depthSlope: number) {
  const geometry = new RoundedBoxGeometry(2, 2, 2, segments, radius);
  const { position, normal } = geometry.attributes;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const width = 1 + widthSlope * y;
    const depth = 1 + depthSlope * y;
    position.setXYZ(i, x * width, y, z * depth);
    const nx = normal.getX(i) / width;
    const nz = normal.getZ(i) / depth;
    const ny = normal.getY(i) - nx * x * widthSlope - nz * z * depthSlope;
    const length = Math.hypot(nx, ny, nz);
    normal.setXYZ(i, nx / length, ny / length, nz / length);
  }
  return geometry;
}

// The sweatshirt follows a continuous profile from its hem to the shoulders.
const shirtProfile = new SplineCurve([
  new Vector2(0, .238),
  new Vector2(.226, .238),
  new Vector2(.31, .241),
  new Vector2(.344, .253),
  new Vector2(.348, .274),
  new Vector2(.345, .297),
  new Vector2(.335, .371),
  new Vector2(.312, .499),
  new Vector2(.278, .628),
  new Vector2(.231, .703),
  new Vector2(.16, .729),
  new Vector2(0, .742),
]);
const hoodie = sculpt(
  new LatheGeometry(shirtProfile.getPoints(64), 56),
  (x, y, z) => {
    const radius = Math.hypot(x, z);
    if (radius < .0001) return [0, y, .008];
    return [
      signedPower(x / radius, .72) * radius,
      y,
      signedPower(z / radius, .81) * radius * .79 + .012,
    ];
  },
);
const sleeve = taperedBox(4, .81, .08, .06);
const hood = sculpt(new SphereGeometry(1, 36, 24), (x, y, z) => [
  x * (1 + .38 * y), y, z - .32 * y,
]);
const hems = new RoundedBoxGeometry(2, 2, 2, 4, .46);
const shoes = new RoundedBoxGeometry(2, 2, 2, 5, .81);
const eye = new RoundedBoxGeometry(2, 2, 2, 4, .9);

const star = new Shape();
for (let i = 0; i < 10; i++) {
  const angle = Math.PI / 2 + i * Math.PI / 5;
  const radius = i % 2 === 0 ? .081 : .04;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  if (i === 0) star.moveTo(x, y);
  else star.lineTo(x, y);
}
star.closePath();

function PlushShape({
  position,
  size,
  rotation,
  material,
  geometry = sphere,
  shadow = true,
}: {
  position: Point;
  size: Point;
  rotation?: Point;
  material: MeshStandardMaterial;
  geometry?: BufferGeometry;
  shadow?: boolean;
}) {
  return (
    <mesh position={position} scale={size} rotation={rotation} castShadow={shadow}>
      <primitive object={geometry} attach="geometry" />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

export default function Character({
  motion,
  avatar = DEFAULT_AVATAR,
}: {
  motion?: RefObject<CharacterMotion>;
  avatar?: AvatarChoice;
}) {
  const heading = useRef<Group>(null);
  const rig = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const head = useRef<Group>(null);
  const blend = useRef(0);

  useFrame(({ clock }, delta) => {
    if (!motion) return;
    const { facing, speed, distance } = motion.current;
    if (heading.current) heading.current.rotation.y = facing;
    blend.current = MathUtils.damp(blend.current, Math.min(1, speed / 3.6), 12, Math.min(delta, .06));
    const weight = blend.current;
    const phase = distance * Math.PI;
    const swing = Math.sin(phase) * .48 * weight;
    if (leftLeg.current) leftLeg.current.rotation.x = swing;
    if (rightLeg.current) rightLeg.current.rotation.x = -swing;
    if (leftArm.current) leftArm.current.rotation.x = -swing * .8;
    if (rightArm.current) rightArm.current.rotation.x = swing * .8;
    if (rig.current) {
      rig.current.position.y = (1 - Math.cos(phase * 2)) * .025 * weight
        + Math.sin(clock.elapsedTime * 1.8) * .005 * (1 - weight);
      rig.current.rotation.z = Math.sin(phase) * .023 * weight;
      rig.current.rotation.x = .035 * weight;
    }
    if (head.current) head.current.rotation.z = -Math.sin(phase) * .015 * weight;
  });

  return (
    <group ref={heading} name="character-heading">
      <group ref={rig} name="character-gait">
        <mesh castShadow>
          <primitive object={hoodie} attach="geometry" />
          <primitive object={plush.hoodie} attach="material" />
        </mesh>
        <PlushShape position={[0, .664, .174]} size={[.238, .148, .149]} material={plush.hoodie} geometry={hood} />
        <PlushShape position={[0, .743, -.037]} size={[.145, .057, .11]} material={plush.skin} />
        <PlushShape position={[-.086, .713, -.072]} size={[.135, .034, .092]} rotation={[.04, -.22, -.12]} material={plush.trim} />
        <PlushShape position={[.078, .711, -.084]} size={[.134, .035, .089]} rotation={[.04, .24, .18]} material={plush.hoodie} />
        <mesh position={[0, .491, -.243]} rotation={[0, Math.PI, 0]} castShadow>
          <extrudeGeometry args={[star, { depth: .005, bevelEnabled: true, bevelThickness: .006, bevelSize: .008, bevelSegments: 4 }]} />
          <primitive object={plush.shorts} attach="material" />
        </mesh>
        <group position={[0, .741, 0]} scale={[1, 1.12, 1]} ref={head} name="avatar-head">
          <PlushShape position={[0, .416, -.026]} size={[.473, .416, .375]} material={plush.skin} geometry={face} />
          <AvatarHair style={avatar.hair} santaHat={avatar.santaHat} />
          {avatar.santaHat && <SantaHat hair={avatar.hair} />}
          {[-1, 1].map((side) => (
            <group key={side}>
              <PlushShape position={[side * .453, .256, -.067]} size={[.105, .123, .097]} rotation={[0, side * -.22, side * .26]} material={plush.skin} />
              <PlushShape position={[side * .492, .253, -.147]} size={[.041, .058, .011]} rotation={[0, side * -.39, side * .26]} material={plush.ear} shadow={false} />
              <PlushShape position={[side * .147, .353, -.39]} size={[.028, .058, .019]} rotation={[0, side * -.22, side * .018]} material={plush.eyes} geometry={eye} shadow={false} />
              {[-1, 0, 1].map((stroke) => {
                const x = side * .269 + stroke * .026;
                return (
                  <PlushShape
                    key={stroke}
                    position={[x, .261, -.356 + (Math.abs(x) - .269) * .28]}
                    size={[.009, .023, .009]}
                    rotation={[0, side * -.39, -.61]}
                    material={plush.blush}
                    shadow={false}
                  />
                );
              })}
            </group>
          ))}
        </group>
        {[-1, 1].map((side) => (
          <group key={side}>
            <group ref={side < 0 ? leftLeg : rightLeg} position={[side * .144, .301, .012]}>
              <PlushShape position={[0, -.079, .007]} size={[.147, .084, .158]} material={plush.shorts} geometry={hems} />
              <PlushShape position={[0, -.147, .005]} size={[.147, .025, .158]} material={plush.shortsHem} geometry={hems} />
              <PlushShape position={[side * .006, -.23, -.053]} size={[.148, .071, .174]} material={plush.shoes} geometry={shoes} />
            </group>
            <group ref={side < 0 ? leftArm : rightArm} position={[side * .206, .657, .024]} rotation={[0, 0, side * .42]}>
              <PlushShape position={[0, -.154, 0]} size={[.117, .198, .151]} material={plush.hoodie} geometry={sleeve} />
              <PlushShape position={[0, -.31, -.002]} size={[.111, .043, .133]} material={plush.hoodie} geometry={shoes} />
              <PlushShape position={[0, -.365, -.021]} size={[.083, .073, .083]} material={plush.skin} />
              <PlushShape position={[-side * .043, -.361, -.071]} size={[.032, .043, .038]} material={plush.skin} />
            </group>
            <PlushShape position={[side * .081, .629, -.194]} size={[.01, .087, .014]} rotation={[-.2, 0, side * .105]} material={plush.cords} />
            <PlushShape position={[side * .088, .552, -.219]} size={[.015, .019, .014]} material={plush.cords} />
          </group>
        ))}
      </group>
    </group>
  );
}
