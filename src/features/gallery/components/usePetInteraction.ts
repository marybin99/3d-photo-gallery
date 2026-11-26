import { useCallback, useEffect, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import { Vector3, type Box3, type Group } from 'three';
import { petTargetScore } from '../companionInteraction';

export type PetTarget = { score: () => number; pet: () => void };

export function usePetInteraction(
  root: RefObject<Group | null>,
  height: number,
  enabled: boolean,
  obstacles: Box3[],
  shortcut: RefObject<PetTarget | null>,
  onPet: () => void,
) {
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    if (!enabled) return;
    shortcut.current = {
      pet: onPet,
      score: () => {
        if (!root.current) return Infinity;
        const point = root.current.getWorldPosition(new Vector3());
        point.y += height;
        return petTargetScore(camera, point, obstacles);
      },
    };
    return () => { shortcut.current = null; };
  }, [root, height, enabled, obstacles, shortcut, onPet, camera]);

  return useCallback((hit: Vector3) => {
    if (!enabled || !Number.isFinite(petTargetScore(camera, hit, obstacles))) return false;
    onPet();
    return true;
  }, [camera, enabled, obstacles, onPet]);
}
