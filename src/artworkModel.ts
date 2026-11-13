import { artworks, type Artwork } from './data.ts';
import { roomName, defaultRoomNames, type RoomNames } from './roomModel.ts';

export type ArtworkRecord = {
  id: string;
  slot_id: string;
  title: string;
  description: string;
  image_path: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};
export type ArtworkDraft = {
  slot_id: string;
  title: string;
  description: string;
  is_published: boolean;
};
export const slots = artworks;
export const ARTWORK_BUCKET = 'gallery-artworks';
export const ARTWORK_COLUMNS =
  'id,slot_id,title,description,image_path,is_published,created_at,updated_at';
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 1920;
export const SIGNED_URL_SECONDS = 3600;

export function firstAvailableSlot(records: Pick<ArtworkRecord, 'slot_id'>[], zone = 'ALL') {
  const occupied = new Set(records.map(record => record.slot_id));
  return slots.find(slot => (zone === 'ALL' || slot.zone === zone) && !occupied.has(slot.id))?.id ?? '';
}

export function slotLabel(id: string, names: RoomNames = defaultRoomNames) {
  const slot = slots.find((item) => item.id === id);
  if (!slot) return '알 수 없는 전시 위치';
  const sameWall = slots.filter(
    (item) => item.zone === slot.zone && item.wall === slot.wall,
  );
  const wall = { front: '정면', left: '왼쪽', right: '오른쪽' }[slot.wall];
  return `${roomName(slot.zone,names)} · ${wall} 벽 · ${sameWall.findIndex((item) => item.id === id) + 1}번`;
}
export function fillArtworkSlots(visible: Artwork[]): Artwork[] {
  const bySlot=new Map(visible.map(art=>[art.id,art]));
  return slots.map(slot=>bySlot.get(slot.id)??{...slot,title:'',description:'',image:''});
}
export function validateDraft(draft: ArtworkDraft) {
  if (!slots.some((slot) => slot.id === draft.slot_id))
    throw new Error('전시 위치를 선택해 주세요.');
  if (!draft.title.trim() || draft.title.trim().length > 120)
    throw new Error('작품 제목은 1~120자로 입력해 주세요.');
  if (draft.description.length > 2000)
    throw new Error('작품 설명은 2,000자 이내로 입력해 주세요.');
  return {
    ...draft,
    title: draft.title.trim(),
    description: draft.description.trim(),
  };
}
export function imageSize(width: number, height: number) {
  if (width <= 0 || height <= 0 || !Number.isFinite(width + height))
    throw new Error('이미지 크기를 확인할 수 없습니다.');
  const ratio = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}
export function validateImageFile(file: Pick<File, 'type' | 'size'>) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('JPG, PNG, WebP 이미지만 등록할 수 있습니다.');
  if (file.size <= 0 || file.size > MAX_SOURCE_BYTES)
    throw new Error('이미지 파일은 10MB 이하로 선택해 주세요.');
}
export function recordToArtwork(record: ArtworkRecord, image: string): Artwork {
  const slot = slots.find((item) => item.id === record.slot_id);
  if (!slot) throw new Error('지원하지 않는 전시 위치입니다.');
  return {
    ...slot,
    title: record.title,
    description: record.description,
    image,
  };
}
