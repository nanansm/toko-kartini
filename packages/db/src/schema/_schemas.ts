import { pgSchema } from 'drizzle-orm/pg-core';

// PostgreSQL schemas untuk separation of concerns antar app
export const inventorySchema = pgSchema('inventory');
export const authSchema = pgSchema('auth');
export const auditSchema = pgSchema('audit');
export const posSchema = pgSchema('pos');

// Future:
// export const accountingSchema = pgSchema('accounting');
// export const b2bSchema = pgSchema('b2b');
