import 'server-only';
import { db, users } from '@kartini/db';
import { sql, asc, desc } from 'drizzle-orm';

const ROLE_PRIORITY = sql`CASE ${users.role}
  WHEN 'OWNER' THEN 1
  WHEN 'ADMIN' THEN 2
  WHEN 'SUPERVISOR' THEN 3
  WHEN 'STAF_GUDANG' THEN 4
  ELSE 5
END`;

export async function getAllUsers() {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: users.role,
      assignedLocations: users.assignedLocations,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(ROLE_PRIORITY), desc(users.createdAt));
}
