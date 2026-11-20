export type AdminRole = 'owner' | 'manager' | 'editor';
export type AdminAccess = {
  role: AdminRole;
  is_active: boolean;
  room_ids: string[] | null;
};
export const roleLabels: Record<AdminRole, string> = {
  owner: '최고 관리자',
  manager: '전시 관리자',
  editor: '작품 편집자',
};
export function parseAccess(value: unknown): AdminAccess | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (
    !(
      row.role === 'owner' ||
      row.role === 'manager' ||
      row.role === 'editor'
    ) ||
    typeof row.is_active !== 'boolean' ||
    !(
      row.room_ids === null ||
      (Array.isArray(row.room_ids) &&
        row.room_ids.every((id) => typeof id === 'string'))
    )
  )
    return null;
  return {
    role: row.role,
    is_active: row.is_active,
    room_ids: row.room_ids as string[] | null,
  };
}
export function canUseRoom(access: AdminAccess, id: string) {
  return (
    access.is_active &&
    (access.role === 'owner' ||
      access.room_ids === null ||
      access.room_ids.includes(id))
  );
}
