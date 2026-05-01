import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import 'dotenv/config';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const sql = postgres(connectionString, { max: 1 });

  // Drizzle migration generated 'CREATE SCHEMA' statements,
  // jadi tidak perlu pre-create di sini.
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: './drizzle' });

  console.log('✓ Migrations completed');
  await sql.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
