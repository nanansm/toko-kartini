import 'server-only';
import { db, stockMovements, products, locations, users } from '@kartini/db';
import { and, eq, gte, lte, desc, count } from 'drizzle-orm';
import type { MovementTypeFilter } from '@/lib/inventory/movement-meta';

export type { MovementTypeFilter } from '@/lib/inventory/movement-meta';
export { MOVEMENT_TYPE_META } from '@/lib/inventory/movement-meta';

export interface MovementsFilter {
  productId?: string;
  locationId?: string;
  movementType?: MovementTypeFilter;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  pageSize?: number;
}

export async function getMovements(filter: MovementsFilter = {}) {
  const {
    productId,
    locationId,
    movementType,
    fromDate,
    toDate,
    page = 1,
    pageSize = 50,
  } = filter;

  const conditions = [];
  if (productId) conditions.push(eq(stockMovements.productId, productId));
  if (locationId) conditions.push(eq(stockMovements.locationId, locationId));
  if (movementType) conditions.push(eq(stockMovements.movementType, movementType));
  if (fromDate) conditions.push(gte(stockMovements.createdAt, fromDate));
  if (toDate) conditions.push(lte(stockMovements.createdAt, toDate));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, totalResult] = await Promise.all([
    db
      .select({
        id: stockMovements.id,
        productId: stockMovements.productId,
        productName: products.name,
        locationId: stockMovements.locationId,
        locationName: locations.name,
        locationCode: locations.code,
        movementType: stockMovements.movementType,
        qtyInBase: stockMovements.qtyInBase,
        unitNameUsed: stockMovements.unitNameUsed,
        notes: stockMovements.notes,
        createdAt: stockMovements.createdAt,
        createdBy: stockMovements.createdBy,
        createdByName: users.name,
      })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
      .innerJoin(locations, eq(stockMovements.locationId, locations.id))
      .leftJoin(users, eq(stockMovements.createdBy, users.id))
      .where(whereClause)
      .orderBy(desc(stockMovements.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: count() }).from(stockMovements).where(whereClause),
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

