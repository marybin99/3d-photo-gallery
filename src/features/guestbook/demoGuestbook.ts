import type { GuestbookEntry } from './types.ts';

const STORAGE_KEY = 'quiet-gallery-demo-guestbook';
export function demoRead(): GuestbookEntry[] {
  try {
    return JSON.parse(
      localStorage.getItem(STORAGE_KEY) || '[]',
    ) as GuestbookEntry[];
  } catch {
    return [];
  }
}
export function demoWrite(nickname: string, message: string): GuestbookEntry {
  const entry = {
    id: crypto.randomUUID(),
    nickname,
    message,
    created_at: new Date().toISOString(),
  };
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([entry, ...demoRead()].slice(0, 30)),
  );
  return entry;
}
