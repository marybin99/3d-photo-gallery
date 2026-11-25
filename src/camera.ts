import { DEFAULT_PITCH } from './controls.ts'

const FOLLOW_DISTANCE = Math.hypot(4.5, 1.8)
export const CAMERA_LOOK_HEIGHT = 1.6
export const GALLERY_FOV = 64

export function lobbyFieldOfView(aspect: number): number {
  // A vertical lens alone crops the sides of the lobby in portrait orientation.
  const minimumHorizontalFov = 42 * Math.PI / 180
  const verticalFov = 2 * Math.atan(Math.tan(minimumHorizontalFov / 2) / aspect) * 180 / Math.PI
  return Math.min(88, Math.max(GALLERY_FOV, verticalFov))
}

export function followCameraPosition(pose: {x:number;z:number;yaw:number}, pitch = DEFAULT_PITCH): [number,number,number] {
  const horizontalDistance = Math.cos(pitch) * FOLLOW_DISTANCE
  return [
    pose.x + Math.sin(pose.yaw) * horizontalDistance,
    CAMERA_LOOK_HEIGHT + Math.sin(pitch) * FOLLOW_DISTANCE,
    pose.z + Math.cos(pose.yaw) * horizontalDistance,
  ]
}
