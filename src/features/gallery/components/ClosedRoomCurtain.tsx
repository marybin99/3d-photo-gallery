import { useEffect, useMemo } from 'react'
import { Text } from '@react-three/drei'
import { DoubleSide } from 'three'
import { createCurtainGeometry } from '../curtainGeometry'

export default function ClosedRoomCurtain() {
  const geometry=useMemo(()=>createCurtainGeometry(),[])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  return <group name="closed-room-curtain">
    <mesh geometry={geometry} position={[0,2.02,0]} castShadow receiveShadow>
      <meshStandardMaterial color="#b9a086" roughness={1} side={DoubleSide}/>
    </mesh>
    <mesh position={[0,4.07,.05]} rotation={[0,0,Math.PI/2]}>
      <cylinderGeometry args={[.035,.035,4.26,12]}/><meshStandardMaterial color="#77624e" roughness={.7}/>
    </mesh>
    {Array.from({length:11},(_,index)=><mesh key={index} position={[-1.85+index*.37,4.02,.05]}>
      <torusGeometry args={[.065,.012,6,12]}/><meshStandardMaterial color="#8a735b" roughness={.8}/>
    </mesh>)}
    <mesh position={[0,2.22,.205]}>
      <planeGeometry args={[3.25,1.52]}/><meshStandardMaterial color="#e0cfb7" roughness={1}/>
    </mesh>
    {[-1,1].map(side=><mesh key={side} position={[0,2.22+side*.65,.215]}>
      <boxGeometry args={[2.98,.012,.006]}/><meshBasicMaterial color="#a78d71"/>
    </mesh>)}
    <Text position={[0,2.4,.23]} fontSize={.32} letterSpacing={.14} lineHeight={1.35} textAlign="center" color="#65513f">
      {'COMING\nSOON'}
    </Text>
    <Text position={[0,1.81,.23]} fontSize={.145} letterSpacing={.06} color="#7e6751">전시 준비 중</Text>
  </group>
}
