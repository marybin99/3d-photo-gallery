import type { SupabaseClient } from '@supabase/supabase-js'
import { roomIds, validateRoomName, type RoomRecord } from './roomModel.ts'

export function createRoomRepository(client:SupabaseClient) {
  return {
    async list():Promise<RoomRecord[]> {
      const {data,error}=await client.from('gallery_rooms').select('id,name,updated_at').order('id')
      if(error)throw new Error('전시실 이름을 불러오지 못했습니다. 전시실 설정 SQL과 연결 상태를 확인해 주세요.')
      if(!data || !roomIds.every(id=>data.some(row=>row.id===id)))throw new Error('전시실 초기 설정이 필요합니다. 전시실 설정 SQL을 적용해 주세요.')
      return data as RoomRecord[]
    },
    async create(name:string):Promise<RoomRecord> {
      const value=validateRoomName(name)
      const {data,error}=await client.rpc('create_gallery_room',{room_name:value})
      if(error || !data?.length)throw new Error(error?.code==='P0001' ? error.message : '전시실을 추가하지 못했습니다. 전시실 추가 SQL 적용 여부와 운영자 권한을 확인해 주세요.')
      return data[0] as RoomRecord
    },
    async remove(room:RoomRecord):Promise<void> {
      if(!/^[D-Z]$/.test(room.id))throw new Error('기본 A·B·C 전시실은 삭제할 수 없습니다.')
      const {error}=await client.rpc('delete_gallery_room',{room_id:room.id,expected_updated_at:room.updated_at})
      if(error)throw new Error(error.code==='P0001' ? error.message : '전시실을 삭제하지 못했습니다. 전시실 추가 SQL 적용 여부와 운영자 권한을 확인해 주세요.')
    },
    async rename(room:RoomRecord,name:string):Promise<RoomRecord> {
      const value=validateRoomName(name)
      const {data,error}=await client.from('gallery_rooms').update({name:value}).eq('id',room.id).eq('updated_at',room.updated_at).select('id,name,updated_at').single()
      if(error?.code==='PGRST116')throw new Error('다른 곳에서 전시실 이름이 변경되었습니다. 새로고침 후 다시 수정해 주세요.')
      if(error || !data)throw new Error('전시실 이름을 저장하지 못했습니다. 운영자 권한과 연결 상태를 확인해 주세요.')
      return data as RoomRecord
    },
  }
}
