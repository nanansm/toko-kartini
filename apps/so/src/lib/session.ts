import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { UserRole } from './roles';

const COOKIE_NAME = 'sesi';
const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 jam

export interface SessionUser {
  id: string;
  username: string;
  nama: string;
  peran: UserRole;
  lokasi: string[]; // lokasi yang boleh diakses; [] = semua
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function buatSesi(user: SessionUser): Promise<string> {
  const token = generateToken();
  const { env } = getCloudflareContext();

  await env.SESI.put(`sesi:${token}`, JSON.stringify(user), {
    expirationTtl: SESSION_TTL_SECONDS,
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });

  return token;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const { env } = getCloudflareContext();
    const raw = await env.SESI.get(`sesi:${token}`);
    if (!raw) return null;

    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export async function hapusSesi(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    const { env } = getCloudflareContext();
    await env.SESI.delete(`sesi:${token}`);
  }

  cookieStore.delete(COOKIE_NAME);
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/masuk');
  }
  return user;
}

export function canAccess(peran: UserRole, diizinkan: readonly UserRole[]): boolean {
  return diizinkan.includes(peran);
}

export async function requireRole(roles: readonly UserRole[]): Promise<SessionUser> {
  const user = await requireAuth();
  if (!canAccess(user.peran, roles)) {
    redirect('/');
  }
  return user;
}

export const PERMISSIONS = {
  LIHAT_KATALOG: ['OWNER', 'ADMIN', 'SUPERVISOR', 'STAF_GUDANG'],
  CATAT_MUTASI: ['OWNER', 'ADMIN', 'SUPERVISOR', 'STAF_GUDANG'],
  MULAI_SO: ['OWNER', 'ADMIN', 'SUPERVISOR', 'STAF_GUDANG'],
  TINJAU_SO: ['OWNER', 'ADMIN', 'SUPERVISOR'],
  KELOLA_PENGGUNA: ['OWNER'],
  LIHAT_PESANAN: ['OWNER', 'ADMIN', 'SUPERVISOR', 'STAF_GUDANG'],
} as const satisfies Record<string, UserRole[]>;
