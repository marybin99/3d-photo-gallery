export const DEFAULT_PITCH = Math.atan2(1.8, 4.5)
export type MovementInput = { forward: number; right: number }
export function joystickInput(dx: number, dy: number, radius: number) {
  const distance=Math.hypot(dx,dy)
  const limit=Math.max(1,radius)
  const clamped=Math.min(distance,limit)
  const magnitude=Math.max(0,(clamped/limit-.12)/.88)
  return {
    x: distance?dx/distance*clamped:0,
    y: distance?dy/distance*clamped:0,
    forward: distance?-dy/distance*magnitude:0,
    right: distance?dx/distance*magnitude:0,
  }
}

export function createJoystick(input: { current: MovementInput }) {
  let pointer: number|null=null
  return {
    begin(id: number) {
      if(pointer!==null)return false
      pointer=id
      return true
    },
    move(id: number, dx: number, dy: number, radius: number) {
      if(pointer!==id)return null
      const result=joystickInput(dx,dy,radius)
      input.current={forward:result.forward,right:result.right}
      return result
    },
    end(id: number) {
      if(pointer!==id)return false
      pointer=null
      input.current={forward:0,right:0}
      return true
    },
    reset() { pointer=null;input.current={forward:0,right:0} },
  }
}

export function mouseLook(yaw: number, pitch: number, dx: number, dy: number) {
  return {
    yaw: yaw - dx * .004,
    pitch: Math.max(-.25, Math.min(1.1, pitch + dy * .003)),
  }
}

// Right is positive; movement stays on the floor regardless of camera pitch.
export function movementDelta(yaw: number, forward: number, right: number, distance: number) {
  const length = Math.max(1, Math.hypot(forward, right))
  return {
    x: (-Math.sin(yaw) * forward + Math.cos(yaw) * right) / length * distance,
    z: (-Math.cos(yaw) * forward - Math.sin(yaw) * right) / length * distance,
  }
}

export function bindMouseLook(canvas: HTMLCanvasElement, onLook: (dx: number, dy: number) => void) {
  let pointer: number | null = null
  let touch = false
  let startX = 0, startY = 0, lastX = 0, lastY = 0
  let dragged = false
  const stop = () => {
    const captured = pointer
    pointer = null
    if (captured !== null && canvas.hasPointerCapture(captured)) canvas.releasePointerCapture(captured)
  }
  const down = (event: PointerEvent) => {
    if (!['mouse','touch'].includes(event.pointerType) || event.button !== 0 || pointer !== null) return
    pointer = event.pointerId
    touch = event.pointerType === 'touch'
    startX = lastX = event.clientX
    startY = lastY = event.clientY
    dragged = false
    canvas.setPointerCapture(pointer)
  }
  const move = (event: PointerEvent) => {
    if (event.pointerId !== pointer) return
    if (!touch && !(event.buttons & 1)) { stop(); return }
    if (!dragged && Math.hypot(event.clientX-startX, event.clientY-startY) < 5) return
    dragged = true
    onLook(event.clientX-lastX, event.clientY-lastY)
    lastX = event.clientX
    lastY = event.clientY
  }
  const up = (event: PointerEvent) => { if (event.pointerId === pointer) stop() }
  const click = (event: MouseEvent) => {
    // A drag ending over an artwork or the book must not open its dialog.
    if (dragged && event.detail !== 0) { event.preventDefault(); event.stopImmediatePropagation() }
  }
  canvas.addEventListener('pointerdown', down, true)
  canvas.addEventListener('pointermove', move, true)
  canvas.addEventListener('pointerup', up, true)
  canvas.addEventListener('pointercancel', up, true)
  canvas.addEventListener('lostpointercapture', up, true)
  canvas.addEventListener('click', click, true)
  window.addEventListener('blur', stop)
  document.addEventListener('visibilitychange', stop)
  return () => {
    stop()
    canvas.removeEventListener('pointerdown', down, true)
    canvas.removeEventListener('pointermove', move, true)
    canvas.removeEventListener('pointerup', up, true)
    canvas.removeEventListener('pointercancel', up, true)
    canvas.removeEventListener('lostpointercapture', up, true)
    canvas.removeEventListener('click', click, true)
    window.removeEventListener('blur', stop)
    document.removeEventListener('visibilitychange', stop)
  }
}
