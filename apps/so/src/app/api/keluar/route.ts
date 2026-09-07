import { NextResponse } from 'next/server';
import { hapusSesi } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse> {
  await hapusSesi();
  return NextResponse.json({ ok: true });
}
