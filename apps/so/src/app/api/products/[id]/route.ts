import { db, products, productUnits } from '@kartini/db';
import { eq, asc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@kartini/auth';
import { headers } from 'next/headers';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const [product] = await db
    .select({
      id: products.id,
      name: products.name,
      categoryL1: products.categoryL1,
      hppPerL1: products.hppPerL1,
    })
    .from(products)
    .where(eq(products.id, id));

  if (!product) return NextResponse.json({ product: null }, { status: 404 });

  const units = await db
    .select()
    .from(productUnits)
    .where(eq(productUnits.productId, id))
    .orderBy(asc(productUnits.unitLevel));

  return NextResponse.json({
    product,
    units: units.map((u) => ({
      id: u.id,
      productId: u.productId,
      unitName: u.unitName,
      unitLevel: u.unitLevel,
      qtyInBaseUnit: Number(u.qtyInBaseUnit),
      isBaseUnit: u.isBaseUnit,
      isDefaultPurchase: u.isDefaultPurchase,
      isDefaultSell: u.isDefaultSell,
    })),
  });
}
