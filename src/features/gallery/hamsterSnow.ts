import { BufferGeometry, Color, DynamicDrawUsage, Float32BufferAttribute, MathUtils } from 'three';
import type { HamsterGroundPoint } from './hamsterRoam.ts';

export const SNOW_HEIGHT = 0.128;
export const SNOW_TRACK_DEPTH = 0.059;

const FLOOR_Y = -0.049;
const POWDER = new Color('#f0f9ff');
const SNOW_EDGE = new Color('#b8ccd9');
const PACKED_SNOW = new Color('#8aa9c2');

export function createHamsterSnowfield() {
  const rings = 28;
  const segments = 72;
  const vertices = [0, SNOW_HEIGHT, 0];
  const colors = POWDER.toArray();
  const faces: number[] = [];
  const shade = new Color();

  for (let ring = 1; ring <= rings; ring++) {
    const radius = ring / rings;
    const shoulder = MathUtils.smoothstep(radius, 0.73, 1);
    const height = MathUtils.lerp(SNOW_HEIGHT, FLOOR_Y, shoulder);
    shade.copy(POWDER).lerp(SNOW_EDGE, shoulder);
    for (let segment = 0; segment < segments; segment++) {
      const angle = segment / segments * Math.PI * 2;
      const edge = radius * (1 + 0.047 * Math.sin(angle * 3 + 0.7) + 0.029 * Math.cos(angle * 5));
      vertices.push(1.28 * edge * Math.cos(angle), height, 0.81 * edge * Math.sin(angle));
      colors.push(shade.r, shade.g, shade.b);
      const current = 1 + (ring - 1) * segments + segment;
      const next = 1 + (ring - 1) * segments + (segment + 1) % segments;
      if (ring === 1) faces.push(0, next, current);
      else faces.push(current - segments, next - segments, current, next - segments, next, current);
    }
  }

  const geometry = new BufferGeometry();
  const position = new Float32BufferAttribute(vertices, 3).setUsage(DynamicDrawUsage);
  const color = new Float32BufferAttribute(colors, 3).setUsage(DynamicDrawUsage);
  const normal = new Float32BufferAttribute(new Float32Array(vertices.length), 3).setUsage(DynamicDrawUsage);
  geometry.setAttribute('position', position);
  geometry.setAttribute('color', color);
  geometry.setAttribute('normal', normal);
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  const packed = new Float32Array(position.count);
  const banks = new Float32Array(position.count);

  function updateTrail(from: HamsterGroundPoint, to: HamsterGroundPoint, seconds: number) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const distanceSquared = dx * dx + dz * dz;
    const packingSnow = distanceSquared > 0.000004;
    const refill = Math.exp(-seconds / 38);
    let changed = false;
    for (let index = 0; index < vertices.length; index += 3) {
      const vertex = index / 3;
      let groove = 0;
      let snowbank = 0;
      if (packingSnow && vertices[index + 1] > 0) {
        const x = vertices[index] - from.x;
        const z = vertices[index + 2] - from.z;
        const along = MathUtils.clamp((x * dx + z * dz) / distanceSquared, 0, 1);
        const distance = Math.hypot(x - along * dx, z - along * dz);
        groove = 1 - MathUtils.smoothstep(distance, 0.065, 0.185);
        snowbank = 1 - MathUtils.smoothstep(Math.abs(distance - 0.18), 0, 0.06);
      }
      if (groove === 0 && snowbank === 0 && packed[vertex] === 0 && banks[vertex] === 0) continue;

      packed[vertex] = Math.max(packed[vertex] * refill, groove);
      banks[vertex] = Math.max(banks[vertex] * refill, snowbank);
      if (packed[vertex] < 0.01) packed[vertex] = 0;
      if (banks[vertex] < 0.01) banks[vertex] = 0;
      const blend = packed[vertex] * 0.82;
      position.setY(vertex, vertices[index + 1] - packed[vertex] * SNOW_TRACK_DEPTH
        + banks[vertex] * (1 - packed[vertex]) * 0.016);
      color.setXYZ(vertex,
        MathUtils.lerp(colors[index], PACKED_SNOW.r, blend),
        MathUtils.lerp(colors[index + 1], PACKED_SNOW.g, blend),
        MathUtils.lerp(colors[index + 2], PACKED_SNOW.b, blend),
      );
      changed = true;
    }
    if (!changed) return;
    position.needsUpdate = true;
    color.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  return { geometry, updateTrail };
}
