import { imageSize, validateImageFile } from './artworkModel';

export async function prepareArtworkImage(file: File): Promise<Blob> {
  validateImageFile(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error('이미지를 읽을 수 없습니다. 다른 사진을 선택해 주세요.');
    }
    const size = imageSize(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context)
      throw new Error('이 브라우저에서는 사진을 처리할 수 없습니다.');
    context.drawImage(image, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.86),
    );
    if (!blob)
      throw new Error('사진 변환에 실패했습니다. 다른 사진을 선택해 주세요.');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
