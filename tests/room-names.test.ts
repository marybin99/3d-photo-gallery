import assert from 'node:assert/strict'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { defaultRoomNames, mapNameLines, namesFromRecords, roomName, validateRoomName } from '../src/roomModel.ts'
import { fillArtworkSlots, slotLabel } from '../src/artworkModel.ts'
import { artworks } from '../src/data.ts'
import { createRoomRepository } from '../src/roomRepository.ts'

test('room names trim spaces, reject empty or oversized names and retain stable room codes',()=>{
  assert.equal(validateRoomName('  계절의 기억  '),'계절의 기억')
  assert.throws(()=>validateRoomName('   '))
  assert.throws(()=>validateRoomName('가'.repeat(25)))
  assert.throws(()=>validateRoomName('봄\n여름'))
  const names=namesFromRecords([{id:'B',name:'계절의 기억',updated_at:'today'}])
  assert.equal(roomName('B',names),'계절의 기억')
  assert.equal(roomName('A',names),defaultRoomNames.A)
  assert.equal(roomName('LOBBY',names),'로비')
  assert.match(slotLabel('05',names),/^계절의 기억 · 정면 벽/)
  const long='가나다라마바사아자차카타파하가나다라마바사아자차카'
  assert.equal(mapNameLines(long).join(''),long)
  assert.ok(mapNameLines(long).every(line=>Array.from(line).length<=8))
})

test('unregistered and hidden slots have empty frames without demo photos or descriptions',()=>{
  const empty=fillArtworkSlots([])
  assert.equal(empty.length,36)
  assert.ok(empty.every(art=>art.image===''&&art.title===''&&art.description===''))
  empty.forEach((art,index)=>assert.deepEqual(art.position,artworks[index].position))
  const published={...artworks[4],title:'공개 작품',image:'https://example.test/photo.webp'}
  const mixed=fillArtworkSlots([published])
  assert.equal(mixed.length,36)
  assert.equal(mixed.filter(art=>art.image).length,1)
  assert.equal(mixed.find(art=>art.id===published.id)?.title,'공개 작품')
})

test('room rename uses the existing identifier and version without writing artwork positions',async()=>{
  const calls:{url:URL;method:string;body:string}[]=[]
  const client=createClient('https://room-test.supabase.co','test-key',{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:async(input,init)=>{
      calls.push({url:new URL(String(input)),method:init?.method??'GET',body:String(init?.body??'')})
      return new Response(JSON.stringify({id:'B',name:'봄의 기록',updated_at:'new'}),{headers:{'content-type':'application/json'}})
    }},
  })
  const record={id:'B' as const,name:'B 전시실',updated_at:'2026-11-13T00:00:00Z'}
  const next=await createRoomRepository(client).rename(record,' 봄의 기록 ')
  assert.equal(next.name,'봄의 기록')
  assert.match(calls[0].url.pathname,/gallery_rooms$/)
  assert.equal(calls[0].method,'PATCH')
  assert.deepEqual(JSON.parse(calls[0].body),{name:'봄의 기록'})
  assert.equal(calls[0].url.searchParams.get('id'),'eq.B')
  assert.equal(calls[0].url.searchParams.get('updated_at'),`eq.${record.updated_at}`)
})

test('room rename reports a conflict instead of overwriting a newer name',async()=>{
  const client=createClient('https://room-test.supabase.co','test-key',{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:async()=>new Response(JSON.stringify({code:'PGRST116',message:'No matching row'}),{status:406,headers:{'content-type':'application/json'}})},
  })
  await assert.rejects(()=>createRoomRepository(client).rename({id:'A',name:'A 전시실',updated_at:'old'},'새 이름'),/다른 곳에서/)
})
