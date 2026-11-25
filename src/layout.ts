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
export const lobbyTree: Barrier = { x: 3.75, z: -4, width: 2.5, depth: 2.5, height: 4.15 }
export const doorways = [
  { x: -8, z: 1, rotation: Math.PI/2, label: 'A · GALLERY', zone: 'A' },
  { x: 0, z: -6, rotation: 0, label: 'B · GALLERY', zone: 'B' },
  { x: 8, z: 1, rotation: -Math.PI/2, label: 'C · GALLERY', zone: 'C' },
]
export type Doorway = { x:number; z:number; rotation:number; zone:string; returnZone?:string }
function doorwayPosts(doors: Doorway[]): Barrier[] {
  return doors.flatMap(door=>[-1,1].map(side=>({
    x: door.x+Math.cos(door.rotation)*side*2.05,
    z: door.z-Math.sin(door.rotation)*side*2.05,
    width: Math.abs(Math.cos(door.rotation))>.5?.16:.42,
    depth: Math.abs(Math.cos(door.rotation))>.5?.42:.16,
    height: 4,
  })))
}
export const obstacles: Barrier[] = [...walls, ...doorwayPosts(doorways), desk, lobbyTree]
export type GalleryLayout = { areas: Area[]; walls: Barrier[]; obstacles: Barrier[]; doorways: Doorway[]; closedRoomIds: string[] }
// Pack rooms along a central corridor. Stable room/slot IDs survive deletion and repacking.
export function additionalRoomAreas(ids: string[]): Area[] {
  return [...new Set(ids)].filter(id=>/^[D-Z]$/.test(id)).sort().map((id,index)=>({
    id, label:`${id} 전시실`, x:index%2===0?-12:12, z:18+Math.floor(index/2)*16,
    width:16, depth:16, color:index%2===0?'#b9b29e':'#c3ac9e',
  }))
}
function withRoomAccess(layout: GalleryLayout, closedIds: string[]): GalleryLayout {
  const closedRoomIds=[...new Set(closedIds)].filter(id=>/^[A-Z]$/.test(id)&&layout.areas.some(area=>area.id===id))
  const barriers: Barrier[]=layout.doorways.filter(door=>closedRoomIds.includes(door.zone)).map(door=>({
    x:door.x,z:door.z,width:Math.abs(Math.cos(door.rotation))>.5?4.2:.4,
    depth:Math.abs(Math.cos(door.rotation))>.5?.4:4.2,height:4.1,
  }))
  return {...layout,closedRoomIds,obstacles:[...layout.obstacles,...barriers]}
}
export function createGalleryLayout(ids: string[], closedIds: string[]=[]): GalleryLayout {
  const extraAreas=additionalRoomAreas(ids)
  if(!extraAreas.length)return withRoomAccess(defaultLayout,closedIds)
  const rows=Math.ceil(extraAreas.length/2)
  const corridor: Area={id:'CORRIDOR',label:'연결 통로',x:0,z:10+rows*8,width:8,depth:rows*16,color:'#c7b49b'}
  const nextWalls: Barrier[]=[
    // Open the lobby's rear wall while retaining both original gallery walls.
    ...walls.slice(1),
    {x:-13,z:10,width:22,depth:.3},{x:13,z:10,width:22,depth:.3},
    {x:0,z:10+rows*16,width:8,depth:.3},
  ]
  for(let row=0;row<rows;row++){
    const z=18+row*16
    for(const side of [-1,1]){
      const area=extraAreas.find(a=>a.x===side*12&&a.z===z)
      if(area){
        nextWalls.push(
          ...(row>0?[{x:area.x,z:z-8,width:16,depth:.3}]:[]),{x:area.x,z:z+8,width:16,depth:.3},
          {x:side*20,z,width:.3,depth:16},
          {x:side*4,z:z-5,width:.3,depth:6},{x:side*4,z:z+5,width:.3,depth:6},
        )
      }else nextWalls.push({x:side*4,z,width:.3,depth:16})
    }
  }
  // Shared walls between adjacent rooms should be rendered and collided with once.
  const uniqueWalls=[...new Map(nextWalls.map(w=>[`${w.x},${w.z},${w.width},${w.depth}`,w])).values()]
  const nextDoors: Doorway[]=[...doorways,
    {x:0,z:10,rotation:Math.PI,zone:'CORRIDOR',returnZone:'LOBBY'},
    ...extraAreas.map(area=>({x:area.x<0?-4:4,z:area.z,
      rotation:area.x<0?Math.PI/2:-Math.PI/2,zone:area.id,returnZone:'CORRIDOR'})),
  ]
  return withRoomAccess({areas:[...areas,corridor,...extraAreas],walls:uniqueWalls,
    obstacles:[...uniqueWalls,...doorwayPosts(nextDoors),desk,lobbyTree],doorways:nextDoors,closedRoomIds:[]},closedIds)
}
export const defaultLayout: GalleryLayout = {areas,walls,obstacles,doorways,closedRoomIds:[]}
export const PLAYER_RADIUS = .35
function closestPoint(x: number, z: number, b: Barrier) {
  return { x: Math.max(b.x-b.width/2,Math.min(b.x+b.width/2,x)), z: Math.max(b.z-b.depth/2,Math.min(b.z+b.depth/2,z)) }
}
export function canStand(x: number, z: number, radius = PLAYER_RADIUS, layout = defaultLayout): boolean {
  const inBuilding = layout.areas.some(a => !layout.closedRoomIds.includes(a.id) && Math.abs(x-a.x)<=a.width/2 && Math.abs(z-a.z)<=a.depth/2)
  return inBuilding && !layout.obstacles.some(b=>{
    const closest=closestPoint(x,z,b)
    return Math.hypot(x-closest.x,z-closest.z)<radius-1e-7
  })
}

// Small swept steps prevent thin-wall tunnelling. Circle projection lets the
// player slide along walls and round furniture corners without an axis bias.
export function moveAndSlide(x: number, z: number, dx: number, dz: number, radius = PLAYER_RADIUS, layout = defaultLayout) {
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/(radius*.25)))
  for(let step=0;step<steps;step++){
    let nx=x+dx/steps, nz=z+dz/steps
    for(let pass=0;pass<6;pass++){
      let resolved=false
      for(const b of layout.obstacles){
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
    if(canStand(nx,nz,radius,layout)){x=nx;z=nz}
  }
  return {x,z}
}
export function areaAt(x: number, z: number, layout = defaultLayout): Area {
  return layout.areas.find(a => x > a.x-a.width/2 && x < a.x+a.width/2 && z > a.z-a.depth/2 && z < a.z+a.depth/2) ?? areas[0]
}

// Retain a visitor's position within their room if deleting another room repacks the wing.
export function reconcileGalleryPose(pose: typeof SPAWN, previous: GalleryLayout, next: GalleryLayout) {
  const oldArea=areaAt(pose.x,pose.z,previous)
  if(next.closedRoomIds.includes(oldArea.id))return {...SPAWN}
  if(/^[D-Z]$/.test(oldArea.id)){
    const area=next.areas.find(area=>area.id===oldArea.id)
    if(!area)return {...SPAWN}
    const candidate={...pose,x:pose.x+area.x-oldArea.x,z:pose.z+area.z-oldArea.z}
    return canStand(candidate.x,candidate.z,undefined,next)?candidate:{x:area.x,z:area.z,yaw:pose.yaw}
  }
  return canStand(pose.x,pose.z,undefined,next)?pose:{...SPAWN}
}
