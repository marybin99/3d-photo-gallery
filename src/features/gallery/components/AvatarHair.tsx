import {
  BufferGeometry,
  CatmullRomCurve3,
  Float32BufferAttribute,
  Vector3,
} from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import type { Hairstyle } from '../avatar';
import { plush } from './avatarMaterials';

type Point = [number, number, number];
type Lock = {
  path: Point[];
  width: number;
  depth: number;
  heading?: number;
  pointed?: boolean;
  blend?: number;
  fullLength?: boolean;
};
type Style = {
  nape: number;
  part?: boolean;
  fringe?: number;
  foreheadDepth?: number;
  crownRadius?: number;
  ridges: number;
  relief: number;
  blend: number;
  locks: Lock[];
};

function lock(width: number, depth: number, ...path: Point[]): Lock {
  return { path, width, depth };
}

function mirror(locks: Lock[]): Lock[] {
  return locks.map(({ path, ...shape }) => ({
    ...shape,
    heading: shape.heading === undefined ? undefined : -shape.heading,
    path: path.map(([x, y, z]) => [-x, y, z]),
  }));
}

const temple = [
  lock(.115, .091, [.278, 1.794, -.147], [.444, 1.638, -.226], [.479, 1.465, -.235], [.433, 1.263, -.264]),
];

const softBangs = [
  { ...lock(.118, .089, [.005, 1.916, -.114], [.139, 1.812, -.289], [.218, 1.652, -.417], [.297, 1.517, -.443], [.391, 1.445, -.374]), blend: .025 },
  { ...lock(.088, .09, [-.037, 1.9, -.159], [-.103, 1.758, -.375], [-.095, 1.608, -.47], [-.052, 1.526, -.473], [.021, 1.548, -.447]), blend: .022 },
  { ...lock(.073, .071, [-.085, 1.905, -.099], [-.176, 1.782, -.329], [-.182, 1.615, -.438], [-.134, 1.523, -.46], [-.081, 1.544, -.446]), blend: .021 },
  lock(.098, .084, [-.146, 1.885, -.055], [-.287, 1.77, -.268], [-.379, 1.6, -.377], [-.414, 1.453, -.338], [-.399, 1.382, -.316]),
];

const bobSide = [
  lock(.115, .111, [.242, 1.838, .119], [.405, 1.675, .099], [.495, 1.471, -.005], [.523, 1.26, .013], [.477, 1.095, -.056], [.364, 1.087, -.167]),
  { ...lock(.088, .082, [.263, 1.793, -.042], [.39, 1.62, -.238], [.415, 1.44, -.298], [.398, 1.254, -.327], [.367, 1.145, -.313], [.313, 1.159, -.283]), pointed: true },
  lock(.133, .114, [.299, 1.804, .241], [.464, 1.584, .181], [.532, 1.31, .083], [.487, 1.12, .081], [.36, 1.063, .045]),
];

const centerPartSide = [
  { ...lock(.112, .101, [.037, 1.909, -.139], [.15, 1.811, -.327], [.173, 1.645, -.444], [.284, 1.503, -.455], [.466, 1.411, -.371]), blend: .025 },
  { ...lock(.099, .089, [.063, 1.936, -.059], [.246, 1.829, -.264], [.328, 1.693, -.388], [.423, 1.577, -.389], [.526, 1.507, -.301]), blend: .023 },
  { ...lock(.087, .084, [.147, 1.916, .023], [.326, 1.791, -.145], [.441, 1.648, -.253], [.523, 1.533, -.267], [.543, 1.455, -.207]), blend: .026 },
];
const centerPart = [...centerPartSide, ...mirror(centerPartSide)];

const flippedSide = [
  { ...lock(.105, .095, [.304, 1.739, .153], [.455, 1.533, .043], [.493, 1.326, -.018], [.48, 1.151, -.118], [.547, 1.076, -.177], [.618, 1.125, -.176], [.648, 1.212, -.148]), blend: .023 },
  { ...lock(.106, .104, [.363, 1.68, .241], [.476, 1.48, .192], [.476, 1.252, .119], [.449, 1.119, .048], [.508, 1.049, -.012], [.584, 1.117, -.053]), blend: .026 },
  lock(.116, .101, [.32, 1.632, .312], [.403, 1.393, .273], [.401, 1.167, .21], [.421, 1.051, .135], [.495, 1.025, .109]),
  { ...lock(.063, .063, [.356, 1.604, -.276], [.416, 1.489, -.352], [.404, 1.356, -.353], [.367, 1.287, -.317]), blend: .023, pointed: true },
];

const bunLocks = [
  lock(.132, .139, [-.229, 1.907, .165], [-.178, 2.052, .177], [-.058, 2.109, .189], [.097, 2.085, .19], [.194, 1.959, .164]),
  lock(.122, .112, [.204, 1.93, .112], [.16, 2.064, .105], [.048, 2.108, .082], [-.053, 2.071, .059], [-.137, 1.967, .073]),
  { ...lock(.084, .079, [-.19, 1.968, .101], [-.153, 2.041, .039], [-.077, 2.055, .014], [-.011, 1.995, .047], [.05, 1.936, .086]), blend: .021 },
];
const bunTendrils = [
  { ...lock(.075, .074, [.286, 1.752, -.24], [.415, 1.566, -.319], [.453, 1.399, -.321], [.417, 1.276, -.327], [.373, 1.198, -.317]), blend: .023 },
  { ...lock(.052, .05, [.438, 1.444, -.316], [.42, 1.303, -.328], [.374, 1.207, -.33], [.391, 1.131, -.316], [.428, 1.084, -.294], [.397, 1.022, -.279]), pointed: true, blend: .022 },
  { ...lock(.063, .062, [-.316, 1.702, -.199], [-.447, 1.513, -.268], [-.465, 1.349, -.286], [-.417, 1.215, -.309], [-.391, 1.138, -.322], [-.441, 1.07, -.292]), pointed: true, blend: .023 },
];

const braidSide: Lock[] = [
  lock(.106, .104, [.327, 1.562, .212], [.441, 1.338, .131], [.478, 1.155, .079]),
  // Cross the three paths with alternating depth, from the ear to the tie.
  ...Array.from({ length: 3 }, (_, strand): Lock => ({
    blend: .012,
    width: .059,
    depth: .051,
    fullLength: true,
    path: Array.from({ length: 25 }, (_, j): Point => {
      const progress = j / 24;
      const phase = (1.52 * progress + strand / 3) * Math.PI * 2;
      const amplitude = 1 - .56 * progress ** 2;
      return [
        .474 + .022 * progress + .028 * Math.sin(Math.PI * progress) + Math.sin(phase) * .069 * amplitude,
        1.209 - .5 * progress,
        .101 - .178 * progress + Math.cos(phase) * .066 * amplitude,
      ];
    }),
  })),
  { ...lock(.068, .062, [.494, .745, -.084], [.525, .671, -.103], [.506, .609, -.121], [.475, .59, -.12]), blend: .022 },
];

const longSide = [
  { ...lock(.108, .111, [.357, 1.747, -.1], [.486, 1.534, -.122], [.528, 1.344, .048], [.512, 1.244, .092], [.48, 1.156, .057], [.491, 1.034, -.117], [.541, .954, -.18], [.627, .813, -.227], [.586, .656, -.219], [.493, .56, -.194]), blend: .028 },
  { ...lock(.111, .103, [.346, 1.762, .125], [.487, 1.559, .068], [.557, 1.328, .129], [.523, 1.143, .095], [.582, .96, -.018], [.648, .787, -.061], [.605, .629, -.116], [.522, .576, -.141]), blend: .026 },
  lock(.129, .126, [.377, 1.689, .271], [.505, 1.463, .215], [.506, 1.235, .183], [.47, 1.064, .184], [.511, .91, .168], [.537, .751, .148], [.476, .604, .086], [.412, .566, .048]),
  { ...lock(.064, .065, [.344, 1.647, -.332], [.409, 1.522, -.372], [.411, 1.407, -.355], [.365, 1.312, -.364], [.31, 1.227, -.326]), pointed: true, blend: .023 },
];

function radialLock(heading: number, width: number, depth: number, ...profile: [number, number, number][]): Lock {
  return {
    width,
    depth,
    heading,
    path: profile.map(([y, radius, turn]) => {
      const angle = heading + turn;
      return [Math.sin(angle) * radius * 1.16, y, .036 + Math.cos(angle) * radius];
    }),
  };
}

const backCurls = [
  ...Array.from({ length: 8 }, (_, i) =>
    radialLock((i - 3.5) * .385, .127, .086, [1.852, .225, -.24], [1.669 + (i % 2) * .062, .41, -.14], [1.489, .461, .008], [1.274, .399, .12]),
  ),
  ...Array.from({ length: 7 }, (_, i) =>
    radialLock((i - 3) * .41, .103, .072, [1.506, .408, -.09], [1.325, .439, .025], [1.166, .355, .12], [1.032, .235, .17]),
  ),
];
// The classic cut sweeps over the ears into rounded, staggered locks.
const classicBack: Lock[] = [
  radialLock(-1.39, .132, .108, [1.843, .229, .27], [1.676, .42, .126], [1.484, .486, .01], [1.359, .401, -.12]),
  radialLock(-.91, .132, .103, [1.917, .113, .21], [1.774, .352, .12], [1.568, .482, .02], [1.405, .448, -.094], [1.33, .373, -.128]),
  radialLock(-.42, .145, .113, [1.924, .111, .23], [1.766, .369, .11], [1.543, .495, .028], [1.42, .487, -.051], [1.32, .383, -.102]),
  radialLock(.115, .141, .112, [1.919, .103, -.19], [1.782, .342, -.11], [1.574, .488, .003], [1.444, .488, .056], [1.346, .384, .091]),
  radialLock(.64, .133, .106, [1.903, .156, -.2], [1.753, .376, -.114], [1.571, .492, -.025], [1.447, .467, .031], [1.346, .376, .106]),
  radialLock(1.15, .142, .102, [1.863, .213, -.24], [1.696, .417, -.137], [1.513, .484, .01], [1.402, .442, .121], [1.338, .378, .125]),
  radialLock(1.56, .113, .095, [1.781, .314, -.25], [1.592, .461, -.167], [1.474, .48, -.017], [1.365, .423, .112]),
  ...[-1.39, -.87, -.36, .14, .67, 1.19].map((heading, index) =>
    radialLock(heading, .111, .073, [1.519, .404, -.09], [1.351, .445, -.03], [1.208 + (index % 2) * .031, .378, .08], [1.046, .251, .15]),
  ),
].map((sweep, index) => ({ ...sweep, blend: index < 7 ? .024 : .038 }));

const downcutFringe = [
  { ...lock(.114, .09, [.037, 1.912, -.13], [.124, 1.834, -.302], [.158, 1.674, -.424], [.218, 1.49, -.445], [.322, 1.392, -.391]), blend: .026 },
  { ...lock(.11, .091, [.014, 1.93, -.063], [.208, 1.871, -.258], [.319, 1.749, -.379], [.377, 1.572, -.403], [.43, 1.445, -.313]), blend: .02 },
  { ...lock(.106, .086, [.111, 1.902, .025], [.303, 1.814, -.176], [.443, 1.655, -.282], [.507, 1.509, -.259], [.49, 1.429, -.204]), blend: .023 },
];
const downcutBack = Array.from({ length: 8 }, (_, i) => {
  const heading = (i - 3.5) * .36;
  const turn = Math.sign(heading);
  return radialLock(heading, .098, .075, [1.919, .094, -.21 * turn], [1.791, .315, -.13 * turn], [1.532, .442, .069 * turn], [1.306, .417, .135 * turn], [1.104, .268, .15 * turn]);
});

const curlyFringe = [
  lock(.116, .092, [.341, 1.693, -.219], [.455, 1.622, -.276], [.485, 1.52, -.236], [.446, 1.392, -.27], [.404, 1.355, -.26]),
  lock(.126, .106, [.204, 1.714, -.316], [.302, 1.662, -.423], [.331, 1.548, -.442], [.265, 1.444, -.462], [.174, 1.49, -.446]),
  lock(.097, .091, [.002, 1.815, -.303], [.101, 1.737, -.441], [.094, 1.648, -.476], [.038, 1.578, -.473]),
  lock(.115, .109, [-.1, 1.798, -.274], [-.152, 1.669, -.406], [-.124, 1.548, -.473], [-.034, 1.468, -.508], [.058, 1.517, -.462]),
  lock(.108, .092, [-.245, 1.753, -.201], [-.322, 1.638, -.332], [-.322, 1.518, -.402], [-.271, 1.464, -.413], [-.217, 1.504, -.393]),
  lock(.101, .093, [-.378, 1.728, -.083], [-.473, 1.627, -.202], [-.493, 1.504, -.251], [-.432, 1.401, -.266]),
  lock(.083, .084, [.046, 1.773, -.282], [.044, 1.673, -.411], [.04, 1.6, -.453]),
].map((curl) => ({ ...curl, blend: .019 }));

// Compact rolls sit in front of the crown and cover the roots of the fringe.
const curlyCrown = [
  lock(.103, .092, [.015, 1.89, .045], [.155, 1.936, -.065], [.234, 1.884, -.153]),
  lock(.1, .098, [-.077, 1.906, .053], [-.192, 1.929, -.075], [-.268, 1.861, -.171]),
  lock(.103, .086, [.14, 1.813, -.366], [.073, 1.849, -.461], [-.004, 1.82, -.483], [-.094, 1.793, -.432]),
  lock(.103, .091, [.161, 1.811, -.282], [.23, 1.758, -.397], [.357, 1.717, -.368]),
  lock(.087, .077, [.303, 1.811, -.151], [.383, 1.76, -.281], [.461, 1.786, -.261], [.477, 1.827, -.206]),
  lock(.093, .091, [-.125, 1.851, -.178], [-.24, 1.789, -.312], [-.317, 1.673, -.345]),
].map((curl) => ({ ...curl, blend: .021 }));

const mohawkFringe = [
  lock(.094, .077, [-.158, 1.824, -.25], [-.015, 1.801, -.394], [.154, 1.734, -.445], [.347, 1.673, -.388], [.491, 1.691, -.281]),
  lock(.104, .092, [-.145, 1.806, -.269], [-.044, 1.724, -.417], [.079, 1.617, -.468], [.227, 1.535, -.434], [.337, 1.553, -.372]),
  lock(.092, .084, [-.121, 1.803, -.241], [-.095, 1.711, -.391], [-.068, 1.588, -.466], [.014, 1.488, -.456], [.089, 1.464, -.419]),
  lock(.097, .082, [-.164, 1.836, -.151], [-.263, 1.747, -.314], [-.29, 1.617, -.378], [-.268, 1.507, -.392]),
  lock(.096, .082, [-.284, 1.803, -.102], [-.39, 1.693, -.238], [-.44, 1.567, -.287], [-.419, 1.409, -.268]),
  lock(.108, .088, [.246, 1.766, -.096], [.389, 1.629, -.262], [.443, 1.497, -.285], [.408, 1.338, -.268]),
].map((sweep) => ({ ...sweep, blend: .024 }));

const mohawkCrown = [
  lock(.075, .067, [-.182, 1.808, -.152], [-.034, 1.883, -.195], [.157, 1.864, -.251], [.354, 1.789, -.305], [.509, 1.768, -.274], [.577, 1.805, -.23]),
  lock(.078, .07, [-.122, 1.871, -.073], [.037, 1.931, -.141], [.195, 1.913, -.196], [.332, 1.894, -.162], [.411, 1.922, -.134], [.435, 1.979, -.102]),
  lock(.068, .065, [-.076, 1.897, .042], [.032, 1.954, .009], [.186, 1.963, -.022], [.258, 2.02, -.03]),
  lock(.082, .079, [-.137, 1.891, .026], [-.096, 1.963, -.067], [-.126, 2.028, -.067], [-.221, 2.093, -.056]),
  lock(.059, .065, [-.266, 1.845, -.005], [-.314, 1.913, -.078], [-.398, 1.933, -.079], [-.446, 1.987, -.059]),
].map((spike) => ({ ...spike, blend: .026, pointed: true }));

const shaggyFringe = [
  { ...lock(.123, .096, [.027, 1.911, -.123], [.119, 1.819, -.313], [.16, 1.644, -.429], [.26, 1.491, -.459], [.382, 1.425, -.395], [.503, 1.418, -.292]), blend: .025 },
  { ...lock(.109, .096, [.067, 1.91, -.034], [.254, 1.842, -.247], [.334, 1.72, -.375], [.434, 1.586, -.409], [.53, 1.527, -.317], [.62, 1.554, -.224]), blend: .02 },
  { ...lock(.09, .09, [.17, 1.867, .037], [.355, 1.774, -.147], [.456, 1.655, -.273], [.529, 1.606, -.244], [.603, 1.68, -.172]), blend: .022 },
  lock(.073, .071, [.047, 1.854, -.236], [.087, 1.736, -.376], [.111, 1.573, -.436], [.162, 1.464, -.451], [.218, 1.44, -.452]),
];
const shaggySides = [
  lock(.101, .104, [.363, 1.718, .183], [.477, 1.55, .081], [.494, 1.357, -.002], [.47, 1.237, -.098], [.498, 1.197, -.128], [.558, 1.255, -.151]),
  lock(.113, .09, [.365, 1.673, .251], [.454, 1.461, .196], [.45, 1.275, .134], [.414, 1.146, .05], [.471, 1.096, .013], [.514, 1.136, -.044]),
];
const shaggyBack = Array.from({ length: 7 }, (_, i) => {
  const heading = (i - 3) * .44;
  const turn = i % 2 === 0 ? 1 : -1;
  return radialLock(heading, .113, .081, [1.901, .131, -.14], [1.707, .37, -.071], [1.478, .46, .09 * turn], [1.229, .412, -.072 * turn], [1.078 + i % 3 * .023, .349, .123 * turn], [1.058, .274, .15 * turn]);
});

const backBob = Array.from({ length: 9 }, (_, i) => {
  const heading = (i - 4) * .36;
  return radialLock(heading, .112, .075, [1.928, .086, -.11], [1.77, .32, -.064], [1.511, .43, -.023], [1.254, .432, .043], [1.095 + (i % 2) * .019, .36, .061], [1.035, .263, .076]);
});
const backLob = Array.from({ length: 8 }, (_, i) => {
  const heading = (i - 3.5) * .365;
  const bend = Math.sign(heading);
  return radialLock(heading, .109, .082, [1.914, .095, -.175 * bend], [1.655, .376, -.073 * bend], [1.398, .44, .022 * bend], [1.174, .419, .09 * bend], [1.029, .354, .105 * bend], [1.048, .316, .179 * bend]);
});
const backBun = Array.from({ length: 9 }, (_, i) => {
  const heading = (i - 4) * .34;
  const bend = Math.sign(heading);
  return radialLock(heading, .098, .081, [1.94, .142, -.48 * bend], [1.79, .314, -.205 * bend], [1.557, .423, -.026 * bend], [1.313, .413, .069 * bend], [1.15, .312, .095 * bend]);
});
const backLong = Array.from({ length: 8 }, (_, i) => {
  const heading = (i - 3.5) * .343;
  const bend = Math.sign(heading);
  return radialLock(heading, .128, .103, [1.908, .112, -.14 * bend], [1.657, .41, -.127 * bend], [1.349, .467, .061 * bend], [1.106, .417, .096 * bend], [.902, .449, -.052 * bend], [.693, .443, -.032 * bend], [.535 + i % 3 * .026, .308, .082 * bend]);
});

const styles: Record<Hairstyle, Style> = {
  classic: {
    nape: 2.58,
    fringe: 1.34,
    foreheadDepth: .521,
    ridges: 8,
    relief: .017,
    blend: .039,
    locks: [
      ...classicBack,
      // The crown has one small cowlick and a diagonally layered fringe.
      { ...lock(.058, .06, [.056, 1.85, .069], [.042, 1.954, .067], [-.022, 2.029, .043], [-.109, 2.069, .012], [-.188, 2.049, -.022]), blend: .037 },
      { ...lock(.099, .064, [.091, 1.884, -.121], [.204, 1.835, -.28], [.282, 1.743, -.369], [.296, 1.659, -.415], [.208, 1.575, -.454]), blend: .021 },
      { ...lock(.109, .077, [.219, 1.814, -.203], [.358, 1.716, -.304], [.367, 1.58, -.379], [.302, 1.474, -.423], [.22, 1.499, -.448]), blend: .022 },
      { ...lock(.129, .083, [.032, 1.908, -.111], [-.078, 1.828, -.316], [-.118, 1.712, -.423], [-.082, 1.565, -.479], [.002, 1.492, -.501], [.077, 1.532, -.462]), blend: .022 },
      { ...lock(.106, .074, [-.107, 1.88, -.071], [-.245, 1.787, -.247], [-.31, 1.668, -.365], [-.316, 1.552, -.413], [-.263, 1.518, -.421]), blend: .026 },
      lock(.113, .092, [.284, 1.752, -.023], [.446, 1.617, -.146], [.479, 1.489, -.224], [.446, 1.368, -.247], [.409, 1.314, -.253]),
      lock(.092, .077, [-.337, 1.749, -.056], [-.454, 1.616, -.151], [-.489, 1.468, -.21], [-.447, 1.363, -.251]),
    ],
  },
  downcut: {
    nape: 2.52,
    part: true,
    fringe: 1.4,
    ridges: 9,
    relief: .023,
    blend: .037,
    locks: [...downcutBack, ...temple, ...mirror(temple), ...downcutFringe, ...mirror(downcutFringe)],
  },
  curly: {
    nape: 2.63,
    fringe: 1.25,
    foreheadDepth: .523,
    crownRadius: .482,
    ridges: 10,
    relief: .019,
    blend: .032,
    locks: [...backCurls, ...curlyFringe, ...curlyCrown],
  },
  mohawk: {
    nape: 2.51,
    fringe: 1.22,
    foreheadDepth: .526,
    crownRadius: .491,
    ridges: 9,
    relief: .022,
    blend: .032,
    locks: [...downcutBack, ...mohawkFringe, ...mohawkCrown],
  },
  shaggy: {
    nape: 2.65,
    part: true,
    fringe: 1.37,
    ridges: 9,
    relief: .032,
    blend: .037,
    locks: [...shaggyBack, ...shaggySides, ...mirror(shaggySides), ...shaggyFringe, ...mirror(shaggyFringe.slice(0, 3))],
  },
  bob: {
    nape: 2.73,
    fringe: 1.34,
    foreheadDepth: .508,
    ridges: 10,
    relief: .027,
    blend: .035,
    locks: [...backBob, ...bobSide, ...mirror(bobSide), ...softBangs],
  },
  lob: {
    nape: 2.73,
    part: true,
    fringe: 1.38,
    ridges: 9,
    relief: .027,
    blend: .032,
    locks: [...backLob, ...flippedSide, ...mirror(flippedSide), ...centerPart],
  },
  bun: {
    nape: 2.51,
    fringe: 1.32,
    foreheadDepth: .51,
    ridges: 10,
    relief: .027,
    blend: .034,
    locks: [...backBun, ...bunLocks, ...bunTendrils, ...softBangs],
  },
  braids: {
    nape: 2.53,
    fringe: 1.34,
    foreheadDepth: .506,
    ridges: 10,
    relief: .027,
    blend: .033,
    locks: [...backBun, ...braidSide, ...mirror(braidSide), ...softBangs],
  },
  long: {
    nape: 2.71,
    part: true,
    fringe: 1.39,
    ridges: 9,
    relief: .032,
    blend: .035,
    locks: [...backLong, ...longSide, ...mirror(longSide), ...centerPart],
  },
};

const resolution = 84;
const center = [0, 1.37, .014] as const;
const extent = [.76, .95, .65] as const;
const grid = extent.map((value, axis) =>
  Array.from({ length: resolution }, (_, i) => center[axis] + value * (2 * i / resolution - 1)),
);
const [gridX, gridY, gridZ] = grid;
const slice = resolution * resolution;

// Positive distance denotes the inside. This blend rounds off intersections
// while retaining the grooves between neighboring sweeps.
function smoothUnion(a: number, b: number, radius: number) {
  const overlap = Math.max(0, radius - Math.abs(a - b));
  return Math.max(a, b) + overlap * overlap / (4 * radius);
}

function fillScalp(field: Float32Array, {
  nape, part, fringe, foreheadDepth = .485, crownRadius = .51, ridges, relief,
}: Style) {
  for (let z = 0; z < resolution; z++) {
    for (let x = 0; x < resolution; x++) {
      const lateral = gridX[x] / .549;
      const forward = gridZ[z] < 0;
      const depth = (gridZ[z] - .033) / (forward && !part ? foreheadDepth : .463);
      const heading = Math.atan2(lateral, depth);
      const horizontal = Math.hypot(lateral, depth);
      const front = Math.max(0, -Math.cos(heading));
      const hairline = part
        ? (fringe ?? 1.29) - (fringe === undefined ? .24 : .34) * front ** 12
        : (fringe ?? 1.42) + .035 * Math.sin(ridges * heading);
      const end = nape + (hairline - nape) * front ** 1.42;
      for (let y = 0; y < resolution; y++) {
        const vertical = (gridY[y] - 1.429) / crownRadius;
        const angle = Math.atan2(horizontal, vertical);
        const flow = heading * ridges + 1.18 * Math.sin(angle * 1.7);
        const strand = Math.cos(flow) + .11 * Math.cos(flow * 3);
        const raised = relief * strand * Math.sin(angle) ** 2;
        const sphere = (1 + raised - Math.hypot(horizontal, vertical)) * .46;
        const edge = (end - angle) * .36;
        field[x + y * resolution + z * slice] = -smoothUnion(-sphere, -edge, .071);
      }
    }
  }
}

function addLock(field: Float32Array, strand: Float32Array, {
  path, width, depth, heading = 0, pointed, blend, fullLength,
}: Lock, styleBlend: number) {
  const curve = new CatmullRomCurve3(path.map((point) => new Vector3(...point)));
  const outward = new Vector3(Math.sin(heading), 0, Math.cos(heading));
  const tangent = new Vector3();
  const normal = new Vector3();
  const binormal = new Vector3();
  const sampleCount = Math.max(8, Math.ceil(curve.getLength() / .016));
  const softness = blend ?? styleBlend;
  const affected: number[] = [];
  for (let sample = 0; sample <= sampleCount; sample++) {
    const t = sample / sampleCount;
    const point = curve.getPoint(t);
    curve.getTangent(t, tangent);
    normal.crossVectors(tangent, outward).normalize();
    binormal.crossVectors(tangent, normal);
    const roundEnds = Math.sin(Math.PI * t) ** .52 * (1.13 - .25 * t);
    const taper = fullLength ? Math.max(.76, roundEnds) : roundEnds;
    const tip = pointed ? Math.min(1, (1 - t) * 2.1) : 1;
    const section = pointed ? Math.sin(Math.PI * t / 2) ** .44 * tip : taper;
    const across = Math.max(.009, width * section);
    const inward = Math.max(.009, depth * section);
    const along = (.027 + .041 * taper) * (pointed ? .5 + .5 * tip : 1);
    const bounds = Math.max(across, inward, along) + softness;
    const axes = [point.x, point.y, point.z];
    const ranges = axes.map((value, axis) => {
      const scale = resolution / (2 * extent[axis]);
      return [
        Math.max(1, Math.floor((value - bounds - center[axis] + extent[axis]) * scale)),
        Math.min(resolution - 2, Math.ceil((value + bounds - center[axis] + extent[axis]) * scale)),
      ];
    });
    const [xRange, yRange, zRange] = ranges;
    const smallest = Math.min(across, inward, along);
    for (let z = zRange[0]; z <= zRange[1]; z++) {
      const dz = gridZ[z] - point.z;
      for (let y = yRange[0]; y <= yRange[1]; y++) {
        const dy = gridY[y] - point.y;
        for (let x = xRange[0]; x <= xRange[1]; x++) {
          const dx = gridX[x] - point.x;
          const u = (dx * normal.x + dy * normal.y + dz * normal.z) / across;
          const v = (dx * binormal.x + dy * binormal.y + dz * binormal.z) / inward;
          const w = (dx * tangent.x + dy * tangent.y + dz * tangent.z) / along;
          const value = (1 - Math.sqrt(u * u + v * v + w * w)) * smallest;
          if (value < -softness) continue;
          const index = x + y * resolution + z * slice;
          if (strand[index] === -Infinity) affected.push(index);
          strand[index] = Math.max(strand[index], value);
        }
      }
    }
  }

  for (const index of affected) {
    field[index] = smoothUnion(field[index], strand[index], softness);
    strand[index] = -Infinity;
  }
}

const hairGeometry = new Map<Hairstyle, BufferGeometry>();

function geometryFor(style: Hairstyle) {
  const cached = hairGeometry.get(style);
  if (cached) return cached;

  const profile = styles[style];
  const surface = new MarchingCubes(resolution, plush.hair, false, false, 72_000);
  surface.isolation = 0;
  fillScalp(surface.field, profile);
  const strand = new Float32Array(surface.field.length).fill(-Infinity);
  for (const lock of profile.locks) addLock(surface.field, strand, lock, profile.blend);
  surface.blur(.24);
  surface.update();

  const positions = surface.positionArray.slice(0, surface.count * 3);
  const normals = surface.normalArray.slice(0, surface.count * 3);
  const uv = new Float32Array(surface.count * 2);
  for (let i = 0; i < surface.count; i++) {
    const vertex = i * 3;
    for (let axis = 0; axis < 3; axis++) {
      positions[vertex + axis] = positions[vertex + axis] * extent[axis] + center[axis];
      normals[vertex + axis] /= extent[axis];
    }
    uv[i * 2] = positions[vertex] * .55 + .5;
    uv[i * 2 + 1] = positions[vertex + 1] * .62;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  surface.geometry.dispose();
  hairGeometry.set(style, geometry);
  return geometry;
}

export default function AvatarHair({ style }: { style: Hairstyle }) {
  return (
    <group name={style} position={[0, -.96, 0]}>
      <mesh castShadow>
        <primitive object={geometryFor(style)} attach="geometry" />
        <primitive object={plush.hair} attach="material" />
      </mesh>
      {style === 'braids' && [-1, 1].map((side) => (
        <mesh
          key={side}
          castShadow
          position={[side * .496, .715, -.085]}
          rotation={[Math.PI / 2 + .15, 0, 0]}
        >
          <torusGeometry args={[.052, .014, 10, 28]} />
          <meshStandardMaterial color="#906452" roughness={.86} />
        </mesh>
      ))}
    </group>
  );
}
