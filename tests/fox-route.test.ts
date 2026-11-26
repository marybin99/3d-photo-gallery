import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera, Vector3 } from 'three';
import { areaAt, canStand, createGalleryLayout, moveAndSlide } from '../src/features/gallery/layout.ts';
import { createFoxRoute } from '../src/features/gallery/foxRoute.ts';
import { foxIsVisible, foxViewObstacles } from '../src/features/gallery/foxInteraction.ts';

test('the fox loop visits every accessible area and clears obstacles between waypoints', () => {
  const allRooms = Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  const layouts = [
    createGalleryLayout([]),
    createGalleryLayout([], ['A', 'B', 'C']),
    createGalleryLayout(['D', 'F', 'Z'], ['A', 'F']),
    createGalleryLayout(allRooms),
    createGalleryLayout(allRooms, allRooms),
    createGalleryLayout(allRooms, allRooms.slice(0, -1)),
  ];

  for (const layout of layouts) {
    const route = createFoxRoute(layout);
    const visited = new Set<string>();
    for (const [index, from] of route.entries()) {
      const to = route[(index + 1) % route.length];
      const steps = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.08);
      for (let step = 0; step <= steps; step++) {
        const fraction = step / steps;
        const x = from.x + (to.x - from.x) * fraction;
        const z = from.z + (to.z - from.z) * fraction;
        assert.ok(canStand(x, z, 0.95, layout), `Fox route has an obstacle at (${x}, ${z})`);
        visited.add(areaAt(x, z, layout).id);
      }
    }
    assert.deepEqual(
      visited,
      new Set(layout.areas.map(({ id }) => id).filter((id) => !layout.closedRoomIds.includes(id))),
    );
  }
});

test('the visitor stops at the fox during a fast move and can then walk around it', () => {
  const layout = createGalleryLayout([]);
  const fox = { x: 1.35, z: 1.75, width: 0.76, depth: 0.76 };
  const blocked = moveAndSlide(fox.x, 4.5, 0, -5, undefined, layout, fox);
  assert.ok(blocked.z > fox.z && blocked.z - fox.z < 0.75);
  assert.ok(canStand(blocked.x, blocked.z, undefined, layout, fox));

  const side = moveAndSlide(blocked.x, blocked.z, 1.2, 0, undefined, layout, fox);
  const around = moveAndSlide(side.x, side.z, 0, -2, undefined, layout, fox);
  assert.ok(around.z < fox.z);
});

test('a distant fox can be petted in view but walls, closed doors and the viewport block interaction', () => {
  const camera = new PerspectiveCamera(64, 1, 0.1, 100);
  const obstacles = foxViewObstacles(createGalleryLayout([]));
  const target = new Vector3(0, 0.46, -3);
  camera.position.set(0, 2, 7);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  assert.ok(foxIsVisible(camera, target, obstacles));
  assert.equal(foxIsVisible(camera, new Vector3(0, 0.46, 8), obstacles), false);
  assert.equal(foxIsVisible(camera, new Vector3(7, 0.46, 5), obstacles), false);

  for (const z of [1, -2]) {
    camera.position.set(-5, 2, z);
    target.set(-13, 0.46, z);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    assert.equal(foxIsVisible(camera, target, obstacles), z === 1);
    assert.equal(foxIsVisible(camera, target, foxViewObstacles(createGalleryLayout([], ['A']))), false);
  }
});
