import { useEffect, useState, type FormEvent } from 'react'
import DeleteConfirmDialog from './DeleteConfirmDialog'
import type { RoomRecord } from './roomModel'
import type { useRoomNames } from './useRoomNames'

export default function RoomSettings({rooms}:{rooms:ReturnType<typeof useRoomNames>}) {
  const [saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const [newName,setNewName]=useState('')
  const [deleting,setDeleting]=useState<RoomRecord|null>(null)
  async function remove() {
    if(!deleting||saving)return
    setSaving(true);setError('');setNotice('')
    try{await rooms.remove(deleting);setNotice(`‘${deleting.name}’ 전시실을 삭제했습니다.`);setDeleting(null)}
    catch(reason){setError(reason instanceof Error?reason.message:'삭제하지 못했습니다.')}
    finally{setSaving(false)}
  }
  async function create(event:FormEvent) {
    event.preventDefault();if(saving)return
    setSaving(true);setError('');setNotice('')
    try{const next=await rooms.create(newName);setNewName('');setNotice(`‘${next.name}’ 전시실과 액자 12개를 추가했습니다.`)}
    catch(reason){setError(reason instanceof Error?reason.message:'추가하지 못했습니다.')}
    finally{setSaving(false)}
  }
  async function save(record:RoomRecord,name:string) {
    setSaving(true);setError('');setNotice('')
    try{
      const next=await rooms.save(record,name)
      setNotice(`${record.id} 전시실 이름을 ‘${next.name}’으로 저장했습니다.`)
      return next
    }catch(reason){setError(reason instanceof Error?reason.message:'저장하지 못했습니다.');return null}
    finally{setSaving(false)}
  }
  return <section className="admin-card admin-room-settings" aria-label="전시실 관리">
    <h2>전시실 관리</h2><p className="admin-help">전시실 입구·미니맵·현재 위치·작품 위치 선택에 표시됩니다. 추가 전시실은 로비 뒤 연결 통로로 이어지며, 각 전시실에는 액자 12개가 제공됩니다. 작품이 없는 추가 전시실만 삭제할 수 있습니다.</p>
    {(rooms.error||error)&&<p className="admin-error" role="alert">{error||rooms.error} <button disabled={saving||rooms.loading} onClick={()=>{setError('');void rooms.reload()}}>다시 불러오기</button></p>}
    {notice&&<p className="admin-notice" role="status">{notice}</p>}
    {rooms.loading&&<p className="admin-help" role="status">전시실 정보를 불러오는 중…</p>}
    <form className="admin-room-create" onSubmit={create}>
      <label>새 전시실 이름<input value={newName} onChange={event=>setNewName(event.target.value)} maxLength={24} required disabled={saving||rooms.loading||!!rooms.error||rooms.ids.length>=26} placeholder="예: 계절의 기억"/></label>
      <button className="admin-primary" type="submit" disabled={saving||rooms.loading||!!rooms.error||!newName.trim()||rooms.ids.length>=26}>{saving?'저장 중…':'+ 전시실 추가'}</button>
    </form>
    {rooms.ids.length>=26&&<p className="admin-help">전시실은 최대 26개까지 추가할 수 있습니다.</p>}
    <div className="admin-room-forms">{rooms.records.map(record=><RoomNameForm key={record.id} record={record} disabled={saving||rooms.loading} save={save} onDelete={()=>{setError('');setNotice('');setDeleting(record)}}/>)}</div>
    {deleting&&<DeleteConfirmDialog busy={saving} error={error} onCancel={()=>{setDeleting(null);setError('')}} onConfirm={()=>void remove()}>
      ‘{deleting.name}’ 전시실과 빈 액자 12개를 삭제합니다. 등록된 작품이 있으면 먼저 다른 전시실로 이동하거나 삭제해 주세요.
    </DeleteConfirmDialog>}
  </section>
}
function RoomNameForm({record,disabled,save,onDelete}:{record:RoomRecord;disabled:boolean;save:(record:RoomRecord,name:string)=>Promise<RoomRecord|null>;onDelete:()=>void}) {
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
  return <form onSubmit={submit}><label>전시실 {record.id}<input value={name} onChange={event=>setName(event.target.value)} maxLength={24} required disabled={disabled}/></label><button type="submit" disabled={disabled||name===base.name}>이름 저장</button>{/^[D-Z]$/.test(record.id)&&<button type="button" className="admin-room-delete" disabled={disabled} onClick={onDelete}>삭제</button>}</form>
}
