'use server';

import { db, users, sessions, accounts } from '@kartini/db';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { createId } from '@paralleldrive/cuid2';
import { hashPassword } from 'better-auth/crypto';
import { requireRole, type UserRole } from '@/lib/session';

export type NewUserRole = Exclude<UserRole, 'OWNER'> | 'OWNER';

const VALID_ROLES: UserRole[] = ['OWNER', 'ADMIN', 'SUPERVISOR', 'STAF_GUDANG'];

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  role: NewUserRole;
}): Promise<ActionResult<{ userId: string }>> {
  await requireRole(['OWNER']);

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!name || !email || !password) {
    return { ok: false, error: 'Semua field wajib diisi' };
  }
  if (password.length < 6) {
    return { ok: false, error: 'Password minimal 6 karakter' };
  }
  if (!VALID_ROLES.includes(input.role)) {
    return { ok: false, error: 'Role tidak valid' };
  }

  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return { ok: false, error: 'Email sudah terdaftar' };
    }

    const hashed = await hashPassword(password);
    const userId = createId();
    const now = new Date();

    await db.insert(users).values({
      id: userId,
      name,
      email,
      emailVerified: true,
      role: input.role,
      assignedLocations: [],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(accounts).values({
      id: createId(),
      userId,
      accountId: userId,
      providerId: 'credential',
      password: hashed,
      createdAt: now,
      updatedAt: now,
    });

    revalidatePath('/users');
    return { ok: true, data: { userId } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Gagal membuat user',
    };
  }
}

export async function resetUserPassword(input: {
  userId: string;
  newPassword: string;
}): Promise<ActionResult> {
  await requireRole(['OWNER']);

  if (!input.newPassword || input.newPassword.length < 6) {
    return { ok: false, error: 'Password minimal 6 karakter' };
  }

  try {
    const hashed = await hashPassword(input.newPassword);

    const credentialAccounts = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, input.userId),
          eq(accounts.providerId, 'credential'),
        ),
      )
      .limit(1);

    if (credentialAccounts.length > 0) {
      await db
        .update(accounts)
        .set({ password: hashed, updatedAt: new Date() })
        .where(
          and(
            eq(accounts.userId, input.userId),
            eq(accounts.providerId, 'credential'),
          ),
        );
    } else {
      await db.insert(accounts).values({
        id: createId(),
        userId: input.userId,
        accountId: input.userId,
        providerId: 'credential',
        password: hashed,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await db.delete(sessions).where(eq(sessions.userId, input.userId));

    revalidatePath('/users');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Gagal reset password',
    };
  }
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  const currentUser = await requireRole(['OWNER']);

  if (currentUser.id === userId) {
    return { ok: false, error: 'Tidak bisa hapus akun sendiri' };
  }

  try {
    // sessions & accounts cascade via FK, but delete explicitly to be safe
    await db.delete(sessions).where(eq(sessions.userId, userId));
    await db.delete(accounts).where(eq(accounts.userId, userId));
    await db.delete(users).where(eq(users.id, userId));

    revalidatePath('/users');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Gagal menghapus user',
    };
  }
}

export async function updateUserRole(input: {
  userId: string;
  role: NewUserRole;
}): Promise<ActionResult> {
  const currentUser = await requireRole(['OWNER']);

  if (currentUser.id === input.userId) {
    return { ok: false, error: 'Tidak bisa ubah role sendiri' };
  }
  if (!VALID_ROLES.includes(input.role)) {
    return { ok: false, error: 'Role tidak valid' };
  }

  try {
    await db
      .update(users)
      .set({ role: input.role, updatedAt: new Date() })
      .where(eq(users.id, input.userId));

    revalidatePath('/users');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Gagal ubah role',
    };
  }
}
