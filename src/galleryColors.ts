export const DEFAULT_ENTRANCE_COLOR = '#ac9477';
export const DEFAULT_FRAME_COLOR = '#806d59';

export function validateGalleryColor(value: string) {
  if (!/^#[0-9a-f]{6}$/i.test(value) || value.length !== 7) {
    throw new Error('색상은 #RRGGBB 형식으로 입력해 주세요.');
  }
  return value.toLowerCase();
}
