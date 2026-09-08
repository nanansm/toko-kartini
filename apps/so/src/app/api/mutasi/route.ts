import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getCurrentUser, canAccess, PERMISSIONS } from '@/lib/session';
import { isKodeLokasi } from '@/lib/lokasi';
import { ARAH_SAH, LABEL_SEBAB, type JenisMutasi, type SebabRusak } from '@/lib/mutasi';
import { petaProdukRingkas, type ProdukRingkas } from '@/lib/katalog';

export const dynamic = 'force-dynamic';

const BATAS_NOTA = 200;
// Batas baris per kiriman borongan -- pengirim latar di HP menumpuk antrean
// luring, tapi satu Worker invocation tetap wajib selesai cepat.
const BATAS_BORONGAN = 50;

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
  // Kunci qtySatuan boleh SKU ATAU nama satuan. Bukan kelonggaran yang
  // sembarangan: katalog luring di HP (IndexedDB, lihat lib/katalog-lokal.ts)
  // menyimpan satuan TANPA sku, jadi layar pencatatan yang sedang tidak dapat
  // sinyal -- justru keadaan yang jalur ini dibuat untuk menanganinya -- secara
  // fisik tidak bisa mengirim SKU. Menolak nama berarti tiap catatan dari
  // Gudang Ciherang gagal, dan gagalnya baru ketahuan saat sinyal kembali.
  //
  // Nama kembar diselesaikan dengan aturan yang SAMA dengan satuanTampil() di
  // klien: yang dipakai pengali TERKECIL. Kalau aturannya beda, angka yang
  // dilihat staf di layar tidak sama dengan yang masuk buku besar.
  const perNama = new Map<string, ProdukRingkas['satuan'][number]>();
  for (const s of produk.satuan) {
    const kunci = s.nama.trim().toLowerCase();
    const lama = perNama.get(kunci);
    if (!lama || s.pengali < lama.pengali) perNama.set(kunci, s);
  }

  const perSku = new Map<string, number>();
  for (const [kunci, qty] of Object.entries(qtySatuan)) {
    const tingkat =
      produk.satuan.find((s) => s.sku === kunci) ?? perNama.get(kunci.trim().toLowerCase());
    if (!tingkat) {
      return { ok: false, pesan: `Satuan "${kunci}" tidak dikenal untuk produk ini.` };
    }
    if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty < 0) {
      return { ok: false, pesan: `Jumlah untuk "${tingkat.nama}" wajib bilangan bulat, minimal nol.` };
    }
    perSku.set(tingkat.sku, (perSku.get(tingkat.sku) ?? 0) + qty);
  }

  // SELURUH satuan produk disimpan, termasuk yang qty-nya 0, dan urutannya
  // mengikuti katalog (satuan Grosir lebih dulu). Ini bukan pemborosan:
  // `baseUnitOf` milik tim memilih satuan pertama yang pengalinya 1 dari
  // daftar ini, dan itulah yang mengisi kolom Satuan + SKU di tab Log dan
  // Mutasi. Kalau yang qty-nya 0 dibuang, staf yang cuma mengisi karton akan
  // menghasilkan baris ber-SKU karton, sementara aplikasi tim menulis SKU
  // satuan dasar untuk kejadian yang sama — dan skrip hilir mereka mencocokkan
  // SKU itu. Rincian tetap benar karena baris qty 0 disaring saat dirangkai.
  const satuan: SatuanQty[] = produk.satuan.map((t) => ({
    sku: t.sku,
    nama: t.nama,
    pengali: t.pengali,
    qty: perSku.get(t.sku) ?? 0,
  }));

  if (satuan.every((s) => s.qty === 0)) {
    return { ok: false, pesan: 'Isi minimal satu satuan.' };
  }
  return { ok: true, satuan };
}

type SiapKirim = { ok: true; muatan: Record<string, unknown> } | { ok: false; pesan: string };

// Validasi murni satu baris mutasi -- dipakai mode satuan MAUPUN tiap elemen
// mode borongan, supaya urutan pemeriksaan dan teks pesan galat cuma ada di
// satu tempat. Sengaja tidak menyentuh jaringan/DO sama sekali.
function siapkanMutasi(badan: BadanMutasi, username: string, peta: Map<string, ProdukRingkas>): SiapKirim {
  if (!JENIS_SAH.includes(badan.jenis)) {
    return { ok: false, pesan: `Jenis mutasi "${badan.jenis}" tidak dikenal.` };
  }
  const jenis = badan.jenis as JenisMutasi;
  const arahSah = ARAH_SAH[jenis];

  if (!isKodeLokasi(badan.dari) || !arahSah.dari.includes(badan.dari)) {
    return {
      ok: false,
      pesan: `Lokasi asal tidak valid. Yang diizinkan: ${arahSah.dari.join(', ')}.`,
    };
  }
  const dari = badan.dari;

  if (!isKodeLokasi(badan.ke) || !arahSah.ke.includes(badan.ke)) {
    return {
      ok: false,
      pesan: `Lokasi tujuan tidak valid. Yang diizinkan: ${arahSah.ke.join(', ')}.`,
    };
  }
  const ke = badan.ke;

  if (dari === ke) {
    return { ok: false, pesan: 'Lokasi asal dan tujuan tidak boleh sama.' };
  }

  const sebabMentah = badan.sebab?.trim() ?? '';
  let sebab: SebabRusak | null = null;
  if (jenis === 'RUSAK') {
    if (!SEBAB_SAH.includes(sebabMentah)) {
      return { ok: false, pesan: 'Sebab barang rusak wajib dipilih.' };
    }
    sebab = sebabMentah as SebabRusak;
  } else if (sebabMentah !== '') {
    return { ok: false, pesan: 'Sebab tidak boleh diisi untuk jenis mutasi ini.' };
  }

  const nota = badan.nota.slice(0, BATAS_NOTA);

  const produk = peta.get(badan.productId);
  if (!produk) {
    return { ok: false, pesan: 'Barang tidak ada di katalog atau datanya belum lengkap.' };
  }

  const hasilSatuan = bangunSatuan(badan.qtySatuan, produk);
  if (!hasilSatuan.ok) {
    return { ok: false, pesan: hasilSatuan.pesan };
  }

  return {
    ok: true,
    muatan: {
      clientId: badan.clientId,
      pengguna: username,
      jenis,
      dari,
      ke,
      nota,
      sebab: sebab ?? '',
      productId: badan.productId,
      namaProduk: produk.nama,
      satuan: hasilSatuan.satuan,
    },
  };
}

function isBadanBorongan(value: unknown): value is { baris: unknown[] } {
  if (typeof value !== 'object' || value === null) return false;
  return Array.isArray((value as Record<string, unknown>).baris);
}

// Baris yang gagal isBadanMutasi tidak punya clientId yang bisa dipercaya --
// ambil apa adanya kalau bertipe string, selain itu string kosong.
function ambilClientIdKasar(value: unknown): string {
  if (typeof value !== 'object' || value === null) return '';
  const clientId = (value as Record<string, unknown>).clientId;
  return typeof clientId === 'string' ? clientId : '';
}

interface HasilBorongan {
  ok: boolean;
  diterima: string[];
  duplikat: string[];
  tertunda: string[];
  ditolak: { clientId: string; pesan: string }[];
}

async function prosesBorongan(barisMentah: unknown[], username: string): Promise<NextResponse> {
  if (barisMentah.length === 0) {
    return NextResponse.json({ ok: false, pesan: 'Tidak ada baris untuk dicatat.' }, { status: 400 });
  }
  if (barisMentah.length > BATAS_BORONGAN) {
    return NextResponse.json({ ok: false, pesan: 'Terlalu banyak baris dalam satu kiriman.' }, { status: 400 });
  }

  const diterima: string[] = [];
  const duplikat: string[] = [];
  const ditolak: { clientId: string; pesan: string }[] = [];
  const barisSah: BadanMutasi[] = [];

  for (const item of barisMentah) {
    if (!isBadanMutasi(item)) {
      ditolak.push({ clientId: ambilClientIdKasar(item), pesan: 'Bentuk baris tidak sah.' });
      continue;
    }
    barisSah.push(item);
  }

  // Katalog diambil SEKALI untuk seluruh productId dalam kiriman -- tiap
  // panggilan petaProdukRingkas membaca ulang 181 KB dari KV, jadi memanggil
  // per baris akan membakar CPU Worker percuma.
  const ids = [...new Set(barisSah.map((b) => b.productId))];
  const peta = await petaProdukRingkas(ids);

  const muatanSiap: Record<string, unknown>[] = [];
  for (const badan of barisSah) {
    const hasil = siapkanMutasi(badan, username, peta);
    if (!hasil.ok) {
      ditolak.push({ clientId: badan.clientId, pesan: hasil.pesan });
      continue;
    }
    muatanSiap.push(hasil.muatan);
  }

  const { env } = getCloudflareContext();
  const stub = env.BUKU.get(env.BUKU.idFromName('buku'));

  for (const muatan of muatanSiap) {
    const clientId = typeof muatan.clientId === 'string' ? muatan.clientId : '';
    try {
      const res = await stub.fetch('https://do/mutasi/simpan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(muatan),
      });
      const badanRes: unknown = await res.json();
      const jawab =
        typeof badanRes === 'object' && badanRes !== null
          ? (badanRes as Record<string, unknown>)
          : {};
      if (jawab.ok === true && jawab.sudahDiunggah === true) {
        duplikat.push(clientId);
      } else if (jawab.ok === true) {
        diterima.push(clientId);
      } else {
        ditolak.push({ clientId, pesan: typeof jawab.pesan === 'string' ? jawab.pesan : 'Gagal menyimpan.' });
      }
    } catch {
      // DO tak terjangkau di tengah jalan -- hentikan sisa baris dan balas
      // 502, BUKAN 200, supaya pengirim latar di HP tahu baris ini (dan
      // sisanya yang belum dikirim) belum boleh dibuang dari antrean.
      return NextResponse.json(
        { ok: false, pesan: 'Pencatatan belum tersimpan, akan dicoba lagi.' },
        { status: 502 },
      );
    }
  }

  const hasil: HasilBorongan = {
    ok: diterima.length + duplikat.length > 0,
    diterima,
    duplikat,
    tertunda: [],
    ditolak,
  };
  return NextResponse.json(hasil, { status: hasil.ok ? 200 : 400 });
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

  if (isBadanBorongan(parsed)) {
    return prosesBorongan(parsed.baris, pengguna.username);
  }

  if (!isBadanMutasi(parsed)) {
    return NextResponse.json(
      { ok: false, pesan: 'Badan wajib berisi clientId, jenis, dari, ke, nota, sebab, productId, qtySatuan' },
      { status: 400 },
    );
  }

  const peta = await petaProdukRingkas([parsed.productId]);
  const hasil = siapkanMutasi(parsed, pengguna.username, peta);
  if (!hasil.ok) {
    return NextResponse.json({ ok: false, pesan: hasil.pesan }, { status: 400 });
  }

  const { env } = getCloudflareContext();
  try {
    const stub = env.BUKU.get(env.BUKU.idFromName('buku'));
    const res = await stub.fetch('https://do/mutasi/simpan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(hasil.muatan),
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
