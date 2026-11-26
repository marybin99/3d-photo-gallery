import { DataTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';

const HEART_LAYERS = [
  {
    color: '#efa900',
    path: 'M82.5 56 C89.8 43 97.6 35.6 110.9 35.6 C129.5 35.6 140.2 46.7 139.7 66 C138.9 89.5 117.5 111 82.8 139.5 C52.7 115.6 28 94.4 26.5 68.6 C25.2 49.9 35.7 35.6 54.2 35.6 C67.8 35.6 76.4 43.2 82.5 56 Z',
  },
  {
    color: '#ffcc32',
    path: 'M80.8 64 C87.7 48.9 94.4 38.5 106.4 38.4 C121.9 38.4 132.3 49.3 131.3 66.9 C130 89.9 110.5 111.9 82.7 138.3 C52.7 114.3 28.8 92.7 27.4 68.5 C26.3 52.5 35.2 38.5 51.9 38.5 C66.1 38.5 74 47.4 80.8 64 Z',
  },
  {
    color: '#fff383',
    path: 'M35.3 61.4 C35.1 51.5 40.6 45 48.4 44.8 C54.7 44.6 57.5 49.1 54.3 53.5 C51.5 57.4 44.2 59 41.8 69 C41.1 72 41 75 39.2 74.2 C36.9 73.3 35.5 66.6 35.3 61.4 Z M93 57.3 C93.3 51.3 98.9 44.5 104.6 44.2 C108.9 44 111.5 47.6 110.1 51.6 C108.5 56 102.5 58.1 96.2 59.4 C93.9 59.9 92.8 59.2 93 57.3 Z',
  },
];

export function createFoxHeartTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not draw the fox heart');

  context.translate(-19, -24);
  for (const { color, path } of HEART_LAYERS) {
    context.fillStyle = color;
    context.fill(new Path2D(path));
  }

  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  // Filter the gold rim against transparent gold so scaling cannot introduce a dark fringe.
  for (let pixel = 0; pixel < data.length; pixel += 4) {
    if (data[pixel + 3] !== 0) continue;
    data[pixel] = 239;
    data[pixel + 1] = 169;
    data[pixel + 2] = 0;
  }
  const texture = new DataTexture(new Uint8Array(data), width, height);
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = true;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
