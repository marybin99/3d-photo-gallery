import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { createJoystick, type MovementInput } from './controls'

export default function MobileControls({input,disabled}:{input:RefObject<MovementInput>;disabled:boolean}) {
  const movement=useMemo(()=>createJoystick(input),[input])
  const capture=useRef<{element:HTMLButtonElement;id:number}|null>(null)
  const origin=useRef({x:0,y:0,radius:40})
  const [knob,setKnob]=useState({x:0,y:0,active:false})
  const reset=useCallback(()=>{
    movement.reset()
    const held=capture.current
    capture.current=null
    if(held?.element.hasPointerCapture(held.id))held.element.releasePointerCapture(held.id)
    setKnob({x:0,y:0,active:false})
  },[movement])
  useEffect(()=>{
    reset()
    window.addEventListener('blur',reset)
    window.addEventListener('resize',reset)
    window.addEventListener('orientationchange',reset)
    document.addEventListener('visibilitychange',reset)
    return()=>{
      reset()
      window.removeEventListener('blur',reset)
      window.removeEventListener('resize',reset)
      window.removeEventListener('orientationchange',reset)
      document.removeEventListener('visibilitychange',reset)
    }
  },[reset,disabled])
  const update=(id:number,x:number,y:number)=>{
    const result=movement.move(id,x-origin.current.x,y-origin.current.y,origin.current.radius)
    if(result)setKnob({x:result.x,y:result.y,active:true})
  }
  return <div className="mobile-controls">
    <button className={`joystick-base${knob.active?' is-active':''}`} aria-label="이동 조이스틱: 원하는 방향으로 밀어 이동" disabled={disabled}
      onPointerDown={event=>{
        if(disabled || event.button!==0 || !movement.begin(event.pointerId))return
        event.preventDefault()
        const element=event.currentTarget, rect=element.getBoundingClientRect()
        origin.current={x:rect.left+rect.width/2,y:rect.top+rect.height/2,radius:Math.max(1,(rect.width-52)/2)}
        capture.current={element,id:event.pointerId}
        element.setPointerCapture(event.pointerId)
        update(event.pointerId,event.clientX,event.clientY)
      }}
      onPointerMove={event=>update(event.pointerId,event.clientX,event.clientY)}
      onPointerUp={event=>{if(movement.end(event.pointerId))reset()}}
      onPointerCancel={event=>{if(movement.end(event.pointerId))reset()}}
      onLostPointerCapture={event=>{if(movement.end(event.pointerId))reset()}}
      onContextMenu={event=>event.preventDefault()}>
      <span className="joystick-cross" aria-hidden="true"/>
      <span className="joystick-knob" style={{transform:`translate(${knob.x}px,${knob.y}px)`}} aria-hidden="true"/>
    </button>
    <span className="joystick-label" aria-hidden="true">밀어서 이동</span>
  </div>
}
