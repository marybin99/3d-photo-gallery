import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { act, createElement } from 'react'
import { createRoot, extend } from '@react-three/fiber'
import * as THREE from 'three'
import { updateCharacterMotion } from '../src/locomotion.ts'

// Real React Three Fiber scene graph and frame subscriptions; no GPU required.
// The stub replaces only WebGL drawing, not Three objects or React rendering.
test('rendered character turns its entire model left, right and backwards across rerenders', async () => {
  const directory=await mkdtemp(join(tmpdir(),'gallery-character-'))
  const require=createRequire(import.meta.url)
  const output=join(directory,'Character.mjs')
  const built=await build({
    entryPoints:['src/Character.tsx'],bundle:true,platform:'node',format:'esm',jsx:'automatic',write:false,
    plugins:[{name:'shared-test-dependencies',setup(builder){
      builder.onResolve({filter:/^[^./]/},args=>({path:require.resolve(args.path),external:true}))
    }}],
  })
  await writeFile(output,built.outputFiles[0].text)
  const Character=(await import(pathToFileURL(output).href)).default
  extend(THREE)
  const canvas={width:100,height:100,style:{},addEventListener(){},removeEventListener(){}}
  const root=createRoot(canvas as unknown as HTMLCanvasElement)
  const previousAct=(globalThis as any).IS_REACT_ACT_ENVIRONMENT
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true
  try {
    await root.configure({
      gl:{render(){},setSize(){},setPixelRatio(){},getPixelRatio(){return 1},shadowMap:{},xr:{addEventListener(){},removeEventListener(){},setAnimationLoop(){}}} as any,
      frameloop:'never',dpr:1,size:{width:100,height:100,top:0,left:0},
    })
    const motion={current:{speed:0,distance:0,facing:0}}
    let store:ReturnType<typeof root.render>
    await act(async()=>{store=root.render(createElement(Character,{motion}))})
    const state=store!.getState()
    for(const [dx,dz] of [[-.06,0],[.06,0],[0,.06],[0,-.06]]){
      for(let i=0;i<90;i++){
        updateCharacterMotion(motion.current,dx,dz,1/60)
        state.internal.subscribers.forEach(sub=>sub.ref.current(state,1/60))
      }
      await act(async()=>{root.render(createElement(Character,{motion}))})
      state.internal.subscribers.forEach(sub=>sub.ref.current(state,1/60))
      state.scene.updateMatrixWorld(true)
      const model=state.scene.getObjectByName('character-heading')!
      assert.ok(model,'Character must own the visual heading')
      const facing=new THREE.Vector3(0,0,-1).transformDirection(model.matrixWorld)
      assert.ok((facing.x*dx+facing.z*dz)/Math.hypot(dx,dz)>.99999)
      assert.ok(model.getObjectByName('character-gait')!.children.length>4,'All limbs and head rotate inside the heading root')
    }
  } finally {
    await act(async()=>{root.unmount()})
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT=previousAct
    await rm(directory,{recursive:true,force:true})
  }
})
