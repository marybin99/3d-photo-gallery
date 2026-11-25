export type AdminRole = 'owner' | 'manager' | 'editor';

export type AdminAccess = {
  role: AdminRole;
  is_active: boolean;
  room_ids: string[] | null;
};
