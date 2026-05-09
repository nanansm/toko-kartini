import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../apps/so/.env.local') });
config({ path: resolve(__dirname, '../.env'), override: false });

async function seedOwner() {
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;

  if (!email || !password) {
    console.error('❌ OWNER_EMAIL dan OWNER_PASSWORD harus di-set di apps/so/.env.local');
    process.exit(1);
  }

  // Dynamic imports — must be after dotenv has populated DATABASE_URL
  const { eq } = await import('drizzle-orm');
  const { createId } = await import('@paralleldrive/cuid2');
  const { hashPassword } = await import('better-auth/crypto');
  const { db, users, sessions, accounts } = await import('./index');

  console.log(`🌱 Seeding owner: ${email}`);

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email));

  if (existing.length > 0 && existing[0]) {
    const userId = existing[0].id;
    const hashed = await hashPassword(password);

    const existingAccount = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.userId, userId));

    if (existingAccount.length > 0) {
      await db
        .update(accounts)
        .set({ password: hashed, updatedAt: new Date() })
        .where(eq(accounts.userId, userId));
    } else {
      await db.insert(accounts).values({
        id: createId(),
        userId,
        accountId: userId,
        providerId: 'credential',
        password: hashed,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await db
      .update(users)
      .set({
        role: 'OWNER',
        emailVerified: true,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    await db.delete(sessions).where(eq(sessions.userId, userId));

    console.log(`✅ Owner di-update (password reset, role=OWNER): ${email}`);
    console.log('⚠️  Sesi aktif user ini sudah dibatalkan, login ulang dengan password baru');
    return;
  }

  const hashed = await hashPassword(password);
  const userId = createId();
  const now = new Date();

  await db.insert(users).values({
    id: userId,
    name: 'Owner Toko Kartini',
    email,
    emailVerified: true,
    role: 'OWNER',
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

  console.log(`✅ Owner berhasil dibuat: ${email}`);
  console.log('⚠️  Segera ganti password setelah login pertama');
}

seedOwner()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
