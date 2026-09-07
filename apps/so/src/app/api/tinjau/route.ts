import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { bacaTinjau, putuskanTinjau } from '@kartini/sheets';
import { getCurrentUser, canAccess, PERMISSIONS } from '@/lib/session';
import { deltaMutlak, deltaSelisih, deltaKePenyesuaian } from '@/lib/opname';
import { bacaLogBulanIni, pergeseranSejak } from '@/lib/log-terkini';
import { saldoDiLokasi } from '@/lib/saldo';
import { isKodeLokasi } from '@/lib/lokasi';

export const dynamic = 'force-dynamic';

type Keputusan = 'MUTLAK' | 'SELISIH' | 'BATAL';

interface BadanTinjau {
  tinjauId: number;
  keputusan: Keputusan;
}

function isBadanTinjau(value: unknown): value is BadanTinjau {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.tinjauId === 'number' &&
    (r.keputusan === 'MUTLAK' || r.keputusan === 'SELISIH' || r.keputusan === 'BATAL')
  );
}

export async function GET(): Promise<NextResponse> {
  const pengguna = await getCurrentUser();
  if (!pengguna) {
    return NextResponse.json({ ok: false, pesan: 'Sesi berakhir, masuk lagi.' }, { status: 401 });
  }

  if (!canAccess(pengguna.peran, PERMISSIONS.TINJAU_SO)) {
    return NextResponse.json({ ok: false, pesan: 'Tidak berwenang meninjau SO' }, { status: 403 });
  }

  const sheetId = process.env.SHEET_OPS_ID;
  if (!sheetId) {
    return NextResponse.json(
      { ok: false, pesan: 'Sistem belum siap. Hubungi admin.' },
      { status: 503 }
    );
  }

  const semua = await bacaTinjau(sheetId);
  const baris = semua.filter((b) => b.status === 'MENUNGGU').sort((a, b) => a.id - b.id);

  return NextResponse.json({ ok: true, baris }, { status: 200 });
}

export async function POST(request: Request): Promise<NextResponse> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ ok: false, pesan: 'Badan bukan JSON sah' }, { status: 400 });
  }

  if (!isBadanTinjau(parsed)) {
    return NextResponse.json(
      { ok: false, pesan: 'Badan wajib berisi tinjauId (angka) dan keputusan (MUTLAK/SELISIH/BATAL)' },
      { status: 400 }
    );
  }

  const pengguna = await getCurrentUser();
  if (!pengguna) {
    return NextResponse.json({ ok: false, pesan: 'Sesi berakhir, masuk lagi.' }, { status: 401 });
  }

  if (!canAccess(pengguna.peran, PERMISSIONS.TINJAU_SO)) {
    return NextResponse.json({ ok: false, pesan: 'Tidak berwenang meninjau SO' }, { status: 403 });
  }

  const sheetId = process.env.SHEET_OPS_ID;
  if (!sheetId) {
    return NextResponse.json(
      { ok: false, pesan: 'Sistem belum siap. Hubungi admin.' },
      { status: 503 }
    );
  }

  const { tinjauId, keputusan } = parsed;

  const semua = await bacaTinjau(sheetId);
  const baris = semua.find((b) => b.id === tinjauId);
  if (!baris) {
    return NextResponse.json({ ok: false, pesan: 'Baris tinjauan tidak ditemukan.' }, { status: 404 });
  }

  if (baris.status !== 'MENUNGGU') {
    return NextResponse.json({ ok: false, pesan: 'Baris ini sudah diputus.' }, { status: 409 });
  }

  if (baris.qtyHitung === null || baris.qtyTerlihat === null) {
    return NextResponse.json(
      { ok: false, pesan: 'Data baris tinjauan rusak, betulkan di spreadsheet.' },
      { status: 409 }
    );
  }

  if (!isKodeLokasi(baris.lokasi)) {
    return NextResponse.json({ ok: false, pesan: 'Lokasi baris tinjauan tidak dikenal.' }, { status: 409 });
  }

  let delta = 0;
  let qtyTerlihatDicatat = baris.qtyTerlihat;

  if (keputusan === 'SELISIH') {
    // Selisih murni antara hasil hitung dan angka yang staf lihat -- tidak
    // dipengaruhi mutasi yang menyelip sesudahnya, jadi tidak perlu hitung ulang.
    delta = deltaSelisih(baris.qtyHitung, baris.qtyTerlihat);
  } else if (keputusan === 'MUTLAK') {
    // Barang yang menyelip dianggap SUDAH ikut terhitung staf, jadi saldo akhir
    // wajib PERSIS qtyHitung. qtySistem yang tersimpan di baris bisa basi --
    // antara hasil dikirim dan keputusan ini bisa lewat berjam-jam dan ada
    // mutasi baru masuk -- jadi saldo terkini dihitung ulang dari KV + Log,
    // bukan dipakai dari kolom lama.
    const saldo = await saldoDiLokasi(baris.lokasi);
    if (!saldo) {
      return NextResponse.json(
        { ok: false, pesan: 'Sistem belum siap. Hubungi admin.' },
        { status: 503 }
      );
    }
    const log = await bacaLogBulanIni(sheetId);
    const pergeseran = pergeseranSejak(log, saldo.idTerakhir, baris.lokasi, new Set([baris.productId]));
    const qtySistemKini = (saldo.peta.get(baris.productId) ?? 0) + (pergeseran.get(baris.productId) ?? 0);
    delta = deltaMutlak(baris.qtyHitung, qtySistemKini);
    qtyTerlihatDicatat = qtySistemKini;
  }

  const penyesuaian =
    keputusan === 'BATAL'
      ? null
      : deltaKePenyesuaian(baris.productId, baris.nama, baris.lokasi, delta, qtyTerlihatDicatat);

  if (penyesuaian) {
    const { env } = getCloudflareContext();
    try {
      const stub = env.PENULIS.get(env.PENULIS.idFromName('penulis'));
      const res = await stub.fetch('https://do/tulis', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sheetId,
          user: pengguna.username,
          baris: [
            {
              // Deterministik dan wajib -- ini satu-satunya yang mencegah
              // keputusan yang terkirim dua kali menyesuaikan stok dua kali.
              clientId: `tinjau-${tinjauId}`,
              jenis: 'OPNAME',
              productId: penyesuaian.productId,
              namaSaatItu: penyesuaian.nama,
              qtyPokok: penyesuaian.qtyPokok,
              satuanInput: '',
              qtyInput: 0,
              dari: penyesuaian.dari,
              ke: penyesuaian.ke,
              sebab: null,
              catatan: `Tinjauan #${tinjauId} ${keputusan}`,
              qtyTerlihat: qtyTerlihatDicatat,
              sesiId: String(baris.sesiId),
            },
          ],
        }),
      });

      if (!res.ok) {
        throw new Error(`DO membalas status ${res.status}`);
      }
    } catch {
      // Jangan panggil putuskanTinjau di sini -- barisnya harus tetap
      // MENUNGGU supaya keputusan ini bisa diulang.
      return NextResponse.json(
        { ok: false, pesan: 'Penyesuaian belum tersimpan, coba lagi.' },
        { status: 502 }
      );
    }
  }

  const berhasil = await putuskanTinjau(sheetId, tinjauId, keputusan, pengguna.username);
  if (!berhasil) {
    return NextResponse.json(
      { ok: false, pesan: 'Baris ini sudah diputus atau tidak ditemukan.' },
      { status: 409 }
    );
  }

  return NextResponse.json(
    { ok: true, tinjauId, keputusan, delta, diterapkan: penyesuaian !== null },
    { status: 200 }
  );
}
