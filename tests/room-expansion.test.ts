import assert from 'node:assert/strict'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { artworkSlots, artworks } from '../src/data.ts'
import { areaAt, canStand, createGalleryLayout, moveAndSlide, reconcileGalleryPose, SPAWN } from '../src/layout.ts'
import { allRoomIds, namesFromRecords, roomName } from '../src/roomModel.ts'
import { fillArtworkSlots, firstAvailableSlot, recordToArtwork, slotLabel, validateDraft } from '../src/artworkModel.ts'
import { minimapGeometry } from '../src/minimapModel.ts'
import { createRoomRepository } from '../src/roomRepository.ts'

const ids=['A','B','C','D','E','Z']
test('additional rooms preserve existing frames and have twelve distinct supported frames each',()=>{
  const slots=artworkSlots(ids)
  const layout=createGalleryLayout(ids)
  assert.deepEqual(slots.slice(0,36),artworks)
  assert.equal(slots.length,72)
  assert.equal(new Set(slots.map(slot=>slot.id)).size,72)
  for(const id of ['D','E','Z']){
    const area=layout.areas.find(area=>area.id===id)!
    assert.ok(canStand(area.x,area.z+3,undefined,layout))
    assert.equal(areaAt(area.x,area.z,layout).id,id)
    const hit=moveAndSlide(area.x,area.z,0,30,undefined,layout)
    assert.ok(hit.z<area.z+7.51)
    assert.ok(canStand(hit.x,hit.z,undefined,layout))
    for(const wall of ['front','left','right'])assert.equal(slots.filter(slot=>slot.zone===id&&slot.wall===wall).length,4)
    for(const art of slots.filter(slot=>slot.zone===id)){
      const [x,,z]=art.position
      const nx=Math.sin(art.rotation),nz=Math.cos(art.rotation)
      assert.equal(areaAt(x,z,layout).id,id)
      assert.ok((area.x-x)*nx+(area.z-z)*nz>0)
      assert.ok(layout.walls.some(w=>Math.abs(x-nx*.25-w.x)<=w.width/2+1e-7&&Math.abs(z-nz*.25-w.z)<=w.depth/2+1e-7))
    }
  }
})

test('added room names, empty frames, allocation, labels and artwork conversion use added slots',()=>{
  const records=[{id:'D',name:'계절의 기억',is_open:true,updated_at:'now'}]
  const names=namesFromRecords(records)
  assert.deepEqual(allRoomIds(records),['A','B','C','D'])
  assert.equal(roomName('D',names),'계절의 기억')
  const slots=artworkSlots(allRoomIds(records))
  assert.equal(firstAvailableSlot([],'D',slots),'D-01')
  assert.equal(firstAvailableSlot(slots.filter(s=>s.zone==='D').map(s=>({slot_id:s.id})),'D',slots),'')
  assert.equal(fillArtworkSlots([],slots).length,48)
  assert.match(slotLabel('D-01',names,slots),/^계절의 기억 · 정면 벽 · 1번$/)
  const draft={slot_id:'D-01',title:'봄',description:'',is_published:true}
  assert.equal(validateDraft(draft,slots).slot_id,'D-01')
  assert.throws(()=>validateDraft({...draft,slot_id:'F-01'},slots))
  const art=recordToArtwork({...draft,id:'row',image_path:'photo',created_at:'now',updated_at:'now'},'url',slots)
  assert.equal(art.zone,'D')
  assert.equal(art.image,'url')
})

test('room creation sends only the validated name to the atomic admin RPC',async()=>{
  const calls:{path:string;body:unknown}[]=[]
  const client=createClient('https://room-test.supabase.co','test-key',{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:async(input,init)=>{
      calls.push({path:new URL(String(input)).pathname,body:JSON.parse(String(init?.body))})
      return new Response(JSON.stringify([{id:'D',name:'봄',is_open:false,updated_at:'now'}]),{headers:{'content-type':'application/json'}})
    }},
  })
  const repo=createRoomRepository(client)
  await assert.rejects(()=>repo.create('  '))
  assert.equal(calls.length,0)
  assert.equal((await repo.create(' 봄 ')).id,'D')
  assert.deepEqual(calls,[{path:'/rest/v1/rpc/create_gallery_room',body:{room_name:'봄'}}])
})

test('room creation surfaces capacity and permission errors without claiming success',async()=>{
  for(const code of ['P0001','42501']){
    const client=createClient('https://room-test.supabase.co','test-key',{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
      global:{fetch:async()=>new Response(JSON.stringify({code,message:'전시실은 최대 26개까지 추가할 수 있습니다.'}),{status:403,headers:{'content-type':'application/json'}})},
    })
    await assert.rejects(()=>createRoomRepository(client).create('봄'),code==='P0001'?/최대 26개/:/운영자 권한/)
  }
})


test('every added room connects to the lobby through the corridor even with gaps in room IDs',()=>{
  for(const roomIds of [ids,Array.from({length:26},(_,index)=>String.fromCharCode(65+index))]){
    const layout=createGalleryLayout(roomIds)
    for(const room of layout.areas.filter(area=>/^[D-Z]$/.test(area.id))){
      const corridor=moveAndSlide(0,8,0,room.z-8,undefined,layout)
      assert.ok(Math.abs(corridor.z-room.z)<1e-5,`Corridor to ${room.id} must be clear`)
      const entered=moveAndSlide(corridor.x,corridor.z,room.x,0,undefined,layout)
      assert.ok(Math.abs(entered.x-room.x)<1e-5,`Door to ${room.id} must be clear`)
      const back=moveAndSlide(entered.x,entered.z,-room.x,0,undefined,layout)
      assert.ok(Math.abs(back.x)<1e-5)
      const lobby=moveAndSlide(back.x,back.z,0,8-back.z,undefined,layout)
      assert.ok(Math.abs(lobby.z-8)<1e-5)
    }
    for(const door of layout.doorways)assert.ok(canStand(door.x,door.z,undefined,layout))
    const room=layout.areas.find(area=>area.id==='D')!
    assert.equal(canStand(-4,room.z+5,undefined,layout),false,'Room divider stays solid outside the doorway')
    assert.equal(canStand(0,10+Math.ceil((roomIds.length-3)/2)*16,undefined,layout),false,'End of corridor is closed')
  }
})

test('deletion closes an unused wing and repacks rooms with safe visitor positions and artwork coordinates',()=>{
  const before=createGalleryLayout(['A','B','C','D','E','F'])
  const after=createGalleryLayout(['A','B','C','F'])
  const oldF=before.areas.find(area=>area.id==='F')!
  const newF=after.areas.find(area=>area.id==='F')!
  const visitor={x:oldF.x+1,z:oldF.z+2,yaw:1}
  assert.deepEqual(reconcileGalleryPose(visitor,before,after),{x:newF.x+1,z:newF.z+2,yaw:1})
  const deletedRoom=before.areas.find(area=>area.id==='D')!
  assert.deepEqual(reconcileGalleryPose({x:deletedRoom.x,z:deletedRoom.z,yaw:0},before,after),SPAWN)
  const empty=createGalleryLayout(['A','B','C'])
  assert.equal(empty.areas.some(area=>area.id==='CORRIDOR'),false)
  assert.equal(canStand(0,10,undefined,empty),false)
  assert.equal(canStand(0,10,undefined,before),true)
  assert.deepEqual(reconcileGalleryPose({x:0,z:18,yaw:0},before,empty),SPAWN)
  const oldSlot=artworkSlots(['A','B','C','D','E','F']).find(slot=>slot.id==='F-01')!
  const newSlots=artworkSlots(['A','B','C','F'])
  const displayed=fillArtworkSlots([{...oldSlot,image:'photo'}],newSlots).find(slot=>slot.id==='F-01')!
  assert.deepEqual(displayed.position,newSlots.find(slot=>slot.id==='F-01')!.position)
  assert.equal(displayed.image,'photo')
})

test('minimap contains every room and every connecting door and contracts after deletion',()=>{
  for(const count of [3,4,7,26]){
    const roomIds=Array.from({length:count},(_,index)=>String.fromCharCode(65+index))
    const layout=createGalleryLayout(roomIds)
    const map=minimapGeometry(layout)
    for(const area of layout.areas){
      assert.ok(map.mapX(area.x-area.width/2)>=0)
      assert.ok(map.mapX(area.x+area.width/2)<=map.width)
      assert.ok(map.mapY(area.z-area.depth/2)>=0)
      assert.ok(map.mapY(area.z+area.depth/2)<=map.height)
    }
    assert.equal(layout.doorways.length,count+(count>3?1:0))
  }
  assert.ok(minimapGeometry(createGalleryLayout(ids)).height>minimapGeometry(createGalleryLayout(['A','B','C'])).height)
})

test('room deletion checks the ID and sends its version to the admin RPC',async()=>{
  const calls:{path:string;body:unknown}[]=[]
  const client=createClient('https://room-test.supabase.co','test-key',{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:async(input,init)=>{
      calls.push({path:new URL(String(input)).pathname,body:JSON.parse(String(init?.body))})
      return new Response(null,{status:204})
    }},
  })
  const repo=createRoomRepository(client)
  await assert.rejects(()=>repo.remove({id:'A',name:'기본 전시실',is_open:true,updated_at:'now'}),/기본/)
  assert.equal(calls.length,0)
  await repo.remove({id:'D',name:'봄',is_open:false,updated_at:'now'})
  assert.deepEqual(calls,[{path:'/rest/v1/rpc/delete_gallery_room',body:{room_id:'D',expected_updated_at:'now'}}])
})

test('failed deletions preserve server messages for occupied rooms and concurrent edits',async()=>{
  for(const message of ['등록된 작품이 있는 전시실은 삭제할 수 없습니다.','전시실이 변경되거나 삭제되었습니다. 다시 불러온 뒤 삭제해 주세요.']){
    const client=createClient('https://room-test.supabase.co','test-key',{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
      global:{fetch:async()=>new Response(JSON.stringify({code:'P0001',message}),{status:400,headers:{'content-type':'application/json'}})},
    })
    await assert.rejects(()=>createRoomRepository(client).remove({id:'D',name:'봄',is_open:false,updated_at:'now'}),{message})
  }
})
