import { Box3, Ray, Vector3, type Camera } from 'three';
import type { GalleryLayout } from './types.ts';

export function companionViewObstacles(layout: GalleryLayout) {
  return layout.obstacles.map(({ x, z, width, depth, height = 4.8 }) => new Box3(
    new Vector3(x - width / 2, 0, z - depth / 2),
    new Vector3(x + width / 2, height, z + depth / 2),
  ));
}

export function petTargetScore(camera: Camera, target: Vector3, obstacles: Box3[]) {
  const screen = target.clone().project(camera);
  if (Math.abs(screen.x) > 1 || Math.abs(screen.y) > 1 || Math.abs(screen.z) > 1) return Infinity;

  const eye = camera.getWorldPosition(new Vector3());
  const direction = target.clone().sub(eye);
  const distance = direction.length();
  const ray = new Ray(eye, direction.normalize());
  const hit = new Vector3();
  const blocked = obstacles.some((box) => ray.intersectBox(box, hit) && eye.distanceTo(hit) < distance);
  return blocked ? Infinity : Math.hypot(screen.x, screen.y);
}
