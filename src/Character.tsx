import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { CharacterMotion } from './locomotion'

export default function Character({motion}:{motion:RefObject<CharacterMotion>}) {
  const heading=useRef<THREE.Group>(null)
  const rig=useRef<THREE.Group>(null)
  const leftHip=useRef<THREE.Group>(null), rightHip=useRef<THREE.Group>(null)
  const leftKnee=useRef<THREE.Group>(null), rightKnee=useRef<THREE.Group>(null)
  const leftArm=useRef<THREE.Group>(null), rightArm=useRef<THREE.Group>(null)
  const head=useRef<THREE.Group>(null)
  const blend=useRef(0)
  useFrame(({clock},delta)=>{
    const d=Math.min(delta,.06)
    const m=motion.current
    // Keep world heading separate from the local gait's lean and sway.
    if(heading.current)heading.current.rotation.y=m.facing
    blend.current=THREE.MathUtils.damp(blend.current,Math.min(1,m.speed/3.6),12,d)
    const weight=blend.current, phase=m.distance*Math.PI
    const swing=Math.sin(phase)*.65*weight
    if(leftHip.current)leftHip.current.rotation.x=swing
    if(rightHip.current)rightHip.current.rotation.x=-swing
    if(leftKnee.current)leftKnee.current.rotation.x=-Math.max(0,-Math.sin(phase))*.7*weight
    if(rightKnee.current)rightKnee.current.rotation.x=-Math.max(0,Math.sin(phase))*.7*weight
    if(leftArm.current)leftArm.current.rotation.x=-swing*.8-.08
    if(rightArm.current)rightArm.current.rotation.x=swing*.8-.08
    if(rig.current){
      rig.current.position.y=(1-Math.cos(phase*2))*.025*weight+Math.sin(clock.elapsedTime*1.8)*.006*(1-weight)
      rig.current.rotation.z=Math.sin(phase)*.025*weight
      rig.current.rotation.x=.035*weight
    }
    if(head.current)head.current.rotation.z=-Math.sin(phase)*.015*weight
  })
  return <group ref={heading} name="character-heading"><group ref={rig} name="character-gait">
    <mesh position={[0,1.15,0]} castShadow><capsuleGeometry args={[.25,.46,6,12]}/><meshStandardMaterial color="#9c8a99"/></mesh>
    <group ref={head} position={[0,1.65,0]}>
      <mesh castShadow><sphereGeometry args={[.25,20,16]}/><meshStandardMaterial color="#edc8af"/></mesh>
      <mesh position={[0,.04,0]} castShadow><sphereGeometry args={[.26,20,12,0,Math.PI*2,0,Math.PI*.51]}/><meshStandardMaterial color="#483e3a"/></mesh>
      {[-1,1].map(side=><mesh key={side} position={[side*.085,.02,-.232]}><sphereGeometry args={[.027,8,8]}/><meshStandardMaterial color="#382e2a"/></mesh>)}
      <mesh position={[0,-.035,-.25]}><sphereGeometry args={[.04,8,8]}/><meshStandardMaterial color="#dfb599"/></mesh>
    </group>
    {[-1,1].map(side=><group key={`leg-${side}`} ref={side===-1?leftHip:rightHip} position={[side*.14,.85,0]}>
      <mesh position={[0,-.18,0]} castShadow><capsuleGeometry args={[.105,.22,4,10]}/><meshStandardMaterial color="#44434a"/></mesh>
      <group ref={side===-1?leftKnee:rightKnee} position={[0,-.36,0]}>
        <mesh position={[0,-.18,0]} castShadow><capsuleGeometry args={[.085,.23,4,10]}/><meshStandardMaterial color="#44434a"/></mesh>
        <mesh position={[0,-.39,-.065]} castShadow><boxGeometry args={[.19,.12,.32]}/><meshStandardMaterial color="#ede4d7" roughness={.8}/></mesh>
      </group>
    </group>)}
    {[-1,1].map(side=><group key={`arm-${side}`} ref={side===-1?leftArm:rightArm} position={[side*.31,1.36,0]} rotation={[0,0,side*.08]}>
      <mesh position={[0,-.14,0]} castShadow><capsuleGeometry args={[.09,.19,4,10]}/><meshStandardMaterial color="#9c8a99"/></mesh>
      <group position={[0,-.3,0]} rotation={[-.18,0,0]}>
        <mesh position={[0,-.12,0]} castShadow><capsuleGeometry args={[.07,.15,4,10]}/><meshStandardMaterial color="#9c8a99"/></mesh>
        <mesh position={[0,-.26,0]} castShadow><sphereGeometry args={[.075,10,8]}/><meshStandardMaterial color="#edc8af"/></mesh>
      </group>
    </group>)}
  </group></group>
}
