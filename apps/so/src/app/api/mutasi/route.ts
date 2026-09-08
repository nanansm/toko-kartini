import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getCurrentUser, canAccess, PERMISSIONS } from '@/lib/session';
import { isKodeLokasi } from '@/lib/lokasi';
import { ARAH_SAH, LABEL_SEBAB, type JenisMutasi, type SebabRusak } from '@/lib/mutasi';
import { petaProdukRingkas, type ProdukRingkas } from '@/lib/katalog';

export const dynamic = 'force-dynamic';

const BATAS_NOTA = 200;

// OPNAME sengaja tidak masuk sini -- jalurnya lewat api/entri, bukan mutasi
// biasa (tanpa asal/tujuan, tidak cocok dengan bentuk badan ini).
const JENIS_SAH: readonly string[] = ['DATANG', 'ISI_DISPLAY', 'PINDAH', 'RUSAK'];
const SEBAB_SAH: readonly string[] = Object.keys(LABEL_SEBAB);

interface BadanMutasi {
  clientId: string;
  jenis: string;
  dari: string;
  ke: string;
  nota: string;
  sebab: string | null;
  productId: string;
  qtySatuan: Record<string, number>;
}

interface BadanHapus {
  clientId: string;
}

function isBadanMutasi(value: unknown): value is BadanMutasi {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  if (typeof r.clientId !== 'string' || r.clientId.length === 0) return false;
  if (typeof r.jenis !== 'string') return false;
  if (typeof r.dari !== 'string' || r.dari.length === 0) return false;
  if (typeof r.ke !== 'string' || r.ke.length === 0) return false;
  if (typeof r.nota !== 'string') return false;
  if (r.sebab !== null && typeof r.sebab !== 'string') return false;
  if (typeof r.productId !== 'string' || r.productId.length === 0) return false;
  if (typeof r.qtySatuan !== 'object' || r.qtySatuan === null || Array.isArray(r.qtySatuan)) return false;
  return true;
}

function isBadanHapus(value: unknown): value is BadanHapus {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return typeof r.clientId === 'string' && r.clientId.length > 0;
}

interface SatuanQty {
  sku: string;
  nama: string;
  pengali: number;
  qty: number;
}

// Larik satuan untuk DO dibangun dari KATALOG, bukan dari qtySatuan kiriman HP
// -- lihat alasan yang sama di api/entri/route.ts: pengali menentukan angka
// stok, jadi tidak boleh datang dari sisi yang bisa dimodifikasi pengguna.
function bangunSatuan(
  qtySatuan: Record<string, number>,
  produk: ProdukRingkas,
): { ok: true; satuan: SatuanQty[] } | { ok: false; pesan: string } {
  const satuan: SatuanQty[] = [];
  for (const [sku, qty] of Object.entries(qtySatuan)) {
    const tingkat = produk.satuan.find((s) => s.sku === sku);
    if (!tingkat) {
      return { ok: false, pesan: `Satuan dengan SKU "${sku}" tidak dikenal untuk produk ini.` };
    }
    if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty < 0) {
      return { ok: false, pesan: `Jumlah untuk "${tingkat.nama}" wajib bilangan bulat, minimal nol.` };
    }
    if (qty === 0) continue;
    satuan.push({ sku, nama: tingkat.nama, pengali: tingkat.pengali, qty });
  }
  if (satuan.length === 0) {
    return { ok: false, pesan: 'Isi minimal satu satuan.' };
  }
  return { ok: true, satuan };
}

export async function POST(request: Request): Promise<NextResponse> {
  const pengguna = await getCurrentUser();
  if (!pengguna) {
    return NextResponse.json({ ok: false, pesan: 'Sesi berakhir, masuk lagi.' }, { status: 401 });
  }
  if (!canAccess(pengguna.peran, PERMISSIONS.CATAT_MUTASI)) {
    return NextResponse.json({ ok: false, pesan: 'Tidak berwenang mencatat mutasi' }, { status: 403 });
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ ok: false, pesan: 'Badan bukan JSON sah' }, { status: 400 });
  }

  if (!isBadanMutasi(parsed)) {
    return NextResponse.json(
      { ok: false, pesan: 'Badan wajib berisi clientId, jenis, dari, ke, nota, sebab, productId, qtySatuan' },
      { status: 400 },
    );
  }

  if (!JENIS_SAH.includes(parsed.jenis)) {
    return NextResponse.json({ ok: false, pesan: `Jenis mutasi "${parsed.jenis}" tidak dikenal.` }, { status: 400 });
  }
  const jenis = parsed.jenis as JenisMutasi;
  const arahSah = ARAH_SAH[jenis];

  if (!isKodeLokasi(parsed.dari) || !arahSah.dari.includes(parsed.dari)) {
    return NextResponse.json(
      {
        ok: false,
        pesan: `Lokasi asal tidak valid. Yang diizinkan: ${arahSah.dari.join(', ')}.`,
      },
      { status: 400 },
    );
  }
  const dari = parsed.dari;

  if (!isKodeLokasi(parsed.ke) || !arahSah.ke.includes(parsed.ke)) {
    return NextResponse.json(
      {
        ok: false,
        pesan: `Lokasi tujuan tidak valid. Yang diizinkan: ${arahSah.ke.join(', ')}.`,
      },
      { status: 400 },
    );
  }
  const ke = parsed.ke;

  if (dari === ke) {
    return NextResponse.json({ ok: false, pesan: 'Lokasi asal dan tujuan tidak boleh sama.' }, { status: 400 });
  }

  const sebabMentah = parsed.sebab?.trim() ?? '';
  let sebab: SebabRusak | null = null;
  if (jenis === 'RUSAK') {
    if (!SEBAB_SAH.includes(sebabMentah)) {
      return NextResponse.json({ ok: false, pesan: 'Sebab barang rusak wajib dipilih.' }, { status: 400 });
    }
    sebab = sebabMentah as SebabRusak;
  } else if (sebabMentah !== '') {
    return NextResponse.json(
      { ok: false, pesan: 'Sebab tidak boleh diisi untuk jenis mutasi ini.' },
      { status: 400 },
    );
  }

  const nota = parsed.nota.slice(0, BATAS_NOTA);

  const peta = await petaProdukRingkas([parsed.productId]);
  const produk = peta.get(parsed.productId);
  if (!produk) {
    return NextResponse.json(
      { ok: false, pesan: 'Barang tidak ada di katalog atau datanya belum lengkap.' },
      { status: 400 },
    );
  }

  const hasilSatuan = bangunSatuan(parsed.qtySatuan, produk);
  if (!hasilSatuan.ok) {
    return NextResponse.json({ ok: false, pesan: hasilSatuan.pesan }, { status: 400 });
  }

  const { env } = getCloudflareContext();
  try {
    const stub = env.BUKU.get(env.BUKU.idFromName('buku'));
    const res = await stub.fetch('https://do/mutasi/simpan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clientId: parsed.clientId,
        pengguna: pengguna.username,
        jenis,
        dari,
        ke,
        nota,
        sebab: sebab ?? '',
        productId: parsed.productId,
        namaProduk: produk.nama,
        satuan: hasilSatuan.satuan,
      }),
    });
    const badan = await res.json();
    return NextResponse.json(badan, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, pesan: 'Gagal menyimpan, coba lagi.' }, { status: 502 });
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const pengguna = await getCurrentUser();
  if (!pengguna) {
    return NextResponse.json({ ok: false, pesan: 'Sesi berakhir, masuk lagi.' }, { status: 401 });
  }
  if (!canAccess(pengguna.peran, PERMISSIONS.CATAT_MUTASI)) {
    return NextResponse.json({ ok: false, pesan: 'Tidak berwenang mencatat mutasi' }, { status: 403 });
  }

  const url = new URL(request.url);
  const dari = url.searchParams.get('dari');
  const ke = url.searchParams.get('ke');
  if (!dari || !isKodeLokasi(dari) || !ke || !isKodeLokasi(ke)) {
    return NextResponse.json({ ok: false, pesan: 'Lokasi asal/tujuan tidak dikenal.' }, { status: 400 });
  }

  const { env } = getCloudflareContext();
  try {
    const stub = env.BUKU.get(env.BUKU.idFromName('buku'));
    const res = await stub.fetch(
      `https://do/mutasi/daftar?dari=${encodeURIComponent(dari)}&ke=${encodeURIComponent(ke)}&pengguna=${encodeURIComponent(pengguna.username)}`,
      { method: 'GET' },
    );
    const badan = await res.json();
    return NextResponse.json(badan, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, pesan: 'Gagal mengambil data, coba lagi.' }, { status: 502 });
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const pengguna = await getCurrentUser();
  if (!pengguna) {
    return NextResponse.json({ ok: false, pesan: 'Sesi berakhir, masuk lagi.' }, { status: 401 });
  }
  if (!canAccess(pengguna.peran, PERMISSIONS.CATAT_MUTASI)) {
    return NextResponse.json({ ok: false, pesan: 'Tidak berwenang mencatat mutasi' }, { status: 403 });
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ ok: false, pesan: 'Badan bukan JSON sah' }, { status: 400 });
  }

  if (!isBadanHapus(parsed)) {
    return NextResponse.json({ ok: false, pesan: 'Badan wajib berisi clientId' }, { status: 400 });
  }

  const { env } = getCloudflareContext();
  try {
    const stub = env.BUKU.get(env.BUKU.idFromName('buku'));
    const res = await stub.fetch('https://do/mutasi/hapus', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientId: parsed.clientId }),
    });
    const badan = await res.json();
    return NextResponse.json(badan, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, pesan: 'Gagal menghapus, coba lagi.' }, { status: 502 });
  }
}
