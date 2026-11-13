import React, { Suspense, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import Gallery, { SPAWN, type Pose } from './Gallery'
import { type Artwork } from './data'
import { demoRead, demoWrite, supabase, type GuestbookEntry } from './supabase'
import './styles.css'

function MiniMap({pose}:{pose:Pose}) {
  const x=18+(pose.x+8.5)/17*164
  const y=12+(pose.z+6)/12*112
  return <div className="minimap" aria-label="미니맵: 전시관 내 현재 위치">
    <div className="minimap-heading"><span>GALLERY MAP</span><span className="live-dot"/></div>
    <svg viewBox="0 0 200 150" role="img" aria-label="전시관 평면도와 캐릭터 위치"><rect x="18" y="12" width="164" height="112" rx="3" fill="#eae5da" stroke="#9e9384" strokeWidth="3"/>
      <path d="M18 124H73 M127 124H182" stroke="#9e9384" strokeWidth="4"/>
      <path d="M38 28H68 M86 28H116 M134 28H164" stroke="#a58b6f" strokeWidth="5"/>
      <text x="45" y="55" fill="#887e72" fontSize="10">A</text><text x="96" y="55" fill="#887e72" fontSize="10">B</text><text x="153" y="55" fill="#887e72" fontSize="10">C</text>
      <g transform={`translate(${x} ${y}) rotate(${-pose.yaw*180/Math.PI})`}><circle r="7" fill="#7e637d" stroke="white" strokeWidth="2"/><path d="M0 -12L-4 -4L4 -4Z" fill="#7e637d"/></g>
      <text x="100" y="144" textAnchor="middle" fontSize="9" fill="#80766b">YOU ARE HERE</text>
    </svg>
  </div>
}
function Guestbook({onClose}:{onClose:()=>void}) {
  const [items,setItems]=useState<GuestbookEntry[]>([])
  const [name,setName]=useState('')
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  useEffect(()=>{let canceled=false;async function load(){if(supabase){const {data,error}=await supabase.from('guestbook_entries').select('id,nickname,message,created_at').eq('is_visible',true).order('created_at',{ascending:false}).limit(50);if(!canceled){if(error)setError('방명록을 불러오지 못했습니다.');else setItems(data??[])}}else setItems(demoRead())}void load();return()=>{canceled=true}},[])
  async function submit(e:React.FormEvent){e.preventDefault();const nick=name.trim(),text=message.trim();if(!nick||!text||busy)return;setBusy(true);setError('');try{
    if(supabase){const {error}=await supabase.from('guestbook_entries').insert({nickname:nick,message:text});if(error)throw error;const {data}=await supabase.from('guestbook_entries').select('id,nickname,message,created_at').eq('is_visible',true).order('created_at',{ascending:false}).limit(50);setItems(data??[])}
    else setItems([demoWrite(nick,text),...items]);setName('');setMessage('')
  }catch{setError('등록에 실패했습니다. 잠시 후 다시 시도해 주세요.')}finally{setBusy(false)}}
  return <div className="overlay" onMouseDown={onClose}><section className="panel guestbook" onMouseDown={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label="방명록">
    <button className="close" onClick={onClose} aria-label="닫기">×</button><span className="eyebrow">LEAVE A NOTE</span><h2>방명록</h2><p className="muted">이 공간에 머물렀던 작은 흔적을 남겨주세요.</p>
    {!supabase&&<p className="demo-notice">시제품 모드 · 작성한 글은 현재 브라우저에만 저장됩니다.</p>}
    <form onSubmit={submit}><label>이름 또는 별명<input value={name} onChange={e=>setName(e.target.value)} maxLength={24} placeholder="당신의 이름" required/></label><label>남기고 싶은 말<textarea value={message} onChange={e=>setMessage(e.target.value)} maxLength={280} placeholder="전시를 보고 느낀 점을 적어주세요." rows={3} required/></label><button className="primary" disabled={busy} type="submit">{busy?'등록 중…':'방명록 남기기'}</button></form>
    {error&&<p role="alert" className="error">{error}</p>}
    <div className="notes">{items.length===0?<p className="muted">첫 번째 방문의 흔적을 남겨보세요.</p>:items.map(item=><article className="note" key={item.id}><div><b>{item.nickname}</b><time>{new Date(item.created_at).toLocaleDateString('ko-KR')}</time></div><p>{item.message}</p></article>)}</div>
  </section></div>
}
function App(){
  const [entered,setEntered]=useState(false)
  const [pose,setPose]=useState<Pose>({...SPAWN})
  const poseRef=useRef<Pose>({...SPAWN})
  const mobileInput=useRef({forward:0,turn:0})
  const [selected,setSelected]=useState<Artwork|null>(null)
  const [guestbook,setGuestbook]=useState(false)
  const [showGuide,setShowGuide]=useState(true)
  const [minimap,setMinimap]=useState(true)
  const paused = selected !== null || guestbook
  useEffect(()=>{
    mobileInput.current={forward:0,turn:0}
    const close=(event:KeyboardEvent)=>{if(event.key==='Escape'){setSelected(null);setGuestbook(false)}}
    window.addEventListener('keydown',close)
    return()=>window.removeEventListener('keydown',close)
  },[paused,entered])
  const reset=()=>{poseRef.current={...SPAWN};setPose({...SPAWN})}
  const move=(key:'forward'|'turn',value:number)=>{mobileInput.current[key]=value}
  useEffect(()=>{const stop=()=>{mobileInput.current={forward:0,turn:0}};window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',stop);window.addEventListener('blur',stop);document.addEventListener('visibilitychange',stop);return()=>{window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop);window.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',stop)}},[])
  return <main>
    {!entered?<div className="landing"><div className="landing-inner"><span className="eyebrow">AN ONLINE PHOTOGRAPHY EXHIBITION</span><h1>THE QUIET<br/><em>ROOM</em></h1><div className="hairline"/><p>사진을 따라 걷다 보면,<br/>우리가 지나온 계절을 다시 만날지도 몰라요.</p><button className="enter" onClick={()=>setEntered(true)}>전시 입장하기 <span>↗</span></button><span className="landing-meta">12 ARTWORKS · 3 ROOMS · OPEN TO EVERYONE</span></div></div>:
    <div className="gallery-view">
      <Canvas shadows dpr={[1,1.7]} camera={{position:[0,3,9],fov:64}}><Suspense fallback={null}><Gallery onSelect={setSelected} pose={poseRef} onPose={setPose} mobileInput={mobileInput} paused={paused}/></Suspense></Canvas>
      <div className="top-left"><div className="brand">THE QUIET ROOM <small>ONLINE EXHIBITION</small></div><button className="text-btn" onClick={()=>setGuestbook(true)}>✎ 방명록 남기기</button></div>
      {minimap&&<MiniMap pose={pose}/>}
      <button className="map-toggle" onClick={()=>setMinimap(v=>!v)}>{minimap?'지도 숨기기':'미니맵 보기'}</button>
      <div className="bottom-left"><button onClick={reset}>⌂ 입구로 이동</button><button onClick={()=>setShowGuide(v=>!v)}>ⓘ 조작 안내</button><button onClick={()=>setEntered(false)}>나가기</button></div>
      {showGuide&&<div className="guide"><button onClick={()=>setShowGuide(false)} aria-label="안내 닫기">×</button><b>전시관 이용 안내</b><p>W / S 앞으로 · 뒤로 이동<br/>A / D 방향 전환<br/>사진 클릭하여 크게 보기</p><span>모바일은 아래 조작 버튼을 사용하세요.</span></div>}
      <div className="mobile-controls"><button onPointerDown={e=>{e.preventDefault();move('turn',1)}} onPointerUp={()=>move('turn',0)} aria-label="왼쪽으로 회전">↶</button><div><button onPointerDown={e=>{e.preventDefault();move('forward',1)}} onPointerUp={()=>move('forward',0)} aria-label="앞으로 이동">↑</button><button onPointerDown={e=>{e.preventDefault();move('forward',-1)}} onPointerUp={()=>move('forward',0)} aria-label="뒤로 이동">↓</button></div><button onPointerDown={e=>{e.preventDefault();move('turn',-1)}} onPointerUp={()=>move('turn',0)} aria-label="오른쪽으로 회전">↷</button></div>
      {selected&&<div className="overlay" onMouseDown={()=>setSelected(null)}><section className="panel art-detail" onMouseDown={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label={selected.title}><button className="close" onClick={()=>setSelected(null)} aria-label="닫기">×</button><img src={selected.image} alt={selected.title}/><span className="eyebrow">ARTWORK {selected.id} / ZONE {selected.zone}</span><h2>{selected.title}</h2><p>{selected.description}</p></section></div>}
      {guestbook&&<Guestbook onClose={()=>setGuestbook(false)}/>}
    </div>}
  </main>
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>)
