import type { GuestbookEntry } from '../../../supabase/functions/_shared/guestbook.ts';
export type { GuestbookEntry };

export type ManagedGuestbookEntry = GuestbookEntry & { is_visible: boolean };

export type GuestbookFilter = 'all' | 'visible' | 'hidden';
