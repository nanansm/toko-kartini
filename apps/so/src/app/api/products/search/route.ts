import { db, products } from '@kartini/db';
import { ilike, or, eq, and, asc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@kartini/auth';
import { headers } from 'next/headers';

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20') || 20, 50);

  const conditions = [eq(products.isActive, true)];
  if (q) {
    const like = `%${q}%`;
    const cond = or(ilike(products.name, like), ilike(products.id, like));
    if (cond) conditions.push(cond);
  }

  const items = await db
    .select({
      id: products.id,
      name: products.name,
      categoryL1: products.categoryL1,
    })
    .from(products)
    .where(and(...conditions))
    .orderBy(asc(products.name))
    .limit(limit);

  return NextResponse.json({ items });
}
