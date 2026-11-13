import assert from 'node:assert/strict'
import test from 'node:test'
import { bindMouseLook, DEFAULT_PITCH, mouseLook, movementDelta } from '../src/controls.ts'

test('A/D strafe relative to the view and forward stays perpendicular', () => {
  for (const yaw of [0, Math.PI/2, Math.PI, -.7]) {
    const right=movementDelta(yaw,0,1,1)
    const left=movementDelta(yaw,0,-1,1)
    const forward=movementDelta(yaw,1,0,1)
    assert.ok(Math.abs(right.x+left.x)<1e-12)
    assert.ok(Math.abs(right.z+left.z)<1e-12)
    assert.ok(Math.abs(right.x*forward.x+right.z*forward.z)<1e-12)
  }
  const initialRight=movementDelta(0,0,1,1)
  assert.equal(initialRight.x,1)
  assert.ok(Math.abs(initialRight.z)<1e-12)
  const turned=movementDelta(-Math.PI/2,1,0,1)
  assert.ok(turned.x>.999)
})

test('diagonal movement has the same speed as a single direction', () => {
  for (const [forward,right] of [[1,1],[-1,1],[1,-1],[-1,-1]]) {
    const delta=movementDelta(.7,forward,right,4.8)
    assert.ok(Math.abs(Math.hypot(delta.x,delta.z)-4.8)<1e-12)
  }
})

test('mouse look turns right with rightward drag and limits vertical rotation', () => {
  assert.ok(mouseLook(0,DEFAULT_PITCH,100,0).yaw<0)
  assert.ok(mouseLook(0,DEFAULT_PITCH,0,-100).pitch<DEFAULT_PITCH)
  assert.equal(mouseLook(0,DEFAULT_PITCH,0,-10000).pitch,-.25)
  assert.equal(mouseLook(0,DEFAULT_PITCH,0,10000).pitch,1.1)
})

test('mouse drag suppresses object clicks, releases capture and leaves normal clicks usable', () => {
  const previousWindow=globalThis.window, previousDocument=globalThis.document
  Object.assign(globalThis,{window:new EventTarget(),document:new EventTarget()})
  class Canvas extends EventTarget {
    captured:number|null=null
    setPointerCapture(id:number){this.captured=id}
    hasPointerCapture(id:number){return this.captured===id}
    releasePointerCapture(){this.captured=null}
  }
  const canvas=new Canvas()
  const moves:number[][]=[]
  const unbind=bindMouseLook(canvas as unknown as HTMLCanvasElement,(dx,dy)=>moves.push([dx,dy]))
  const pointer=(type:string,x:number,y:number,extras={})=>canvas.dispatchEvent(Object.assign(new Event(type),{pointerType:'mouse',pointerId:1,button:0,buttons:1,clientX:x,clientY:y,...extras}))
  const click=()=>{
    const event=Object.assign(new Event('click',{cancelable:true}),{detail:1})
    canvas.dispatchEvent(event)
    return event.defaultPrevented
  }
  try {
    pointer('pointerdown',0,0)
    pointer('pointermove',2,1)
    assert.deepEqual(moves,[])
    pointer('pointerup',2,1)
    assert.equal(click(),false)
    pointer('pointerdown',0,0)
    pointer('pointermove',10,8)
    assert.deepEqual(moves,[[10,8]])
    pointer('pointerup',10,8)
    assert.equal(canvas.captured,null)
    assert.equal(click(),true)
    pointer('pointerdown',0,0)
    pointer('pointerup',0,0)
    assert.equal(click(),false)
    pointer('pointerdown',0,0,{pointerType:'touch'})
    pointer('pointermove',20,20,{pointerType:'touch'})
    assert.deepEqual(moves[1],[20,20])
    pointer('pointerup',20,20,{pointerType:'touch'})
    assert.equal(click(),true)
    pointer('pointerdown',0,0)
    globalThis.window.dispatchEvent(new Event('blur'))
    pointer('pointermove',30,30)
    assert.equal(moves.length,2)
    pointer('pointerdown',0,0)
    unbind()
    assert.equal(canvas.captured,null)
    pointer('pointermove',40,40)
    assert.equal(moves.length,2)
  } finally {
    unbind()
    if(previousWindow===undefined)Reflect.deleteProperty(globalThis,'window')
    else globalThis.window=previousWindow
    if(previousDocument===undefined)Reflect.deleteProperty(globalThis,'document')
    else globalThis.document=previousDocument
  }
})
