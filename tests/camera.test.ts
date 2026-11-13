import assert from 'node:assert/strict'
import test from 'node:test'
import { Box3, Ray, Vector3 } from 'three'
import { followCameraPosition, CAMERA_LOOK_HEIGHT } from '../src/camera.ts'
import { SPAWN, obstacles, areaAt, canStand } from '../src/layout.ts'

test('initial lobby view has full camera distance without wall compression',()=>{
  const position=new Vector3(...followCameraPosition(SPAWN))
  const lookAt=new Vector3(SPAWN.x,CAMERA_LOOK_HEIGHT,SPAWN.z)
  const distance=position.distanceTo(lookAt)
  assert.ok(distance>4.8)
  assert.equal(areaAt(SPAWN.x,SPAWN.z).id,'LOBBY')
  assert.ok(canStand(SPAWN.x,SPAWN.z))
  const ray=new Ray(lookAt,position.clone().sub(lookAt).normalize())
  for(const wall of obstacles){
    const box=new Box3(
      new Vector3(wall.x-wall.width/2-.2,0,wall.z-wall.depth/2-.2),
      new Vector3(wall.x+wall.width/2+.2,(wall.height??4.8)+.2,wall.z+wall.depth/2+.2),
    )
    const hit=ray.intersectBox(box,new Vector3())
    assert.ok(!hit || hit.distanceTo(lookAt)>distance+.15,'Starting camera must clear all collision bounds')
  }
})
