import assert from 'node:assert/strict'
import test from 'node:test'
import { areaAt, areas, BOOK, canStand, moveAndSlide, SPAWN, walls } from '../src/layout.ts'
import { artworks } from '../src/data.ts'

function walkPath(points: [number, number][]) {
  for (let i = 1; i < points.length; i++) {
    const [x0, z0] = points[i-1]
    const [x1, z1] = points[i]
    const steps = Math.ceil(Math.hypot(x1-x0, z1-z0) / .1)
    for (let step = 0; step <= steps; step++) {
      const x = x0+(x1-x0)*step/steps
      const z = z0+(z1-z0)*step/steps
      assert.ok(canStand(x,z), `Route blocked at ${x}, ${z}`)
    }
  }
}

test('every visit starts at a clear position in the lobby', () => {
  assert.equal(areaAt(SPAWN.x,SPAWN.z).id,'LOBBY')
  assert.ok(canStand(SPAWN.x,SPAWN.z))
  assert.equal(areas.length,4)
})

test('all three galleries can be reached from the lobby and back through doors', () => {
  const routes: [number,number][][] = [
    [[0,8],[0,1],[-16,1]],
    [[0,8],[0,-14]],
    [[0,8],[0,1],[16,1]],
  ]
  routes.forEach((route,i) => {
    walkPath(route)
    const end = route[route.length-1]
    assert.equal(areaAt(...end).id,['A','B','C'][i])
    walkPath([...route].reverse())
  })
})

test('room dividers block movement outside the door openings', () => {
  for (const x of [-8,8]) {
    assert.ok(canStand(x,1))
    for (const z of [-4,5,8]) assert.equal(canStand(x,z),false)
    assert.equal(canStand(x,2.8),false,'Player radius must clear the door edge')
  }
  assert.ok(canStand(0,-6))
  for (const x of [-6,-3,3,6]) assert.equal(canStand(x,-6),false)
  for (const wall of walls) assert.equal(canStand(wall.x,wall.z),false)
})

test('outer walls and empty space between wings cannot be entered', () => {
  for (const [x,z] of [[-25,0],[25,0],[0,11],[0,-23],[-16,-14],[16,-14]]) {
    assert.equal(canStand(x,z),false)
  }
})

test('the guestbook desk is solid and can be approached from the lobby', () => {
  assert.equal(canStand(BOOK.x,BOOK.z),false)
  walkPath([[0,8],[BOOK.x,6]])
  assert.ok(Math.hypot(BOOK.x-BOOK.x,6-BOOK.z)<3.2)
})

test('each gallery displays four works on each of its three walls', () => {
  for (const zone of ['A','B','C']) {
    const roomWorks = artworks.filter(art=>art.zone===zone)
    assert.equal(roomWorks.length,12)
    for (const wall of ['front','left','right']) assert.equal(roomWorks.filter(art=>art.wall===wall).length,4)
    roomWorks.forEach(art=>assert.equal(areaAt(art.position[0],art.position[2]).id,zone))
  }
})

test('large movement cannot tunnel through a thin divider or outer wall', () => {
  const divider=moveAndSlide(0,5,16,0)
  assert.ok(divider.x<7.51 && divider.x>7.4)
  assert.ok(canStand(divider.x,divider.z))
  const outer=moveAndSlide(0,0,60,0)
  assert.ok(outer.x<23.51 && outer.x>23.4)
  assert.ok(canStand(outer.x,outer.z))
})

test('diagonal movement slides along walls symmetrically', () => {
  const right=moveAndSlide(6,4,4,3)
  const left=moveAndSlide(-6,4,-4,3)
  assert.ok(Math.abs(right.x+left.x)<1e-6)
  assert.ok(Math.abs(right.z-7)<1e-6)
  assert.ok(Math.abs(left.z-7)<1e-6)
  assert.ok(canStand(right.x,right.z) && canStand(left.x,left.z))
})

test('circle collision permits rounded corner clearance and includes doorway posts', () => {
  assert.ok(canStand(-1.55,4.95),'Clear the desk corner with a circular body')
  assert.equal(canStand(-1.56,4.94),false,'Circle must not overlap the desk corner')
  assert.equal(canStand(-8.5,2.8),false,'Door trim protrudes beyond the wall')
  const deskHit=moveAndSlide(BOOK.x,6,0,-8)
  assert.ok(deskHit.z>5.04 && deskHit.z<5.06)
  assert.ok(canStand(deskHit.x,deskHit.z))
})

test('collision-resolved routes can enter and leave every room', () => {
  for(const target of [{x:-16,z:1},{x:16,z:1},{x:0,z:-14}]){
    const result=moveAndSlide(0,1,target.x,target.z-1)
    assert.ok(Math.hypot(result.x-target.x,result.z-target.z)<1e-6)
    const back=moveAndSlide(result.x,result.z,-target.x,1-target.z)
    assert.ok(Math.hypot(back.x,back.z-1)<1e-6)
  }
})


test('frames face their gallery interior and are supported by solid walls',()=>{
  assert.equal(new Set(artworks.map(art=>art.id)).size,artworks.length)
  for(const art of artworks){
    const room=areas.find(area=>area.id===art.zone)!
    const [x,,z]=art.position
    const nx=Math.sin(art.rotation),nz=Math.cos(art.rotation)
    assert.ok((room.x-x)*nx+(room.z-z)*nz>0,`${art.id} must face inward`)
    const bx=x-nx*.25,bz=z-nz*.25
    assert.ok(walls.some(w=>Math.abs(bx-w.x)<=w.width/2+1e-7 && Math.abs(bz-w.z)<=w.depth/2+1e-7),`${art.id} must hang on a wall, not a door`)
  }
  for(const art of artworks){
    for(const other of artworks){
      if(art.id===other.id || art.zone!==other.zone || art.wall!==other.wall)continue
      assert.ok(Math.hypot(art.position[0]-other.position[0],art.position[2]-other.position[2])>2.72,'Frames on the same wall must not overlap')
    }
  }
})
