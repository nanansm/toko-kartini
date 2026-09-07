import { NextResponse } from 'next/server';
import { getCurrentUser, canAccess, PERMISSIONS } from '@/lib/session';
import { cariProduk } from '@/lib/katalog';

export const dynamic = 'force-dynamic';

const BATAS_BAKU = 20;
const BATAS_MIN = 1;
const BATAS_MAKS = 50;

export async function GET(request: Request): Promise<NextResponse> {
  // getCurrentUser tidak melakukan redirect() — route ini wajib selalu
  // membalas JSON, sama seperti /api/catat, supaya pencari di HP tidak
  // membaca 302/HTML sebagai sukses palsu.
  const pengguna = await getCurrentUser();
  if (!pengguna) {
    return NextResponse.json({ ok: false, pesan: 'Sesi berakhir, masuk lagi.' }, { status: 401 });
  }

  if (!canAccess(pengguna.peran, PERMISSIONS.CATAT_MUTASI)) {
    return NextResponse.json({ ok: false, pesan: 'Tidak berwenang mencari katalog' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';

  const batasParam = searchParams.get('batas');
  const batasMentah = batasParam === null ? NaN : Number(batasParam);
  const batas = Number.isFinite(batasMentah)
    ? Math.min(BATAS_MAKS, Math.max(BATAS_MIN, Math.trunc(batasMentah)))
    : BATAS_BAKU;

  const hasil = await cariProduk(q, batas);

  return NextResponse.json({ ok: true, produk: hasil }, { status: 200 });
}
