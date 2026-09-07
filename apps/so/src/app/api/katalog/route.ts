import { NextResponse } from 'next/server';
import { getCurrentUser, canAccess, PERMISSIONS } from '@/lib/session';
import { ambilKatalogRingkas } from '@/lib/katalog';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  // getCurrentUser tidak melakukan redirect() — route ini wajib selalu
  // membalas JSON, sama seperti /api/cari.
  const pengguna = await getCurrentUser();
  if (!pengguna) {
    return NextResponse.json({ ok: false, pesan: 'Sesi berakhir, masuk lagi.' }, { status: 401 });
  }

  if (!canAccess(pengguna.peran, PERMISSIONS.CATAT_MUTASI)) {
    return NextResponse.json({ ok: false, pesan: 'Tidak berwenang mengambil katalog' }, { status: 403 });
  }

  const katalog = await ambilKatalogRingkas();
  if (!katalog) {
    return NextResponse.json({ ok: false, pesan: 'Katalog belum disegarkan.' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const waktuKlien = searchParams.get('waktu');

  // Gerbang hemat data: katalog ±181 KB dan HP staf menanyakannya berkali-kali
  // sehari. Kalau versi klien sudah sama, jangan kirim ulang seluruh isi.
  if (waktuKlien !== null && waktuKlien === katalog.waktu) {
    return NextResponse.json({ ok: true, takBerubah: true, waktu: katalog.waktu }, { status: 200 });
  }

  return NextResponse.json(
    { ok: true, takBerubah: false, waktu: katalog.waktu, jumlah: katalog.jumlah, produk: katalog.produk },
    { status: 200 },
  );
}
