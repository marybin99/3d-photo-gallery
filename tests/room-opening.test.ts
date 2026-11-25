import assert from 'node:assert/strict'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { createGalleryLayout, canStand, moveAndSlide, reconcileGalleryPose, SPAWN } from '../src/features/gallery/layout.ts'
import { openRoomIds } from '../src/features/rooms/roomModel.ts'
import type { RoomRecord } from '../src/features/rooms/types.ts'
import { createRoomRepository } from '../src/features/rooms/roomRepository.ts'
import { createCurtainGeometry } from '../src/features/gallery/curtainGeometry.ts'

const ids=['A','B','C','D','E','F']
test('closed entrances block walking in every orientation while the corridor and open rooms remain reachable',()=>{
  for(const closed of ids){
    const layout=createGalleryLayout(ids,[closed])
    assert.ok(canStand(SPAWN.x,SPAWN.z,undefined,layout))
    assert.ok(canStand(0,18,undefined,layout),'Closing an added room must not block the corridor')
    for(const door of layout.doorways.filter(door=>door.zone!=='CORRIDOR')){
      assert.equal(canStand(door.x,door.z,undefined,layout),door.zone!==closed)
      const nx=Math.sin(door.rotation),nz=Math.cos(door.rotation)
      const start={x:door.x+nx*2,z:door.z+nz*2}
      const end=moveAndSlide(start.x,start.z,-nx*4,-nz*4,undefined,layout)
      if(door.zone===closed){
        assert.ok((end.x-door.x)*nx+(end.z-door.z)*nz>.5,'Visitor must remain outside the curtain')
      }else{
        assert.ok(Math.hypot(end.x-(door.x-nx*2),end.z-(door.z-nz*2))<1e-5)
      }
    }
    const room=layout.areas.find(area=>area.id===closed)!
    assert.equal(canStand(room.x,room.z,undefined,layout),false,'Closed room cannot be a direct movement destination')
  }
})

test('closing an occupied room returns its visitor to the lobby and reopening removes the barrier',()=>{
  const open=createGalleryLayout(ids)
  for(const id of ids){
    const room=open.areas.find(area=>area.id===id)!
    const closed=createGalleryLayout(ids,[id])
    assert.deepEqual(reconcileGalleryPose({x:room.x,z:room.z,yaw:1},open,closed),SPAWN)
    const reopened=createGalleryLayout(ids)
    assert.ok(canStand(room.x,room.z,undefined,reopened))
    assert.ok(canStand(reopened.doorways.find(door=>door.zone===id)!.x,reopened.doorways.find(door=>door.zone===id)!.z,undefined,reopened))
  }
  const allClosed=createGalleryLayout(ids,ids)
  assert.ok(canStand(0,18,undefined,allClosed))
  assert.deepEqual(createGalleryLayout(ids).closedRoomIds,[],'Closing rooms cannot mutate the shared default layout')
})

test('only explicitly open room records become visitor destinations',()=>{
  const records:RoomRecord[]=[
    {id:'A',name:'봄',is_open:true,updated_at:'now'},
    {id:'B',name:'여름',is_open:false,updated_at:'now'},
    {id:'D',name:'가을',is_open:false,updated_at:'now'},
  ]
  assert.deepEqual(openRoomIds(records),['A'])
  assert.deepEqual(openRoomIds([]),[])
})

test('opening settings write only is_open with the current room version',async()=>{
  const calls:{url:URL;method:string;body:unknown}[]=[]
  const room={id:'D',name:'새 전시',is_open:false,updated_at:'old'}
  const client=createClient('https://room-test.supabase.co','test-key',{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:async(input,init)=>{
      calls.push({url:new URL(String(input)),method:init?.method??'GET',body:JSON.parse(String(init?.body))})
      return new Response(JSON.stringify({...room,is_open:true,updated_at:'new'}),{headers:{'content-type':'application/json'}})
    }},
  })
  const next=await createRoomRepository(client).setOpen(room,true)
  assert.equal(next.is_open,true)
  assert.equal(next.updated_at,'new')
  assert.deepEqual(calls[0].body,{is_open:true})
  assert.equal(calls[0].method,'PATCH')
  assert.equal(calls[0].url.searchParams.get('id'),'eq.D')
  assert.equal(calls[0].url.searchParams.get('updated_at'),'eq.old')
  assert.match(calls[0].url.searchParams.get('select')!,/is_open/)
})

test('failed or concurrent opening updates produce actionable errors',async()=>{
  for(const code of ['PGRST116','42501']){
    const client=createClient('https://room-test.supabase.co','test-key',{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
      global:{fetch:async()=>new Response(JSON.stringify({code,message:'failure'}),{status:code==='42501'?403:406,headers:{'content-type':'application/json'}})},
    })
    await assert.rejects(()=>createRoomRepository(client).setOpen({id:'A',name:'봄',is_open:true,updated_at:'old'},false),code==='PGRST116'?/다른 곳에서/:/운영자 권한/)
  }
})

test('pleated curtain covers the full entrance and its folds stay within the collision barrier',()=>{
  const geometry=createCurtainGeometry()
  try{
    geometry.computeBoundingBox()
    const bounds=geometry.boundingBox!
    assert.ok(bounds.min.x<=-2&&bounds.max.x>=2)
    assert.ok(bounds.min.y+2.02<=0&&bounds.max.y+2.02>=4)
    assert.ok(bounds.min.z>=-.2&&bounds.max.z<=.2)
    assert.ok(bounds.max.z-bounds.min.z>.15,'Fabric must have visible folds')
    for(const value of geometry.attributes.normal.array)assert.ok(Number.isFinite(value))
  }finally{geometry.dispose()}
})
