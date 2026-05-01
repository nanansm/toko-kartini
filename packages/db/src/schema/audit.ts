import { text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { auditSchema } from './_schemas';

export const auditLogs = auditSchema.table('audit_logs', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(), // 'product', 'so_session', etc
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(), // 'CREATE', 'UPDATE', 'DELETE', 'APPROVE'
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  actorId: text('actor_id').notNull(),
  actorEmail: text('actor_email'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
