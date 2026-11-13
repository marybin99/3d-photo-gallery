import assert from 'node:assert/strict'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { createGuestbookHandler, type GuestbookWriter } from '../supabase/functions/guestbook-submit/handler.ts'
import { validateGuestbookText } from '../supabase/functions/_shared/guestbook.ts'
import { createGuestbookRepository } from '../src/guestbookRepository.ts'

const origin='https://gallery.example.test'
const clientId='11111111-1111-4111-8111-111111111111'
const requestId='22222222-2222-4222-8222-222222222222'
const entry={id:'33333333-3333-4333-8333-333333333333',nickname:'관람객',message:'좋은 전시였습니다.',created_at:'2026-11-13T00:00:00Z'}
const body={nickname:entry.nickname,message:entry.message,clientId,requestId,website:'',token:''}
const request=(value:unknown=body,extra:Record<string,string>={})=>new Request('https://project.supabase.co/functions/v1/guestbook-submit',{method:'POST',headers:{origin,'content-type':'application/json',...extra},body:JSON.stringify(value)})
const config={origins:[origin],rateSecret:'test-server-only-hmac-secret'}

test('guestbook validation trims text, preserves newlines and rejects empty or oversized content',()=>{
  assert.deepEqual(validateGuestbookText(' 관람객 ',' 첫 줄\r\n둘째 줄 '),{nickname:'관람객',message:'첫 줄\n둘째 줄'})
  assert.throws(()=>validateGuestbookText(' ','글'))
  assert.throws(()=>validateGuestbookText('관람객',' '))
  assert.throws(()=>validateGuestbookText('관람객','가'.repeat(281)))
  assert.throws(()=>validateGuestbookText('가'.repeat(25),'글'))
  assert.throws(()=>validateGuestbookText('이름\n다른 이름','글'))
  assert.throws(()=>validateGuestbookText('이름','글\u0000'))
})

test('public Edge handler accepts validated text, forwards request ID and hashes the client identifier',async()=>{
  const calls:Parameters<GuestbookWriter>[0][]=[]
  const handler=createGuestbookHandler(config,async value=>{calls.push(value);return entry})
  const response=await handler(request({...body,is_visible:false,created_at:'forged'}))
  assert.equal(response.status,201)
  assert.equal(response.headers.get('access-control-allow-origin'),origin)
  assert.equal(response.headers.get('cache-control'),'no-store')
  assert.deepEqual((await response.json()).entry,entry)
  assert.match(calls[0].rateKey,/^[a-f0-9]{64}$/)
  assert.equal(calls[0].requestId,requestId)
  assert.equal('is_visible' in calls[0],false)
  assert.equal('clientId' in calls[0],false)
  await handler(request())
  assert.equal(calls[1].rateKey,calls[0].rateKey)
  await handler(request({...body,clientId:'44444444-4444-4444-8444-444444444444'}))
  assert.notEqual(calls[2].rateKey,calls[0].rateKey)
})

test('CORS, method, honeypot and invalid input checks happen before any database write',async()=>{
  let writes=0
  const handler=createGuestbookHandler(config,async()=>{writes++;return entry})
  const preflight=await handler(new Request('https://function.test',{method:'OPTIONS',headers:{origin}}))
  assert.equal(preflight.status,204)
  assert.equal((await handler(request(body,{origin:'https://other.test'}))).status,403)
  assert.equal((await handler(new Request('https://function.test',{headers:{origin}}))).status,405)
  assert.equal((await handler(request({...body,website:'https://bot.test'}))).status,400)
  assert.equal((await handler(request({...body,nickname:''}))).status,400)
  assert.equal((await handler(request({...body,requestId:'invalid'}))).status,400)
  assert.equal((await handler(request({...body,message:'가'.repeat(281)}))).status,400)
  assert.equal((await handler(request(body,{'content-type':'text/plain'}))).status,400)
  assert.equal(writes,0)
})

test('request body size is enforced even when no Content-Length header is provided',async()=>{
  let writes=0
  const handler=createGuestbookHandler(config,async()=>{writes++;return entry})
  const response=await handler(request({...body,message:'x'.repeat(9000)}))
  assert.equal(response.status,413)
  assert.equal(writes,0)
})

test('server rate-limit results become retryable errors and private database details stay private',async()=>{
  for(const code of ['GUESTBOOK_RATE_LIMIT','GUESTBOOK_HOURLY_LIMIT','GUESTBOOK_GLOBAL_LIMIT']){
    const handler=createGuestbookHandler(config,async()=>{throw new Error(code)})
    const response=await handler(request())
    assert.equal(response.status,429)
    assert.ok(response.headers.get('retry-after'))
  }
  const handler=createGuestbookHandler(config,async()=>{throw new Error('private DB connection detail')})
  const response=await handler(request())
  assert.equal(response.status,500)
  assert.ok(!(await response.text()).includes('private DB'))
})

test('Turnstile verification is required when configured and rejects mismatched hosts',async()=>{
  let writes=0,checks=0
  const writer:GuestbookWriter=async()=>{writes++;return entry}
  const fetcher:typeof fetch=async()=>{checks++;return new Response(JSON.stringify({success:true,hostname:'other.test',action:'guestbook'}))}
  const handler=createGuestbookHandler({...config,turnstileSecret:'server-captcha-secret'},writer,fetcher)
  assert.equal((await handler(request())).status,400)
  assert.equal(checks,0)
  assert.equal((await handler(request({...body,token:'test-token'}))).status,400)
  assert.equal(writes,0)
  assert.equal(checks,1)
})

test('verified guestbook challenge permits writing without exposing the secret',async()=>{
  let verificationBody=''
  const handler=createGuestbookHandler({...config,turnstileSecret:'server-captcha-secret'},async()=>entry,async(_input,init)=>{
    verificationBody=String(init?.body)
    return new Response(JSON.stringify({success:true,hostname:'gallery.example.test',action:'guestbook'}))
  })
  const response=await handler(request({...body,token:'test-token'}))
  assert.equal(response.status,201)
  assert.match(verificationBody,/secret=server-captcha-secret/)
  assert.ok(!(await response.text()).includes('server-captcha-secret'))
})

test('frontend submits through Edge Function and propagates readable server errors',async()=>{
  const calls:{url:string;body:unknown}[]=[]
  let status=201
  const client=createClient('https://guestbook-test.supabase.co','test-key',{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:async(input,init)=>{
      calls.push({url:String(input),body:JSON.parse(String(init?.body))})
      return new Response(JSON.stringify(status===201?{entry}:{error:'1분 후 다시 등록해 주세요.'}),{status,headers:{'content-type':'application/json'}})
    }},
  })
  const repository=createGuestbookRepository(client)
  assert.deepEqual(await repository.submit(body),entry)
  assert.match(calls[0].url,/functions\/v1\/guestbook-submit$/)
  assert.equal((calls[0].body as typeof body).requestId,requestId)
  status=429
  await assert.rejects(()=>repository.submit(body),/1분 후/)
})

test('CORS accepts normalized configured URLs without allowing other origins',async()=>{
  const handler=createGuestbookHandler({...config,origins:[`"${origin}/"`,'not-a-url','*']},async()=>entry)
  const response=await handler(request())
  assert.equal(response.status,201)
  assert.equal(response.headers.get('access-control-allow-origin'),origin)
  assert.match(response.headers.get('access-control-allow-headers')! ,/x-retry-count/)
  assert.equal((await handler(request(body,{origin:'https://unlisted.example.test'}))).status,403)
})

test('gateway JWT, missing-function and startup errors retain their status in the displayed error',async()=>{
  const originalWarn=console.warn
  const logs:unknown[][]=[]
  console.warn=(...args:unknown[])=>logs.push(args)
  try{
    for(const status of [401,404,503]){
      const client=createClient('https://guestbook-test.supabase.co','test-key',{
        auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
        global:{fetch:async()=>new Response(JSON.stringify({code:'GATEWAY_ERROR',message:'private platform detail'}),{status,headers:{'content-type':'application/json'}})},
      })
      await assert.rejects(()=>createGuestbookRepository(client).submit(body),new RegExp(String(status)))
    }
    assert.equal(logs.length,3)
    assert.ok(!JSON.stringify(logs).includes('test-key'))
    assert.ok(!JSON.stringify(logs).includes('private platform detail'))
  }finally{console.warn=originalWarn}
})

test('unreachable Edge Function reports a connection error separately from HTTP errors',async()=>{
  const client=createClient('https://guestbook-test.supabase.co','test-key',{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:async()=>{throw new TypeError('Failed to fetch')}},
  })
  await assert.rejects(()=>createGuestbookRepository(client).submit(body),/서버에 연결할 수 없습니다/)
})
