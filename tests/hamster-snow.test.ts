import assert from 'node:assert/strict';
import test from 'node:test';
import { createHamsterSnowfield, SNOW_HEIGHT, SNOW_TRACK_DEPTH } from '../src/features/gallery/hamsterSnow.ts';
import {
  HAMSTER_COLLISION_SIZE, HAMSTER_PATCH, HAMSTER_RANGE, HAMSTER_START,
  hamsterGaitAt, nextHamsterStop,
} from '../src/features/gallery/hamsterRoam.ts';
import { canStand, createGalleryLayout, moveAndSlide } from '../src/features/gallery/layout.ts';

test('the hamster packs snow only along the part of its trail it has reached', () => {
  const snow = createHamsterSnowfield();
  const positions = snow.geometry.getAttribute('position');
  const colors = snow.geometry.getAttribute('color');
  const rimHeight = positions.getY(positions.count - 1);
  const freshBlue = colors.getZ(0);

  const start = { x: -0.68, z: -0.24 };
  const middle = { x: -0.35, z: -0.13 };
  const end = { x: 0.39, z: 0.17 };
  snow.updateTrail(start, middle, 0.08);
  assert.ok(Math.abs(positions.getY(0) - SNOW_HEIGHT) < 1e-6);
  snow.updateTrail(middle, end, 0.08);
  assert.ok(Math.abs(positions.getY(0) - (SNOW_HEIGHT - SNOW_TRACK_DEPTH)) < 1e-6);
  assert.ok(colors.getZ(0) < freshBlue);
  assert.equal(positions.getY(positions.count - 1), rimHeight);
  snow.updateTrail(end, end, 2);
  assert.ok(positions.getY(0) < SNOW_HEIGHT - SNOW_TRACK_DEPTH * 0.8);
  snow.geometry.dispose();
});

test('the hamster can pick diagonals in every direction while staying inside its snowfield', () => {
  let seed = 12;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x1_0000_0000;
  };
  const directions = new Set<string>();
  let from = HAMSTER_START;
  for (let index = 0; index < 24; index++) {
    const to = nextHamsterStop(from, random);
    assert.ok((to.x / HAMSTER_RANGE.x) ** 2 + (to.z / HAMSTER_RANGE.z) ** 2 <= 1);
    if (Math.abs(to.z - from.z) > 0.15) {
      directions.add(`${Math.sign(to.x - from.x)},${Math.sign(to.z - from.z)}`);
    }
    from = to;
  }
  assert.equal(directions.size, 4);
});

test('the hamster crawls upright, rolls fully over, or stops to wiggle and rolls back onto its paws', () => {
  assert.deepEqual(hamsterGaitAt('crawl', 0.5), { progress: 0.5, roll: 0, wiggle: 0 });
  assert.deepEqual(hamsterGaitAt('roll', 0.5), { progress: 0.5, roll: Math.PI, wiggle: 0 });
  assert.deepEqual(hamsterGaitAt('tumble', 0.54), { progress: 0.5, roll: Math.PI, wiggle: 1 });
  assert.deepEqual(hamsterGaitAt('tumble', 1), { progress: 1, roll: Math.PI * 2, wiggle: 0 });
});

test('the visitor can walk around the hamster while both animals block movement', () => {
  const layout = createGalleryLayout([]);
  const fox = { x: 1.35, z: 1.75, width: 0.76, depth: 0.76 };
  const hamster = {
    x: HAMSTER_PATCH.x + HAMSTER_START.x,
    z: HAMSTER_PATCH.z + HAMSTER_START.z,
    width: HAMSTER_COLLISION_SIZE,
    depth: HAMSTER_COLLISION_SIZE,
  };
  const stopped = moveAndSlide(hamster.x, -1, 0, -4, undefined, layout, fox, hamster);
  assert.ok(stopped.z > hamster.z && stopped.z - hamster.z < 0.6);
  assert.ok(canStand(stopped.x, stopped.z, undefined, layout, fox, hamster));
  const side = moveAndSlide(stopped.x, stopped.z, 0.93, 0, undefined, layout, fox, hamster);
  const around = moveAndSlide(side.x, side.z, 0, -2, undefined, layout, fox, hamster);
  assert.ok(around.z < hamster.z);
  const nearFox = moveAndSlide(fox.x, 4.5, 0, -5, undefined, layout, fox, hamster);
  assert.ok(nearFox.z > fox.z && nearFox.z - fox.z < 0.75);
});
