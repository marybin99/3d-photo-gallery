import assert from 'node:assert/strict'
import test from 'node:test'
import { createJoystick, joystickInput, movementDelta } from '../src/controls.ts'

test('joystick center and small finger jitter stay inside a dead zone',()=>{
  for(const [x,y] of [[0,0],[2,1],[-3,-2]]){
    const stick=joystickInput(x,y,40)
    assert.ok(Math.abs(stick.forward)<1e-12 && Math.abs(stick.right)<1e-12)
  }
})

test('joystick supports all directions relative to a rotated camera',()=>{
  for(const [x,y,forward,right] of [[0,-40,1,0],[-40,0,0,-1],[0,40,-1,0],[40,0,0,1]]){
    const stick=joystickInput(x,y,40)
    const actual=movementDelta(.8,stick.forward,stick.right,1)
    const expected=movementDelta(.8,forward,right,1)
    assert.ok(Math.hypot(actual.x-expected.x,actual.z-expected.z)<1e-12)
  }
})

test('joystick strength controls speed and clamps diagonal or out-of-ring drags',()=>{
  const half=joystickInput(20,0,40)
  const full=joystickInput(40,0,40)
  assert.ok(half.right>0 && half.right<full.right)
  assert.equal(full.right,1)
  const far=joystickInput(300,-300,40)
  assert.ok(Math.abs(Math.hypot(far.x,far.y)-40)<1e-12)
  assert.ok(Math.abs(Math.hypot(far.forward,far.right)-1)<1e-12)
  assert.ok(far.forward>0 && far.right>0)
})

test('second finger used for camera look cannot hijack or release the joystick',()=>{
  const input={current:{forward:0,right:0}}
  const stick=createJoystick(input)
  assert.ok(stick.begin(11))
  stick.move(11,0,-40,40)
  assert.equal(input.current.forward,1)
  assert.equal(stick.begin(22),false)
  assert.equal(stick.move(22,40,0,40),null)
  assert.equal(stick.end(22),false)
  assert.equal(input.current.forward,1)
  assert.equal(stick.end(11),true)
  assert.deepEqual(input.current,{forward:0,right:0})
})

test('release, cancel and orientation resets clear motion and allow a new gesture',()=>{
  const input={current:{forward:0,right:0}}
  const stick=createJoystick(input)
  stick.begin(1);stick.move(1,40,0,40)
  stick.reset()
  assert.deepEqual(input.current,{forward:0,right:0})
  assert.equal(stick.move(1,40,0,40),null)
  assert.ok(stick.begin(2))
  stick.move(2,-40,0,40)
  assert.equal(input.current.right,-1)
  stick.end(2)
  assert.deepEqual(input.current,{forward:0,right:0})
})
