export const roomIds = ['A', 'B', 'C'] as const;
export type RoomId = string;
export type RoomNames = Record<string, string>;
export type RoomRecord = {
  id: RoomId;
  name: string;
  entrance_color?: string;
  sign_text_color?: string;
  is_open: boolean;
  updated_at: string;
};
export const defaultRoomNames: RoomNames = {
  A: 'A 전시실',
  B: 'B 전시실',
  C: 'C 전시실',
};
export function roomName(id: string, names: RoomNames = defaultRoomNames) {
  return (
    names[id] ??
    (id === 'LOBBY' ? '로비' : id === 'CORRIDOR' ? '연결 통로' : `${id} 전시실`)
  );
}
export function validateRoomName(name: string) {
  const value = name.trim();
  if (
    !value ||
    Array.from(value).length > 24 ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    throw new Error('전시실 이름은 줄바꿈 없이 1~24자로 입력해 주세요.');
  return value;
}
export function namesFromRecords(records: RoomRecord[]): RoomNames {
  const names = { ...defaultRoomNames };
  for (const record of records) {
    if (/^[A-Z]$/.test(record.id))
      names[record.id] = validateRoomName(record.name);
  }
  return names;
}
export function mapNameLines(name: string) {
  const characters = Array.from(name);
  return Array.from({ length: Math.ceil(characters.length / 8) }, (_, index) =>
    characters.slice(index * 8, index * 8 + 8).join(''),
  );
}

export function allRoomIds(records: RoomRecord[]) {
  return [
    ...new Set([...roomIds, ...records.map((record) => record.id)]),
  ].sort();
}

export function openRoomIds(records: RoomRecord[]) {
  return records
    .filter((record) => record.is_open === true)
    .map((record) => record.id);
}
