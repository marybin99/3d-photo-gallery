import assert from 'node:assert/strict'
import test from 'node:test'
import { turnTowards, updateCharacterMotion } from '../src/locomotion.ts'
import { movementDelta } from '../src/controls.ts'

test('character faces forward into all eight camera-relative movement directions', () => {
  for(const cameraYaw of [0,.7,-2]){
    for(const [forward,right] of [[1,0],[-1,0],[0,-1],[0,1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const delta=movementDelta(cameraYaw,forward,right,.06)
      const motion={speed:0,distance:0,facing:cameraYaw}
      for(let i=0;i<90;i++)updateCharacterMotion(motion,delta.x,delta.z,1/60)
      const heading={x:-Math.sin(motion.facing),z:-Math.cos(motion.facing)}
      const alignment=(heading.x*delta.x+heading.z*delta.z)/Math.hypot(delta.x,delta.z)
      assert.ok(alignment>.99999)
    }
  }
})

test('turns take the short path across the angle wrap', () => {
  const start=Math.PI-.05, end=-Math.PI+.05
  const turned=turnTowards(start,end,1/60)
  assert.ok(turned>start && turned<start+.1)
})

test('blocked movement stops the walk cycle and retains the last facing', () => {
  const motion={speed:0,distance:0,facing:0}
  updateCharacterMotion(motion,.1,0,1/60)
  const facing=motion.facing, distance=motion.distance
  assert.ok(motion.speed>0)
  updateCharacterMotion(motion,0,0,1/60)
  assert.equal(motion.speed,0)
  assert.equal(motion.distance,distance)
  assert.equal(motion.facing,facing)
})
