export const HAIRSTYLES = {
  male: [
    { id: 'classic', label: '기본형' },
    { id: 'downcut', label: '다운컷형' },
    { id: 'curly', label: '뽀글형' },
    { id: 'mohawk', label: '모히칸형' },
    { id: 'shaggy', label: '장발형' },
  ],
  female: [
    { id: 'bob', label: '단발형' },
    { id: 'lob', label: '중단발형' },
    { id: 'bun', label: '묶음머리형' },
    { id: 'braids', label: '땋은머리형' },
    { id: 'long', label: '긴머리형' },
  ],
} as const;

export type AvatarGender = keyof typeof HAIRSTYLES;
export type Hairstyle = (typeof HAIRSTYLES)[AvatarGender][number]['id'];
export type AvatarChoice = {
  [Gender in AvatarGender]: {
    gender: Gender;
    hair: (typeof HAIRSTYLES)[Gender][number]['id'];
    santaHat: boolean;
  };
}[AvatarGender];

export const DEFAULT_AVATAR: AvatarChoice = {
  gender: 'male',
  hair: 'classic',
  santaHat: false,
};

const STORAGE_KEY = 'gallery-avatar';

export function avatarChoice(gender: AvatarGender, hair: unknown, santaHat = false): AvatarChoice {
  if (gender === 'male') {
    return {
      gender,
      hair: HAIRSTYLES.male.find((style) => style.id === hair)?.id ?? 'classic',
      santaHat,
    };
  }
  return {
    gender,
    hair: HAIRSTYLES.female.find((style) => style.id === hair)?.id ?? 'bob',
    santaHat,
  };
}

export function loadAvatar(): AvatarChoice | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved?.gender !== 'male' && saved?.gender !== 'female') return null;
    const choice = avatarChoice(saved.gender, saved.hair, saved.santaHat === true);
    return choice.hair === saved.hair ? choice : null;
  } catch {
    return null;
  }
}

export function saveAvatar(choice: AvatarChoice) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
  } catch {
    // The visitor can still use the chosen avatar for the current visit.
  }
}
