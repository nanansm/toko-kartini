import { db, stockBalances } from '@kartini/db';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@kartini/auth';
import { headers } from 'next/headers';

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('productId');
  const locationId = searchParams.get('locationId');
  if (!productId || !locationId) {
    return NextResponse.json(
      { error: 'productId dan locationId required' },
      { status: 400 },
    );
  }

  const [balance] = await db
    .select({ qtyInBase: stockBalances.qtyInBase })
    .from(stockBalances)
    .where(
      and(
        eq(stockBalances.productId, productId),
        eq(stockBalances.locationId, locationId),
      ),
    );

  return NextResponse.json({ qty: balance ? Number(balance.qtyInBase) : 0 });
}
