import 'server-only';
import { auth } from '@kartini/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export type UserRole = 'OWNER' | 'ADMIN' | 'SUPERVISOR' | 'STAF_GUDANG' | 'KASIR';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  role: UserRole;
  assignedLocations: string[];
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) return null;
  const u = session.user as Record<string, unknown>;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
    role: (u.role as UserRole) ?? 'STAF_GUDANG',
    assignedLocations: (u.assignedLocations as string[] | null) ?? [],
  };
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireRole(roles: UserRole[]): Promise<SessionUser> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) redirect('/dashboard?error=forbidden');
  return user;
}

export function canAccess(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole);
}

export const PERMISSIONS = {
  VIEW_PRODUCTS: ['OWNER', 'ADMIN', 'SUPERVISOR', 'STAF_GUDANG'] as UserRole[],
  VIEW_SUPPLIERS: ['OWNER', 'ADMIN', 'SUPERVISOR'] as UserRole[],
  VIEW_CUSTOMERS: ['OWNER', 'ADMIN', 'SUPERVISOR'] as UserRole[],
  VIEW_CATEGORIES: ['OWNER', 'ADMIN', 'SUPERVISOR', 'STAF_GUDANG'] as UserRole[],
  MANAGE_USERS: ['OWNER'] as UserRole[],
  MANAGE_SETTINGS: ['OWNER'] as UserRole[],
  TRIGGER_SYNC: ['OWNER', 'ADMIN'] as UserRole[],
  CREATE_SO: ['OWNER', 'ADMIN', 'SUPERVISOR', 'STAF_GUDANG'] as UserRole[],
  APPROVE_SO: ['OWNER', 'ADMIN', 'SUPERVISOR'] as UserRole[],
  // POS (Phase 2+)
  ACCESS_POS: ['OWNER', 'ADMIN', 'SUPERVISOR', 'KASIR'] as UserRole[],
  OPEN_SHIFT: ['OWNER', 'ADMIN', 'SUPERVISOR', 'KASIR'] as UserRole[],
  APPROVE_RETURN: ['OWNER', 'SUPERVISOR'] as UserRole[],
  OVERRIDE_PRICE: ['OWNER', 'ADMIN', 'SUPERVISOR'] as UserRole[],
  VIEW_POS_REPORTS: ['OWNER', 'ADMIN', 'SUPERVISOR'] as UserRole[],
} as const;
