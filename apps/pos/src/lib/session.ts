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
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user as Record<string, unknown>;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
    role: ((u.role as UserRole) ?? 'KASIR'),
  };
}

const POS_ROLES: UserRole[] = ['OWNER', 'ADMIN', 'SUPERVISOR', 'KASIR'];

export async function requirePOSAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!POS_ROLES.includes(user.role)) redirect('/unauthorized');
  return user;
}

export async function requireApproverRole(): Promise<SessionUser> {
  const user = await requirePOSAuth();
  if (!['OWNER', 'SUPERVISOR'].includes(user.role)) {
    redirect('/pos?error=unauthorized');
  }
  return user;
}
