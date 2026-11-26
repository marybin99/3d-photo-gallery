import type { Doorway, GalleryLayout } from './types.ts';

export type FoxWaypoint = { x: number; z: number; pause?: number };

const LOBBY_HUB = { x: 0, z: 1 };

function doorwayPoint(door: Doorway, depth: number, across = 0): FoxWaypoint {
  const sin = Math.sin(door.rotation);
  const cos = Math.cos(door.rotation);
  return {
    x: door.x + sin * depth + cos * across,
    z: door.z + cos * depth - sin * across,
  };
}

function roomVisit(door: Doorway): FoxWaypoint[] {
  const entrance = doorwayPoint(door, -1.5);
  return [
    entrance,
    doorwayPoint(door, -4.2, 3.3),
    { ...doorwayPoint(door, -9, 2.5), pause: 0.9 },
    doorwayPoint(door, -8, -3.2),
    entrance,
  ];
}

export function createFoxRoute(layout: GalleryLayout): FoxWaypoint[] {
  const route: FoxWaypoint[] = [{ x: 1.35, z: 1.75, pause: 0.55 }, LOBBY_HUB];
  const openDoors = layout.doorways.filter(
    (door) => !layout.closedRoomIds.includes(door.zone),
  );

  for (const door of openDoors.filter((door) => !door.returnZone)) {
    route.push(...roomVisit(door), LOBBY_HUB);
  }

  const corridor = layout.areas.find((area) => area.id === 'CORRIDOR');
  if (corridor) {
    const wingDoors = openDoors
      .filter((door) => door.returnZone === corridor.id)
      .sort((a, b) => a.z - b.z);
    for (const door of wingDoors) {
      const junction = { x: corridor.x, z: door.z };
      const previous = route[route.length - 1];
      if (previous.x !== junction.x || previous.z !== junction.z) route.push(junction);
      route.push(...roomVisit(door), junction);
    }
    route.push(
      { x: corridor.x, z: corridor.z + corridor.depth / 2 - 2.5, pause: 0.65 },
      LOBBY_HUB,
    );
  }

  route.push(
    { x: 0, z: 7.25 },
    { x: 4.9, z: 6.15, pause: 0.65 },
    { x: 5.6, z: 1.4 },
  );
  return route;
}
