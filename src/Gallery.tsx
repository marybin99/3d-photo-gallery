import { useFrame, useThree } from '@react-three/fiber'
import { Text, useTexture } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { artworks, type Artwork } from './data'

export type Pose = {x:number; z:number; yaw:number}
export const SPAWN: Pose = {x:0,z:4.6,yaw:0}
function useKeyboard(enabled: boolean) {
  const keys = useRef(new Set<string>())
  useEffect(()=>{
    const keyState = keys.current
    keyState.clear()
    if (!enabled) return
    const down=(event:KeyboardEvent)=>{
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, select, button, [contenteditable]')) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const key = event.key.toLowerCase()
      if (!['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)) return
      event.preventDefault()
      keyState.add(key)
    }
    const up=(event:KeyboardEvent)=>keyState.delete(event.key.toLowerCase())
    const blur=()=>keyState.clear()
    window.addEventListener('keydown',down); window.addEventListener('keyup',up);window.addEventListener('blur',blur)
    document.addEventListener('visibilitychange',blur)
    return ()=>{keyState.clear();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',blur)}
  },[enabled])
  return keys
}
function Wall({position,args,color='#f3eee5'}:{position:[number,number,number];args:[number,number,number];color?:string}) {
  return <mesh position={position} receiveShadow castShadow><boxGeometry args={args}/><meshStandardMaterial color={color} roughness={0.95}/></mesh>
}
function ImageFrame({art,onSelect}:{art:Artwork;onSelect:(a:Artwork)=>void}) {
  const tex=useTexture(art.image)
  return <group position={art.position} rotation={[0,art.rotation,0]}>
    <mesh position={[0,0,0]} castShadow><boxGeometry args={[1.94,1.52,0.11]}/><meshStandardMaterial color="#806d59" roughness={0.65}/></mesh>
    <mesh position={[0,0,0.064]}><planeGeometry args={[1.74,1.32]}/><meshBasicMaterial color="#fdfbf8"/></mesh>
    <mesh position={[0,0,0.071]} onClick={(e)=>{e.stopPropagation();onSelect(art)}} onPointerOver={()=>document.body.style.cursor='pointer'} onPointerOut={()=>document.body.style.cursor='auto'}>
      <planeGeometry args={[1.62,1.20]}/><meshBasicMaterial map={tex} toneMapped={false}/>
    </mesh>
    <mesh position={[0,-0.88,0.08]}><planeGeometry args={[1.35,0.25]}/><meshBasicMaterial color="#f8f5ed"/></mesh>
    <Text fontSize={0.115} anchorX="center" color="#51483e" position={[0,-0.88,0.09]}>{art.title}</Text>
    <spotLight position={[0,2,1.8]} angle={0.5} penumbra={0.9} intensity={3.4} distance={5} color="#ffe8d0" target-position={[0,0,0]}/>
  </group>
}
function Player({pose,onPose,mobileInput,paused}:{pose:React.RefObject<Pose>;onPose:(p:Pose)=>void;mobileInput:React.RefObject<{forward:number;turn:number}>;paused:boolean}) {
  const body=useRef<THREE.Group>(null)
  const {camera}=useThree()
  const broadcast=useRef(0)
  const keys = useKeyboard(!paused)
  const target=useMemo(()=>new THREE.Vector3(),[])
  useFrame((_,delta)=>{
    const p=pose.current
    if(!p)return
    const d=Math.min(delta,0.06)
    const keyState = keys.current
    const forward=paused?0:THREE.MathUtils.clamp((keyState.has('w')||keyState.has('arrowup')?1:0)-(keyState.has('s')||keyState.has('arrowdown')?1:0)+mobileInput.current.forward,-1,1)
    const turn=paused?0:THREE.MathUtils.clamp((keyState.has('a')||keyState.has('arrowleft')?1:0)-(keyState.has('d')||keyState.has('arrowright')?1:0)+mobileInput.current.turn,-1,1)
    p.yaw+=turn*2.2*d
    const speed=3.2
    p.x=THREE.MathUtils.clamp(p.x-Math.sin(p.yaw)*forward*speed*d,-6.45,6.45)
    p.z=THREE.MathUtils.clamp(p.z-Math.cos(p.yaw)*forward*speed*d,-4.3,4.65)
    if(body.current){body.current.position.set(p.x,0,p.z);body.current.rotation.y=p.yaw}
    target.set(p.x+Math.sin(p.yaw)*3.8,3.1,p.z+Math.cos(p.yaw)*4.9)
    camera.position.lerp(target,1-Math.exp(-4*d))
    camera.lookAt(p.x,1.5,p.z)
    broadcast.current+=d
    if(broadcast.current>0.07){broadcast.current=0;onPose({...p})}
  })
  return <group ref={body} position={[0,0,SPAWN.z]}>
    <mesh position={[0,0.94,0]} castShadow><capsuleGeometry args={[0.27,0.9,6,12]}/><meshStandardMaterial color="#9c8a99"/></mesh>
    <mesh position={[0,1.72,0]} castShadow><sphereGeometry args={[0.28,20,20]}/><meshStandardMaterial color="#edc8af"/></mesh>
    <mesh position={[0,1.9,-0.06]}><sphereGeometry args={[0.27,20,12,0,Math.PI*2,0,Math.PI*0.51]}/><meshStandardMaterial color="#483e3a"/></mesh>
    <mesh position={[-0.14,0.28,0]}><capsuleGeometry args={[0.10,0.44,4,8]}/><meshStandardMaterial color="#44434a"/></mesh>
    <mesh position={[0.14,0.28,0]}><capsuleGeometry args={[0.10,0.44,4,8]}/><meshStandardMaterial color="#44434a"/></mesh>
  </group>
}
export default function Gallery({onSelect,pose,onPose,mobileInput,paused}:{onSelect:(a:Artwork)=>void;pose:React.RefObject<Pose>;onPose:(p:Pose)=>void;mobileInput:React.RefObject<{forward:number;turn:number}>;paused:boolean}) {
  return <>
    <color attach="background" args={['#e6dfd4']}/>
    <ambientLight intensity={1.15}/>
    <hemisphereLight args={['#fff6e9','#a8a39b',2.2]}/>
    <directionalLight position={[3,9,6]} intensity={2.0} castShadow shadow-mapSize={[1024,1024]}/>
    <mesh receiveShadow rotation={[-Math.PI/2,0,0]} position={[0,-0.05,0]}><planeGeometry args={[18,12]}/><meshStandardMaterial color="#b6a58f" roughness={0.95}/></mesh>
    <Wall position={[0,2,-6]} args={[17,4,0.3]}/>
    <Wall position={[-8.5,2,0]} args={[0.3,4,12]}/>
    <Wall position={[8.5,2,0]} args={[0.3,4,12]}/>
    <Wall position={[-5.3,2,6]} args={[6.1,4,0.3]}/>
    <Wall position={[5.3,2,6]} args={[6.1,4,0.3]}/>
    <Wall position={[0,3.96,0]} args={[17,0.08,12]} color="#faf6ef"/>
    {artworks.map(art=><ImageFrame key={art.id} art={art} onSelect={onSelect}/>)}
    <Text position={[0,2.6,-5.82]} fontSize={0.34} color="#625549">THE QUIET ROOM</Text>
    <Text position={[0,2.15,-5.82]} fontSize={0.14} color="#75695b">a little space for our photographs</Text>
    <Player pose={pose} onPose={onPose} mobileInput={mobileInput} paused={paused}/>
  </>
}
