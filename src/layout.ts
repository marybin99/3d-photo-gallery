// Scene geometry, navigation and minimap share these world coordinates.
export type Area = { id: string; label: string; x: number; z: number; width: number; depth: number; color: string }
export type Barrier = { x: number; z: number; width: number; depth: number; height?: number }
// Leave enough space behind the visitor for the full follow-camera distance.
export const SPAWN = { x: 0, z: 4.5, yaw: 0 }
export const BOOK = { x: -3, z: 4 }
export const areas: Area[] = [
  { id: 'LOBBY', label: '로비', x: 0, z: 2, width: 16, depth: 16, color: '#c7b49b' },
  { id: 'A', label: 'A 전시실', x: -16, z: 2, width: 16, depth: 16, color: '#b9b29e' },
  { id: 'B', label: 'B 전시실', x: 0, z: -14, width: 16, depth: 16, color: '#b5ada2' },
  { id: 'C', label: 'C 전시실', x: 16, z: 2, width: 16, depth: 16, color: '#c3ac9e' },
]
export const walls: Barrier[] = [
  { x: 0, z: 10, width: 48, depth: .3 },
  { x: -24, z: 2, width: .3, depth: 16 },
  { x: 24, z: 2, width: .3, depth: 16 },
  { x: -16, z: -6, width: 16, depth: .3 },
  { x: 16, z: -6, width: 16, depth: .3 },
  { x: 0, z: -22, width: 16, depth: .3 },
  { x: -8, z: -14, width: .3, depth: 16 },
  { x: 8, z: -14, width: .3, depth: 16 },
  // Four-unit-wide openings connect all three rooms to the lobby.
  { x: -8, z: -3.5, width: .3, depth: 5 },
  { x: -8, z: 6.5, width: .3, depth: 7 },
  { x: 8, z: -3.5, width: .3, depth: 5 },
  { x: 8, z: 6.5, width: .3, depth: 7 },
  { x: -5, z: -6, width: 6, depth: .3 },
  { x: 5, z: -6, width: 6, depth: .3 },
]
export const desk: Barrier = { x: BOOK.x, z: BOOK.z, width: 2.4, depth: 1.4, height: 1.18 }
export const doorways = [
  { x: -8, z: 1, rotation: Math.PI/2, label: 'A · GALLERY', zone: 'A' },
  { x: 0, z: -6, rotation: 0, label: 'B · GALLERY', zone: 'B' },
  { x: 8, z: 1, rotation: -Math.PI/2, label: 'C · GALLERY', zone: 'C' },
]
const jambs: Barrier[] = doorways.flatMap(door=>[-1,1].map(side=>({
  x: door.x+Math.cos(door.rotation)*side*2.05,
  z: door.z-Math.sin(door.rotation)*side*2.05,
  width: door.rotation===0?.16:.42,
  depth: door.rotation===0?.42:.16,
  height: 4,
})))
export const obstacles: Barrier[] = [...walls, ...jambs, desk]
export const PLAYER_RADIUS = .35
function closestPoint(x: number, z: number, b: Barrier) {
  return { x: Math.max(b.x-b.width/2,Math.min(b.x+b.width/2,x)), z: Math.max(b.z-b.depth/2,Math.min(b.z+b.depth/2,z)) }
}
export function canStand(x: number, z: number, radius = PLAYER_RADIUS): boolean {
  const inBuilding = areas.some(a => Math.abs(x-a.x)<=a.width/2 && Math.abs(z-a.z)<=a.depth/2)
  return inBuilding && !obstacles.some(b=>{
    const closest=closestPoint(x,z,b)
    return Math.hypot(x-closest.x,z-closest.z)<radius-1e-7
  })
}

// Small swept steps prevent thin-wall tunnelling. Circle projection lets the
// player slide along walls and round furniture corners without an axis bias.
export function moveAndSlide(x: number, z: number, dx: number, dz: number, radius = PLAYER_RADIUS) {
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/(radius*.25)))
  for(let step=0;step<steps;step++){
    let nx=x+dx/steps, nz=z+dz/steps
    for(let pass=0;pass<6;pass++){
      let resolved=false
      for(const b of obstacles){
        const closest=closestPoint(nx,nz,b)
        const ax=nx-closest.x, az=nz-closest.z, distance=Math.hypot(ax,az)
        if(distance>=radius)continue
        if(distance>1e-8){
          const push=(radius-distance+1e-6)/distance
          nx+=ax*push; nz+=az*push
        }else{
          const exits=[
            {distance:Math.abs(nx-(b.x-b.width/2)),x:b.x-b.width/2-radius-1e-6,z:nz},
            {distance:Math.abs(nx-(b.x+b.width/2)),x:b.x+b.width/2+radius+1e-6,z:nz},
            {distance:Math.abs(nz-(b.z-b.depth/2)),x:nx,z:b.z-b.depth/2-radius-1e-6},
            {distance:Math.abs(nz-(b.z+b.depth/2)),x:nx,z:b.z+b.depth/2+radius+1e-6},
          ].sort((a,b)=>a.distance-b.distance)
          nx=exits[0].x; nz=exits[0].z
        }
        resolved=true
      }
      if(!resolved)break
    }
    if(canStand(nx,nz,radius)){x=nx;z=nz}
  }
  return {x,z}
}
export function areaAt(x: number, z: number): Area {
  return areas.find(a => x > a.x-a.width/2 && x < a.x+a.width/2 && z > a.z-a.depth/2 && z < a.z+a.depth/2) ?? areas[0]
}
