import 'server-only';
import {
  db,
  stockCountSessions,
  stockCountItems,
  locations,
  products,
} from '@kartini/db';
import { eq, desc, count, and, sql } from 'drizzle-orm';

export interface SOSessionListFilter {
  status?: string;
  locationId?: string;
  page?: number;
  pageSize?: number;
}

export async function getSOSessions(filter: SOSessionListFilter = {}) {
  const { status, locationId, page = 1, pageSize = 20 } = filter;
  const conditions = [] as Parameters<typeof and>[number][];
  if (status)
    conditions.push(eq(stockCountSessions.status, status as 'DRAFT'));
  if (locationId) conditions.push(eq(stockCountSessions.locationId, locationId));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, totalResult] = await Promise.all([
    db
      .select({
        id: stockCountSessions.id,
        type: stockCountSessions.type,
        status: stockCountSessions.status,
        locationId: stockCountSessions.locationId,
        locationName: locations.name,
        locationCode: locations.code,
        totalItems: stockCountSessions.totalItemsCount,
        totalDifferences: stockCountSessions.totalDifferences,
        totalValueRp: stockCountSessions.totalValueRp,
        totalDifferenceValueRp: stockCountSessions.totalDifferenceValueRp,
        startedAt: stockCountSessions.startedAt,
        submittedAt: stockCountSessions.submittedAt,
        approvedAt: stockCountSessions.approvedAt,
        createdBy: stockCountSessions.createdBy,
      })
      .from(stockCountSessions)
      .innerJoin(locations, eq(stockCountSessions.locationId, locations.id))
      .where(whereClause)
      .orderBy(desc(stockCountSessions.startedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: count() })
      .from(stockCountSessions)
      .where(whereClause),
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

export async function getSOSessionDetail(sessionId: string) {
  const [session] = await db
    .select({
      id: stockCountSessions.id,
      type: stockCountSessions.type,
      status: stockCountSessions.status,
      locationId: stockCountSessions.locationId,
      locationName: locations.name,
      locationCode: locations.code,
      totalItemsCount: stockCountSessions.totalItemsCount,
      totalDifferences: stockCountSessions.totalDifferences,
      totalValueRp: stockCountSessions.totalValueRp,
      totalDifferenceValueRp: stockCountSessions.totalDifferenceValueRp,
      startedAt: stockCountSessions.startedAt,
      submittedAt: stockCountSessions.submittedAt,
      approvedAt: stockCountSessions.approvedAt,
      createdBy: stockCountSessions.createdBy,
      submittedBy: stockCountSessions.submittedBy,
      approvedBy: stockCountSessions.approvedBy,
      notes: stockCountSessions.notes,
      rejectionReason: stockCountSessions.rejectionReason,
    })
    .from(stockCountSessions)
    .innerJoin(locations, eq(stockCountSessions.locationId, locations.id))
    .where(eq(stockCountSessions.id, sessionId));

  if (!session) return null;

  const statusCountsRows = await db
    .select({ status: stockCountItems.status, count: count() })
    .from(stockCountItems)
    .where(eq(stockCountItems.sessionId, sessionId))
    .groupBy(stockCountItems.status);

  const statusCounts = Object.fromEntries(
    statusCountsRows.map((s) => [s.status, s.count]),
  ) as Record<string, number>;

  return { session, statusCounts };
}

export interface SOItemListFilter {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function getSOSessionItems(
  sessionId: string,
  filter: SOItemListFilter = {},
) {
  const { status, search, page = 1, pageSize = 50 } = filter;
  const conditions = [eq(stockCountItems.sessionId, sessionId)] as Parameters<
    typeof and
  >[number][];
  if (status) conditions.push(eq(stockCountItems.status, status as 'PENDING'));
  if (search) {
    conditions.push(sql`${products.name} ILIKE ${`%${search}%`}`);
  }
  const where = and(...conditions);

  const [items, totalResult] = await Promise.all([
    db
      .select({
        id: stockCountItems.id,
        productId: stockCountItems.productId,
        productName: products.name,
        categoryL1: products.categoryL1,
        qtySystemBase: stockCountItems.qtySystemBase,
        qtyPhysicalBase: stockCountItems.qtyPhysicalBase,
        differenceBase: stockCountItems.differenceBase,
        differencePercent: stockCountItems.differencePercent,
        differenceValueRp: stockCountItems.differenceValueRp,
        status: stockCountItems.status,
        notes: stockCountItems.notes,
        approvalReason: stockCountItems.approvalReason,
        rejectionReason: stockCountItems.rejectionReason,
        recountCount: stockCountItems.recountCount,
      })
      .from(stockCountItems)
      .innerJoin(products, eq(stockCountItems.productId, products.id))
      .where(where)
      .orderBy(stockCountItems.status, products.name)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: count() })
      .from(stockCountItems)
      .innerJoin(products, eq(stockCountItems.productId, products.id))
      .where(where),
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
