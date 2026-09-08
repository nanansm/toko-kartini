import { NextResponse } from 'next/server';
import { tulisUlangTab } from '@kartini/sheets';
import { getCurrentUser, canAccess, PERMISSIONS } from '@/lib/session';
import { ambilKatalogRingkas } from '@/lib/katalog';
import { susun, JUDUL_JUAL, type BarisJual, type ProdukJual } from '@/lib/penjualan/susun';

export const dynamic = 'force-dynamic';

// Tab tujuan dikunci ke dua nama saja. `Penjualan` yang sungguhan dipakai
// `saldo_display` untuk menghitung sisa Area Display; `Penjualan Uji` disediakan
// supaya hasil impor bisa dibandingkan dulu tanpa menyentuh angka yang sedang
// dipakai. Nama tab TIDAK boleh datang bebas dari HP: satu salah ketik berarti
// `tulisUlangTab` mengosongkan tab lain sebelum menulis.
const TAB_SAH: readonly string[] = ['Penjualan', 'Penjualan Uji'];
const TAB_BAKU = 'Penjualan';

// Satu export sepekan di toko ini sekitar 2.500 baris. Batas ini bukan soal
// ukuran permintaan (Workers jauh lebih longgar) tapi rem kalau ada yang
// mengunggah berkas yang salah — misalnya export setahun penuh yang akan
// mengganti seluruh tab dengan data yang tidak dimaksud.
const BATAS_BARIS = 60000;

interface BadanImpor {
  baris: BarisJual[];
  tab?: string;
  konfirmasi: boolean;
}

function isBarisJual(value: unknown): value is BarisJual {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.tanggal === 'string' &&
    typeof r.sku === 'string' &&
    typeof r.produk === 'string' &&
    typeof r.qty === 'number' &&
    Number.isFinite(r.qty) &&
    typeof r.omzet === 'number' &&
    Number.isFinite(r.omzet) &&
    typeof r.lunas === 'boolean' &&
    typeof r.pelanggan === 'string'
  );
}

function isBadanImpor(value: unknown): value is BadanImpor {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  if (!Array.isArray(r.baris)) return false;
  if (typeof r.konfirmasi !== 'boolean') return false;
  if (r.tab !== undefined && typeof r.tab !== 'string') return false;
  return r.baris.every(isBarisJual);
}

export async function POST(request: Request): Promise<NextResponse> {
  // Penjaga sesi mendahului penguraian badan dan selalu membalas JSON, sama
  // seperti route tulis lainnya.
  const pengguna = await getCurrentUser();
  if (!pengguna) {
    return NextResponse.json({ ok: false, pesan: 'Sesi berakhir, masuk lagi.' }, { status: 401 });
  }
  // Impor mengganti SELURUH isi tab Penjualan, dan angka itu yang menentukan
  // sisa Area Display. Sengaja dipagari sama ketatnya dengan kelola pengguna,
  // bukan sekadar izin mencatat mutasi.
  if (!canAccess(pengguna.peran, PERMISSIONS.KELOLA_PENGGUNA)) {
    return NextResponse.json(
      { ok: false, pesan: 'Tidak berwenang mengimpor penjualan' },
      { status: 403 },
    );
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ ok: false, pesan: 'Badan bukan JSON sah' }, { status: 400 });
  }

  if (!isBadanImpor(parsed)) {
    return NextResponse.json(
      { ok: false, pesan: 'Badan wajib berisi baris[] (tanggal, sku, produk, qty, omzet, lunas, pelanggan) dan konfirmasi.' },
      { status: 400 },
    );
  }

  const tab = parsed.tab ?? TAB_BAKU;
  if (!TAB_SAH.includes(tab)) {
    return NextResponse.json(
      { ok: false, pesan: `Tab "${tab}" tidak boleh jadi tujuan impor.` },
      { status: 400 },
    );
  }

  // Larik kosong ditolak, BUKAN diteruskan. Meneruskannya berarti mengosongkan
  // tab Penjualan sampai tinggal judul — dan sisa display seluruh toko langsung
  // ikut salah tanpa satu pun tanda bahaya.
  if (parsed.baris.length === 0) {
    return NextResponse.json(
      { ok: false, pesan: 'Tidak ada baris untuk diimpor. Tab Penjualan tidak diubah.' },
      { status: 400 },
    );
  }
  if (parsed.baris.length > BATAS_BARIS) {
    return NextResponse.json(
      { ok: false, pesan: `Terlalu banyak baris (${parsed.baris.length}). Impor per rentang tanggal yang lebih pendek.` },
      { status: 400 },
    );
  }

  const sheetId = process.env.SHEET_SO_ID;
  if (!sheetId) {
    return NextResponse.json(
      { ok: false, pesan: 'SHEET_SO_ID belum diset di Worker.' },
      { status: 500 },
    );
  }

  const katalog = await ambilKatalogRingkas();
  if (!katalog) {
    return NextResponse.json(
      { ok: false, pesan: 'Katalog belum tersedia. Tunggu penyegaran cron, lalu coba lagi.' },
      { status: 503 },
    );
  }

  // SKU POS itu SKU per satuan (`PKG-0053-G` = Krtn, `-2` = Pack, `-3` = Pcs),
  // jadi satu produk menyumbang beberapa entri ke peta ini. Itu yang membuat
  // pencocokan lewat nama + satuan tidak diperlukan lagi.
  const produk = new Map<string, ProdukJual>();
  for (const p of katalog.produk) {
    for (const t of p.satuan) {
      if (!t.sku) continue;
      produk.set(t.sku, { namaProduk: p.nama, satuan: t.nama, pengali: t.pengali });
    }
  }

  const { baris, ringkas } = susun(parsed.baris, produk);

  // Tanpa konfirmasi, ini pratinjau: hitungannya dikembalikan, tab tidak
  // disentuh sama sekali. Operator melihat dulu berapa yang cocok dan berapa
  // yang gagal sebelum menukar isi tab.
  if (!parsed.konfirmasi) {
    return NextResponse.json({ ok: true, ditulis: false, tab, ringkas }, { status: 200 });
  }

  try {
    await tulisUlangTab(sheetId, tab, JUDUL_JUAL, baris);
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        pesan: `Gagal menulis tab ${tab}: ${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, ditulis: true, tab, ringkas }, { status: 200 });
}
