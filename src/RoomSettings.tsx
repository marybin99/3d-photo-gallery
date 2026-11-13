import { useEffect, useState, type FormEvent } from 'react'
import type { RoomRecord } from './roomModel'
import type { useRoomNames } from './useRoomNames'

export default function RoomSettings({rooms}:{rooms:ReturnType<typeof useRoomNames>}) {
  const [saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  async function save(record:RoomRecord,name:string) {
    setSaving(true);setError('');setNotice('')
    try{
      const next=await rooms.save(record,name)
      setNotice(`${record.id} 전시실 이름을 ‘${next.name}’으로 저장했습니다.`)
      return next
    }catch(reason){setError(reason instanceof Error?reason.message:'저장하지 못했습니다.');return null}
    finally{setSaving(false)}
  }
  return <section className="admin-card admin-room-settings" aria-label="전시실 이름 설정">
    <h2>전시실 이름</h2><p className="admin-help">전시실 입구·미니맵·현재 위치·작품 위치 선택에 표시됩니다. 액자 위치와 A/B/C 식별 코드는 유지됩니다.</p>
    {(rooms.error||error)&&<p className="admin-error" role="alert">{error||rooms.error} <button disabled={saving||rooms.loading} onClick={()=>{setError('');void rooms.reload()}}>다시 불러오기</button></p>}
    {notice&&<p className="admin-notice" role="status">{notice}</p>}
    {rooms.loading&&<p className="admin-help" role="status">전시실 정보를 불러오는 중…</p>}
    <div className="admin-room-forms">{rooms.records.map(record=><RoomNameForm key={record.id} record={record} disabled={saving||rooms.loading} save={save}/>)}</div>
  </section>
}
function RoomNameForm({record,disabled,save}:{record:RoomRecord;disabled:boolean;save:(record:RoomRecord,name:string)=>Promise<RoomRecord|null>}) {
  const [base,setBase]=useState(record),[name,setName]=useState(record.name)
  useEffect(()=>{
    // Preserve unsaved text if a different administrator updates this room.
    if(name===base.name){setBase(record);setName(record.name)}
  },[record,name,base.name])
  async function submit(event:FormEvent){
    event.preventDefault();if(disabled)return
    const next=await save(base,name)
    if(next){setBase(next);setName(next.name)}
  }
  return <form onSubmit={submit}><label>전시실 {record.id}<input value={name} onChange={event=>setName(event.target.value)} maxLength={24} required disabled={disabled}/></label><button type="submit" disabled={disabled||name===base.name}>이름 저장</button></form>
}
