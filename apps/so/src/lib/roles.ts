export type UserRole = 'OWNER' | 'ADMIN' | 'SUPERVISOR' | 'STAF_GUDANG' | 'KASIR';

export const ROLE_LABEL: Record<UserRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  SUPERVISOR: 'Supervisor',
  STAF_GUDANG: 'Staf Gudang',
  KASIR: 'Kasir',
};
