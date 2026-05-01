import 'server-only';
import { db, customers } from '@kartini/db';
import { and, ilike, asc, count } from 'drizzle-orm';

export async function getCustomers(filter: { search?: string } = {}) {
  const { search } = filter;
  const conditions = [];
  if (search) conditions.push(ilike(customers.name, `%${search}%`));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, totalResult] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(whereClause)
      .orderBy(asc(customers.name)),
    db.select({ count: count() }).from(customers).where(whereClause),
  ]);

  return {
    items,
    total: totalResult[0]?.count ?? 0,
  };
}
