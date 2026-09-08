import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getCurrentUser, canAccess, PERMISSIONS } from '@/lib/session';

export const dynamic = 'force-dynamic';

const JENIS_SAH = ['DATANG', 'ISI_DISPLAY', 'PINDAH', 'RUSAK'] as const;
type JenisSah = (typeof JENIS_SAH)[number];

function isJenisSah(value: string | null): value is JenisSah {
  return value !== null && (JENIS_SAH as readonly string[]).includes(value);
}

export async function GET(request: Request): Promise<NextResponse> {
  // Penjaga sesi wajib mendahului apa pun dan selalu membalas JSON -- layar
  // pencatatan memanggil ini di latar belakang, bukan navigasi penuh.
  const pengguna = await getCurrentUser();
  if (!pengguna) {
    return NextResponse.json({ ok: false, pesan: 'Sesi berakhir, masuk lagi.' }, { status: 401 });
  }
  if (!canAccess(pengguna.peran, PERMISSIONS.CATAT_MUTASI)) {
    return NextResponse.json({ ok: false, pesan: 'Tidak berwenang mencatat mutasi' }, { status: 403 });
  }

  const url = new URL(request.url);
  const jenis = url.searchParams.get('jenis');
  if (!isJenisSah(jenis)) {
    return NextResponse.json({ ok: false, pesan: 'jenis tidak dikenal' }, { status: 400 });
  }

  // batas dipagari maksimal 20 di sini -- kueri "sering" cuma mengisi 8
  // tombol cepat, bukan daftar panjang, jadi tidak perlu diteruskan mentah
  // ke DO tanpa batas atas.
  const batasMentah = Number(url.searchParams.get('batas') ?? '8');
  const batas = Number.isFinite(batasMentah) && Number.isInteger(batasMentah) && batasMentah > 0
    ? Math.min(batasMentah, 20)
    : 8;

  const { env } = getCloudflareContext();
  try {
    const stub = env.BUKU.get(env.BUKU.idFromName('buku'));
    const res = await stub.fetch(
      `https://do/mutasi/sering?jenis=${encodeURIComponent(jenis)}&batas=${batas}`,
      { method: 'GET' },
    );
    const badan = await res.json();
    return NextResponse.json(badan, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, pesan: 'Gagal mengambil data, coba lagi.' }, { status: 502 });
  }
}
