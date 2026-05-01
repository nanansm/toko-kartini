import 'server-only';
import { db, products } from '@kartini/db';
import { sql, eq, and } from 'drizzle-orm';

export interface CategoryRow {
  l1: string;
  l2: string | null;
  productCount: number;
  activeCount: number;
}

export async function getCategoryTree(): Promise<CategoryRow[]> {
  const rows = await db
    .select({
      l1: products.categoryL1,
      l2: products.categoryL2,
      productCount: sql<number>`COUNT(*)::int`,
      activeCount: sql<number>`SUM(CASE WHEN ${products.isActive} = true THEN 1 ELSE 0 END)::int`,
    })
    .from(products)
    .groupBy(products.categoryL1, products.categoryL2)
    .orderBy(products.categoryL1, products.categoryL2);

  return rows.map((r) => ({
    l1: r.l1,
    l2: r.l2,
    productCount: Number(r.productCount),
    activeCount: Number(r.activeCount),
  }));
}
