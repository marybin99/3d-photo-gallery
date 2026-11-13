export type CharacterMotion = { speed: number; distance: number; facing: number }
export function turnTowards(current: number, target: number, delta: number) {
  const difference=Math.atan2(Math.sin(target-current),Math.cos(target-current))
  return current+difference*(1-Math.exp(-16*delta))
}
export function updateCharacterMotion(motion: CharacterMotion, dx: number, dz: number, delta: number) {
  const distance=Math.hypot(dx,dz)
  motion.speed=delta>0?distance/delta:0
  motion.distance+=distance
  if(distance>1e-5)motion.facing=turnTowards(motion.facing,Math.atan2(-dx,-dz),delta)
}
