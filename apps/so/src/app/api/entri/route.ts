import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getCurrentUser, canAccess, PERMISSIONS } from '@/lib/session';
import { LOKASI_NYATA, isKodeLokasi } from '@/lib/lokasi';
import { petaProdukRingkas, type ProdukRingkas } from '@/lib/katalog';

export const dynamic = 'force-dynamic';

const REGEX_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

interface BadanEntri {
  clientId: string;
  rak: string;
  productId: string;
  qtySatuan: Record<string, number>;
  expired: string | null;
}

interface BadanHapus {
  clientId: string;
}

function isBadanEntri(value: unknown): value is BadanEntri {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  if (typeof r.clientId !== 'string' || r.clientId.length === 0) return false;
  if (typeof r.rak !== 'string' || r.rak.length === 0) return false;
  if (typeof r.productId !== 'string' || r.productId.length === 0) return false;
  if (typeof r.qtySatuan !== 'object' || r.qtySatuan === null || Array.isArray(r.qtySatuan)) return false;
  if (r.expired !== null && typeof r.expired !== 'string') return false;
  return true;
}

function isBadanHapus(value: unknown): value is BadanHapus {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return typeof r.clientId === 'string' && r.clientId.length > 0;
}

function isRakNyata(rak: string): boolean {
  return isKodeLokasi(rak) && (LOKASI_NYATA as readonly string[]).includes(rak);
}

interface SatuanQty {
  sku: string;
  nama: string;
  pengali: number;
  qty: number;
}

// Larik satuan untuk DO dibangun dari KATALOG, bukan dari qtySatuan kiriman HP:
// nama & pengali menentukan angka stok (qty_total = qty * pengali di DO), jadi
// kalau HP yang mengirim pengali, staf bisa (sengaja atau tidak) memalsukan
// jumlah stok tanpa mengubah katalog.
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
  // Penjaga sesi wajib mendahului penguraian badan dan selalu membalas JSON --
  // pengirim latar di HP menganggap HTML/302 sebagai sukses lalu membuang baris.
  const pengguna = await getCurrentUser();
  if (!pengguna) {
    return NextResponse.json({ ok: false, pesan: 'Sesi berakhir, masuk lagi.' }, { status: 401 });
  }
  if (!canAccess(pengguna.peran, PERMISSIONS.MULAI_SO)) {
    return NextResponse.json({ ok: false, pesan: 'Tidak berwenang mencatat SO' }, { status: 403 });
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ ok: false, pesan: 'Badan bukan JSON sah' }, { status: 400 });
  }

  if (!isBadanEntri(parsed)) {
    return NextResponse.json(
      { ok: false, pesan: 'Badan wajib berisi clientId, rak, productId, qtySatuan, expired' },
      { status: 400 },
    );
  }

  if (!isRakNyata(parsed.rak)) {
    return NextResponse.json({ ok: false, pesan: 'Rak tidak dikenal.' }, { status: 400 });
  }

  if (parsed.expired !== null && !REGEX_TANGGAL.test(parsed.expired)) {
    return NextResponse.json(
      { ok: false, pesan: 'Tanggal kadaluarsa wajib format YYYY-MM-DD atau dikosongkan.' },
      { status: 400 },
    );
  }

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
    const res = await stub.fetch('https://do/entri/simpan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clientId: parsed.clientId,
        pengguna: pengguna.username,
        rak: parsed.rak,
        productId: parsed.productId,
        namaProduk: produk.nama,
        satuan: hasilSatuan.satuan,
        expired: parsed.expired,
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
  if (!canAccess(pengguna.peran, PERMISSIONS.MULAI_SO)) {
    return NextResponse.json({ ok: false, pesan: 'Tidak berwenang mencatat SO' }, { status: 403 });
  }

  const url = new URL(request.url);
  const rak = url.searchParams.get('rak');
  if (!rak || !isRakNyata(rak)) {
    return NextResponse.json({ ok: false, pesan: 'Rak tidak dikenal.' }, { status: 400 });
  }

  const { env } = getCloudflareContext();
  try {
    const stub = env.BUKU.get(env.BUKU.idFromName('buku'));
    const res = await stub.fetch(
      `https://do/entri/daftar?rak=${encodeURIComponent(rak)}&pengguna=${encodeURIComponent(pengguna.username)}`,
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
  if (!canAccess(pengguna.peran, PERMISSIONS.MULAI_SO)) {
    return NextResponse.json({ ok: false, pesan: 'Tidak berwenang mencatat SO' }, { status: 403 });
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
    const res = await stub.fetch('https://do/entri/hapus', {
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
