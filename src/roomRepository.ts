import type { SupabaseClient } from '@supabase/supabase-js'
import { roomIds, validateRoomName, type RoomRecord } from './roomModel.ts'
import { validateGalleryColor } from './galleryColors.ts'

const ROOM_COLUMNS='id,name,entrance_color,is_open,updated_at'

export function createRoomRepository(client:SupabaseClient) {
  return {
    async list():Promise<RoomRecord[]> {
      const {data,error}=await client.from('gallery_rooms').select(ROOM_COLUMNS).order('id')
      if(error)throw new Error('전시실 정보를 불러오지 못했습니다. 전시실 오픈 설정 SQL과 연결 상태를 확인해 주세요.')
      if(!data || !roomIds.every(id=>data.some(row=>row.id===id)))throw new Error('전시실 초기 설정이 필요합니다. 전시실 설정 SQL을 적용해 주세요.')
      return data as RoomRecord[]
    },
    async create(name:string,entranceColor?:string):Promise<RoomRecord> {
      const value=validateRoomName(name)
      const args={room_name:value,...(entranceColor===undefined?{}:{room_entrance_color:validateGalleryColor(entranceColor)})}
      const {data,error}=await client.rpc('create_gallery_room',args)
      if(error || !data?.length)throw new Error(error?.code==='P0001' ? error.message : '전시실을 추가하지 못했습니다. 전시실 추가 SQL 적용 여부와 운영자 권한을 확인해 주세요.')
      return data[0] as RoomRecord
    },
    async remove(room:RoomRecord):Promise<void> {
      if(!/^[D-Z]$/.test(room.id))throw new Error('기본 A·B·C 전시실은 삭제할 수 없습니다.')
      const {error}=await client.rpc('delete_gallery_room',{room_id:room.id,expected_updated_at:room.updated_at})
      if(error)throw new Error(error.code==='P0001' ? error.message : '전시실을 삭제하지 못했습니다. 전시실 추가 SQL 적용 여부와 운영자 권한을 확인해 주세요.')
    },
    async setOpen(room:RoomRecord,isOpen:boolean):Promise<RoomRecord> {
      const {data,error}=await client.from('gallery_rooms').update({is_open:isOpen}).eq('id',room.id).eq('updated_at',room.updated_at).select(ROOM_COLUMNS).single()
      if(error?.code==='PGRST116')throw new Error('다른 곳에서 전시실 설정이 변경되었습니다. 다시 불러온 뒤 설정해 주세요.')
      if(error||!data)throw new Error('오픈 여부를 저장하지 못했습니다. 전시실 오픈 설정 SQL과 운영자 권한을 확인해 주세요.')
      return data as RoomRecord
    },
    async rename(room:RoomRecord,name:string,entranceColor?:string):Promise<RoomRecord> {
      const values={name:validateRoomName(name),...(entranceColor===undefined?{}:{entrance_color:validateGalleryColor(entranceColor)})}
      const {data,error}=await client.from('gallery_rooms').update(values).eq('id',room.id).eq('updated_at',room.updated_at).select(ROOM_COLUMNS).single()
      if(error?.code==='PGRST116')throw new Error('다른 곳에서 전시실 설정이 변경되었습니다. 다시 불러온 뒤 수정해 주세요.')
      if(error || !data)throw new Error('전시실 설정을 저장하지 못했습니다. 운영자 권한과 연결 상태를 확인해 주세요.')
      return data as RoomRecord
    },
  }
}
