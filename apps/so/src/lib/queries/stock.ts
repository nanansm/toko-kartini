import 'server-only';
import {
  db,
  stockBalances,
  products,
  locations,
  productUnits,
} from '@kartini/db';
import { and, eq, sql, asc, count, inArray } from 'drizzle-orm';

export async function getStockByLocation(
  locationId: string,
  filter: {
    search?: string;
    page?: number;
    pageSize?: number;
    hideZeroStock?: boolean;
  } = {},
) {
  const { search, page = 1, pageSize = 50, hideZeroStock = false } = filter;
  const conditions = [eq(stockBalances.locationId, locationId)];

  if (search) {
    const like = `%${search}%`;
    conditions.push(
      sql`(${products.name} ILIKE ${like} OR ${products.id} ILIKE ${like})`,
    );
  }
  if (hideZeroStock) {
    conditions.push(sql`${stockBalances.qtyInBase} > 0`);
  }

  const [items, totalResult] = await Promise.all([
    db
      .select({
        id: stockBalances.id,
        productId: stockBalances.productId,
        productName: products.name,
        categoryL1: products.categoryL1,
        qtyInBase: stockBalances.qtyInBase,
        avgHpp: stockBalances.avgHpp,
        lastMovementAt: stockBalances.lastMovementAt,
        lastCountedAt: stockBalances.lastCountedAt,
      })
      .from(stockBalances)
      .innerJoin(products, eq(stockBalances.productId, products.id))
      .where(and(...conditions))
      .orderBy(asc(products.name))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: count() })
      .from(stockBalances)
      .innerJoin(products, eq(stockBalances.productId, products.id))
      .where(and(...conditions)),
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

export async function getStockSummary() {
  const result = await db
    .select({
      locationId: stockBalances.locationId,
      locationName: locations.name,
      locationCode: locations.code,
      totalProducts: count(stockBalances.productId),
      totalQtyBase: sql<string>`COALESCE(SUM(${stockBalances.qtyInBase}), 0)`,
      totalValueRp: sql<string>`COALESCE(SUM(${stockBalances.qtyInBase} * COALESCE(${stockBalances.avgHpp}, 0)), 0)`,
    })
    .from(stockBalances)
    .innerJoin(locations, eq(stockBalances.locationId, locations.id))
    .where(sql`${stockBalances.qtyInBase} > 0`)
    .groupBy(stockBalances.locationId, locations.name, locations.code);

  return result;
}

// Bulk-fetch units for a list of product IDs (avoid N+1 in tables)
export async function getUnitsForProducts(productIds: string[]) {
  if (productIds.length === 0) return new Map<string, { unitName: string; unitLevel: number; qtyInBaseUnit: number; isBaseUnit: boolean; isDefaultPurchase: boolean; isDefaultSell: boolean; id: string; productId: string; }[]>();

  const rows = await db
    .select()
    .from(productUnits)
    .where(inArray(productUnits.productId, productIds))
    .orderBy(asc(productUnits.unitLevel));

  const map = new Map<string, typeof rows>();
  for (const u of rows) {
    if (!map.has(u.productId)) map.set(u.productId, []);
    map.get(u.productId)!.push(u);
  }
  return map;
}
