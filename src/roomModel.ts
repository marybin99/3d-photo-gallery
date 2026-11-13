export const roomIds = ['A', 'B', 'C'] as const
export type RoomId = typeof roomIds[number]
export type RoomNames = Record<RoomId, string>
export type RoomRecord = {id:RoomId;name:string;updated_at:string}
export const defaultRoomNames:RoomNames = {A:'A 전시실',B:'B 전시실',C:'C 전시실'}
export function roomName(id:string,names:RoomNames=defaultRoomNames) {
  return roomIds.includes(id as RoomId)?names[id as RoomId]:id==='LOBBY'?'로비':`${id} 전시실`
}
export function validateRoomName(name:string) {
  const value=name.trim()
  if(!value || Array.from(value).length>24 || /[\u0000-\u001f\u007f]/.test(value))throw new Error('전시실 이름은 줄바꿈 없이 1~24자로 입력해 주세요.')
  return value
}
export function namesFromRecords(records:RoomRecord[]):RoomNames {
  const names={...defaultRoomNames}
  for(const record of records){
    if(roomIds.includes(record.id))names[record.id]=validateRoomName(record.name)
  }
  return names
}
export function mapNameLines(name:string) {
  const characters=Array.from(name)
  return Array.from({length:Math.ceil(characters.length/8)},(_,index)=>characters.slice(index*8,index*8+8).join(''))
}
