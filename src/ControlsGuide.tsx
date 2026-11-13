import { useEffect, useId, useRef } from 'react'

export default function ControlsGuide({variant,onClose}:{variant:'welcome'|'compact';onClose:()=>void}) {
  const title=useId()
  const panel=useRef<HTMLElement>(null)
  const welcome=variant==='welcome'
  useEffect(()=>{
    if(!welcome)return
    panel.current?.focus({preventScroll:true})
    const trapFocus=(event:KeyboardEvent)=>{
      if(event.key!=='Tab')return
      const buttons=panel.current?.querySelectorAll<HTMLButtonElement>('button')
      if(!buttons?.length)return
      const first=buttons[0],last=buttons[buttons.length-1]
      if(document.activeElement===panel.current || !panel.current?.contains(document.activeElement)){
        event.preventDefault();(event.shiftKey?last:first).focus()
      }
      else if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus()}
    }
    document.addEventListener('keydown',trapFocus)
    return()=>document.removeEventListener('keydown',trapFocus)
  },[welcome])
  const content=<section ref={panel} tabIndex={welcome?-1:undefined} className={`controls-guide controls-guide--${variant}`} role={welcome?'dialog':'region'} aria-modal={welcome?true:undefined} aria-labelledby={title} id={welcome?'welcome-controls':'compact-controls'}>
    <button className="controls-guide-close" onClick={onClose} aria-label="조작 안내 닫기">×</button>
    <div className="controls-guide-scroll">
    {welcome&&<span className="eyebrow">WELCOME TO THE QUIET ROOM</span>}
    <h2 id={title}>전시관 이용 안내</h2>
    {welcome&&<p className="controls-guide-intro">천천히 걸으며 사진을 만나보세요.</p>}
    <div className="controls-guide-layout">
      <div className="movement-help">
        <div className="movement-keys" role="group" aria-label="방향키 또는 W A S D로 이동">
          {[
            {direction:'forward',arrow:'↑',key:'W',label:'앞으로'},
            {direction:'left',arrow:'←',key:'A',label:'왼쪽'},
            {direction:'backward',arrow:'↓',key:'S',label:'뒤로'},
            {direction:'right',arrow:'→',key:'D',label:'오른쪽'},
          ].map(item=><div className={`movement-key movement-key--${item.direction}`} key={item.key}>
            <kbd>{item.arrow}</kbd><span>{item.key}</span><small>{item.label}</small>
          </div>)}
        </div>
        <p className="movement-caption">바라보는 시야를 기준으로 이동합니다.</p>
      </div>
      <dl className="controls-guide-tips">
        <div><dt>PC 시야 회전</dt><dd>마우스 왼쪽 버튼을 누른 채 드래그</dd></div>
        <div><dt>모바일 이동 · 시야</dt><dd>우측 하단 조이스틱으로 이동<br/>다른 손가락으로 화면을 드래그해 시야 회전</dd></div>
        <div><dt>작품 · 방명록</dt><dd>사진을 클릭하면 크게 볼 수 있어요.<br/>로비의 펼쳐진 책을 누르면 방명록이 열립니다.</dd></div>
      </dl>
    </div>
    {welcome&&<><button className="primary controls-guide-confirm" onClick={onClose}>확인 · 전시 둘러보기</button><p className="controls-guide-footer">아래의 ‘조작 안내’ 버튼으로 언제든 다시 볼 수 있어요.</p></>}
    </div>
  </section>
  return welcome?<div className="overlay controls-guide-overlay">{content}</div>:content
}
