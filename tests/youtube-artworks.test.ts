import assert from 'node:assert/strict'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { youtubeVideoId, normalizeYoutubeUrl } from '../src/youtubeModel.ts'
import { recordToArtwork } from '../src/artworkModel.ts'
import { artworks } from '../src/data.ts'
import { createArtworkRepository } from '../src/artworkRepository.ts'

const videoId='M7lc1UVf-VE'
const url=`https://www.youtube.com/watch?v=${videoId}`
test('YouTube links accept watch, share, shorts and live URLs and reject foreign or unsafe URLs',()=>{
  for(const input of [url,`https://youtu.be/${videoId}?si=abc`,`https://www.youtube.com/shorts/${videoId}`,`https://www.youtube.com/live/${videoId}`,`https://www.youtube-nocookie.com/embed/${videoId}`]){
    assert.equal(youtubeVideoId(input),videoId)
    assert.equal(normalizeYoutubeUrl(input),url)
  }
  for(const input of ['javascript:alert(1)','https://youtube.com.evil.test/watch?v='+videoId,'https://youtube.com/playlist?list=abc','https://youtu.be/invalid','https://user:pass@youtube.com/watch?v='+videoId])assert.throws(()=>youtubeVideoId(input))
})

const record={id:'row',slot_id:'05',title:'영상',description:'설명',image_path:null,youtube_url:url,is_published:true,created_at:'now',updated_at:'now'}
function repository(fail=false){
  const calls:{url:string;method:string;body:unknown}[]=[]
  const client=createClient('https://gallery-test.supabase.co','test-key',{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:async(input,init)=>{
      const body=typeof init?.body==='string'?JSON.parse(init.body):null
      calls.push({url:String(input),method:init?.method??'GET',body})
      return new Response(JSON.stringify(fail?{code:'23505',message:'duplicate'}:{...record,...body}),{status:fail?409:200,headers:{'content-type':'application/json'}})
    }},
  })
  return {api:createArtworkRepository(client),calls}
}
const draft={slot_id:'05',title:'영상',description:'설명',is_published:true,youtube_url:url}
test('video artwork saves and renders without a photo upload or signed image URL',async()=>{
  const {api,calls}=repository()
  const result=await api.save('admin',draft,null,null)
  assert.equal(result.record.image_path,null)
  assert.equal(calls.length,1)
  assert.deepEqual(calls[0].body,{...draft,image_path:null})
  assert.equal((await api.imageUrls([record])).size,0)
  assert.equal(calls.length,1)
  const art=recordToArtwork(record,'')
  assert.equal(art.youtubeId,videoId)
  assert.match(art.image,/i\.ytimg\.com/)
  assert.deepEqual(art.position,artworks[4].position)
})

test('photo-to-video conversion cleans the old photo only after the DB save; deleting video skips storage',async()=>{
  const {api,calls}=repository()
  await api.save('admin',draft,{...record,youtube_url:null,image_path:'old.webp'},null)
  assert.equal(calls[0].method,'PATCH')
  assert.equal(calls[1].method,'DELETE')
  assert.deepEqual(calls[1].body,{prefixes:['old.webp']})
  calls.length=0
  await api.delete(record)
  assert.equal(calls.length,1)
  assert.match(calls[0].url,/rest\/v1\/artworks/)
  const failed=repository(true)
  await assert.rejects(()=>failed.api.save('admin',draft,{...record,youtube_url:null,image_path:'old.webp'},null))
  assert.equal(failed.calls.length,1)
})
