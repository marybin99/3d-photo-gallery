import { DEFAULT_PITCH } from './controls.ts'

const FOLLOW_DISTANCE = Math.hypot(4.5, 1.8)
export const CAMERA_LOOK_HEIGHT = 1.6

export function followCameraPosition(pose: {x:number;z:number;yaw:number}, pitch = DEFAULT_PITCH): [number,number,number] {
  const horizontalDistance = Math.cos(pitch) * FOLLOW_DISTANCE
  return [
    pose.x + Math.sin(pose.yaw) * horizontalDistance,
    CAMERA_LOOK_HEIGHT + Math.sin(pitch) * FOLLOW_DISTANCE,
    pose.z + Math.cos(pose.yaw) * horizontalDistance,
  ]
}
