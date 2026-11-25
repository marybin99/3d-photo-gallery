export type Area = {
  id: string;
  label: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  color: string;
};

export type Barrier = {
  x: number;
  z: number;
  width: number;
  depth: number;
  height?: number;
};

export type Doorway = {
  x: number;
  z: number;
  rotation: number;
  zone: string;
  returnZone?: string;
};

export type GalleryLayout = {
  areas: Area[];
  walls: Barrier[];
  obstacles: Barrier[];
  doorways: Doorway[];
  closedRoomIds: string[];
};

export type MovementInput = { forward: number; right: number };

export type CharacterMotion = { speed: number; distance: number; facing: number };

export type Pose = { x: number; z: number; yaw: number };
