import 'server-only';
import { db, suppliers, products } from '@kartini/db';
import { and, ilike, count, sql, asc } from 'drizzle-orm';

export async function getSuppliers(
  filter: { search?: string; page?: number; pageSize?: number } = {},
) {
  const { search, page = 1, pageSize = 60 } = filter;
  const conditions = [];
  if (search) conditions.push(ilike(suppliers.name, `%${search}%`));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, totalResult] = await Promise.all([
    db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        picName: suppliers.picName,
        whatsapp: suppliers.whatsapp,
        phone: suppliers.phone,
        paymentTermDays: suppliers.paymentTermDays,
        productCount: sql<number>`(SELECT COUNT(*)::int FROM ${products} WHERE ${products.supplierId} = ${suppliers.id})`,
      })
      .from(suppliers)
      .where(whereClause)
      .orderBy(asc(suppliers.name))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: count() }).from(suppliers).where(whereClause),
  ]);

  const total = totalResult[0]?.count ?? 0;

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
