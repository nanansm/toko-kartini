import 'server-only';
import { db, products, productUnits, suppliers } from '@kartini/db';
import { and, eq, ilike, or, desc, asc, count } from 'drizzle-orm';

interface ProductsFilter {
  search?: string;
  categoryL1?: string;
  supplierId?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: 'name' | 'category' | 'hpp';
  sortOrder?: 'asc' | 'desc';
}

export async function getProducts(filter: ProductsFilter = {}) {
  const {
    search,
    categoryL1,
    supplierId,
    isActive,
    page = 1,
    pageSize = 50,
    sortBy = 'name',
    sortOrder = 'asc',
  } = filter;

  const conditions = [];
  if (search) {
    conditions.push(
      or(ilike(products.name, `%${search}%`), ilike(products.id, `%${search}%`)),
    );
  }
  if (categoryL1) conditions.push(eq(products.categoryL1, categoryL1));
  if (supplierId) conditions.push(eq(products.supplierId, supplierId));
  if (isActive !== undefined) conditions.push(eq(products.isActive, isActive));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const sortColumn = {
    name: products.name,
    category: products.categoryL1,
    hpp: products.hppPerL1,
  }[sortBy];

  const [items, totalResult] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        categoryL1: products.categoryL1,
        categoryL2: products.categoryL2,
        hppPerL1: products.hppPerL1,
        sellPriceHj3: products.sellPriceHj3,
        isActive: products.isActive,
        supplierName: suppliers.name,
      })
      .from(products)
      .leftJoin(suppliers, eq(products.supplierId, suppliers.id))
      .where(whereClause)
      .orderBy(sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: count() }).from(products).where(whereClause),
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

export async function getProductDetail(id: string) {
  const [product] = await db
    .select({
      id: products.id,
      name: products.name,
      categoryL1: products.categoryL1,
      categoryL2: products.categoryL2,
      hppPerL1: products.hppPerL1,
      sellPriceGrosirL1: products.sellPriceGrosirL1,
      sellPriceHj1: products.sellPriceHj1,
      sellPriceHj2: products.sellPriceHj2,
      sellPriceHj3: products.sellPriceHj3,
      currentAvgHpp: products.currentAvgHpp,
      olseraSku: products.olseraSku,
      isActive: products.isActive,
      notes: products.notes,
      supplierName: suppliers.name,
      supplierPhone: suppliers.phone,
    })
    .from(products)
    .leftJoin(suppliers, eq(products.supplierId, suppliers.id))
    .where(eq(products.id, id));

  if (!product) return null;

  const units = await db
    .select()
    .from(productUnits)
    .where(eq(productUnits.productId, id))
    .orderBy(asc(productUnits.unitLevel));

  return { product, units };
}

export async function getCategoriesL1() {
  const rows = await db
    .selectDistinct({ categoryL1: products.categoryL1 })
    .from(products)
    .orderBy(asc(products.categoryL1));
  return rows.map((r) => r.categoryL1).filter((c): c is string => Boolean(c));
}
