import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshPhysicalMaterial,
  RedFormat,
  RepeatWrapping,
} from 'three';

const size = 128;
const fibers = new Uint8Array(size * size);
let seed = 211;
for (let i = 0; i < fibers.length; i++) {
  seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
  fibers[i] = 80 + (seed >>> 25);
}
function texture(pixels: Uint8Array, repeat: number) {
  const map = new DataTexture(pixels, size, size, RedFormat);
  map.wrapS = map.wrapT = RepeatWrapping;
  map.repeat.set(repeat, repeat);
  map.magFilter = LinearFilter;
  map.minFilter = LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return map;
}

const grain = texture(fibers, 2);
const strands = Uint8Array.from(fibers, (noise, i) => {
  const x = (i % size) / size * Math.PI * 2;
  const y = Math.floor(i / size) / size * Math.PI * 2;
  const drift = .52 * Math.sin(y);
  return 112 + .34 * (noise - 112)
    + 13 * Math.sin(x * 21 + drift)
    + 7 * Math.sin(x * 33 - drift * .72)
    + 5 * Math.sin(x * 49 + drift * 1.3);
});

const hair = new MeshPhysicalMaterial({
  color: '#6e4942',
  roughness: .79,
  specularIntensity: .35,
  sheen: .47,
  sheenColor: '#bd8a7c',
  sheenRoughness: .88,
  anisotropy: .26,
  anisotropyRotation: Math.PI / 2,
  bumpMap: texture(strands, 1),
  bumpScale: .0032,
});

function matte(color: string, sheenColor: string, sheen: number, bumpScale = 0.001) {
  return new MeshPhysicalMaterial({
    color,
    roughness: .88,
    specularIntensity: .24,
    bumpMap: grain,
    bumpScale,
    sheen,
    sheenColor,
    sheenRoughness: .92,
  });
}

export const plush = {
  skin: matte('#ffc5ab', '#ffe5d4', .2, .00035),
  ear: matte('#f5b49e', '#ffe5d4', .19, .00035),
  blush: matte('#ed9686', '#fbccb5', .15, .00025),
  eyes: matte('#2e2424', '#887273', .05, 0),
  hair,
  hoodie: matte('#f3d5c2', '#fff2e2', .43, .0018),
  trim: matte('#edcbb6', '#ffeddd', .4, .0018),
  cords: matte('#f8ded0', '#fff4e9', .4, .0013),
  shorts: matte('#423838', '#97847f', .31, .0016),
  shortsHem: matte('#4c4141', '#97847f', .3, .0016),
  shoes: matte('#f2d2c0', '#fff0e3', .39, .0014),
};
