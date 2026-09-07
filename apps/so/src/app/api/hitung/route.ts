import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getCurrentUser, canAccess, PERMISSIONS } from '@/lib/session';
import { isKodeLokasi, LOKASI_NYATA, type KodeLokasi } from '@/lib/lokasi';
import { saldoDiLokasi } from '@/lib/saldo';
import { petaProdukRingkas } from '@/lib/katalog';
import { keQtyPokok } from '@/lib/mutasi';
import { bacaLogBulanIni, menyelipSejak } from '@/lib/log-terkini';
import {
  periksaHitung,
  deltaKePenyesuaian,
  ringkasMenyelip,
  type BarisHitung,
} from '@/lib/opname';
import {
  bacaSesi,
  bacaTinjau,
  tambahSesi,
  ubahSesi,
  tambahTinjau,
  namaTabLog,
  type BarisTinjau,
} from '@kartini/sheets';

export const dynamic = 'force-dynamic';

const BATAS_BARIS_KIRIM = 300;
const PERAN_BOLEH_KIRIM_ORANG_LAIN = ['OWNER', 'ADMIN', 'SUPERVISOR'];

interface BadanMulai {
  aksi: 'mulai';
  lokasi: string;
}

interface BarisKirimMasukan {
  productId: string;
  qtyInput: number;
  satuanInput: string;
}

interface BadanKirim {
  aksi: 'kirim';
  sesiId: number;
  baris: BarisKirimMasukan[];
}

interface BadanBatal {
  aksi: 'batal';
  sesiId: number;
}

type Badan = BadanMulai | BadanKirim | BadanBatal;

// Cuplikan saldo yang dikunci saat 'mulai' — lihat penjelasan di aksi 'mulai'
// kenapa ini tidak boleh diganti membaca saldo terkini saat 'kirim'.
interface CuplikanSesi {
  lokasi: string;
  waktuSaldo: string;
  /** `id` Log terakhir yang sudah ikut terhitung di angka `qty` di bawah.
   *  Batas mutasi menyelip memakai angka ini, bukan `waktuSaldo`: cap waktu
   *  saldo diambil sebelum Log dibaca, jadi baris yang masuk di sela itu sudah
   *  ikut terjumlah padahal waktunya lebih baru — memakai waktu sebagai batas
   *  membuat baris itu terhitung dua kali. */
  idSaldo: number;
  qty: Record<string, number>;
}

function isBarisKirimMasukan(value: unknown): value is BarisKirimMasukan {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.productId === 'string' &&
    typeof r.qtyInput === 'number' &&
    typeof r.satuanInput === 'string'
  );
}

function isObjek(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBadanMulai(value: unknown): value is BadanMulai {
  return isObjek(value) && value.aksi === 'mulai' && typeof value.lokasi === 'string';
}

function isBadanKirim(value: unknown): value is BadanKirim {
  return (
    isObjek(value) &&
    value.aksi === 'kirim' &&
    typeof value.sesiId === 'number' &&
    Array.isArray(value.baris) &&
    value.baris.every(isBarisKirimMasukan)
  );
}

function isBadanBatal(value: unknown): value is BadanBatal {
  return isObjek(value) && value.aksi === 'batal' && typeof value.sesiId === 'number';
}

function isBadan(value: unknown): value is Badan {
  return isBadanMulai(value) || isBadanKirim(value) || isBadanBatal(value);
}

export async function GET(): Promise<NextResponse> {
  const pengguna = await getCurrentUser();
  if (!pengguna) {
    return NextResponse.json({ ok: false, pesan: 'Sesi berakhir, masuk lagi.' }, { status: 401 });
  }

  if (!canAccess(pengguna.peran, PERMISSIONS.MULAI_SO)) {
    return NextResponse.json({ ok: false, pesan: 'Tidak berwenang menghitung stok' }, { status: 403 });
  }

  const sheetId = process.env.SHEET_OPS_ID;
  if (!sheetId) {
    return NextResponse.json(
      { ok: false, pesan: 'Sistem belum siap. Hubungi admin.' },
      { status: 503 }
    );
  }

  const semuaSesi = await bacaSesi(sheetId);
  const sesiBerjalan = semuaSesi.filter(
    (s) => s.status === 'BERJALAN' && s.user === pengguna.username
  );
  let sesi = sesiBerjalan[0];
  for (const s of sesiBerjalan) {
    if (!sesi || s.id > sesi.id) sesi = s;
  }

  if (!sesi) {
    return NextResponse.json({ ok: true, sesi: null });
  }

  const env = getCloudflareContext().env;
  const cuplikan = await env.KATALOG.get<CuplikanSesi>(`sesi:${sesi.id}`, 'json');

  // Cuplikan hilang (TTL 24 jam lewat) bukan error — sesi tetap ada di Sheets,
  // cuma saldo pembanding yang sudah tidak bisa ditampilkan ulang.
  if (!cuplikan) {
    return NextResponse.json({
      ok: true,
      sesi: { id: sesi.id, lokasi: sesi.lokasi, waktuMulai: sesi.waktuMulai, waktuSaldo: null },
      saldo: [],
      cuplikanHilang: true,
    });
  }

  const saldo = Object.entries(cuplikan.qty).map(([productId, qty]) => ({ productId, qty }));

  return NextResponse.json({
    ok: true,
    sesi: { id: sesi.id, lokasi: sesi.lokasi, waktuMulai: sesi.waktuMulai, waktuSaldo: cuplikan.waktuSaldo },
    saldo,
    cuplikanHilang: false,
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  // Alamat workers.dev ini publik dan jatah CPU paket gratis cuma 10 ms —
  // penjaga sesi wajib mendahului penguraian badan, bukan menyusul.
  const pengguna = await getCurrentUser();
  if (!pengguna) {
    return NextResponse.json({ ok: false, pesan: 'Sesi berakhir, masuk lagi.' }, { status: 401 });
  }

  if (!canAccess(pengguna.peran, PERMISSIONS.MULAI_SO)) {
    return NextResponse.json({ ok: false, pesan: 'Tidak berwenang menghitung stok' }, { status: 403 });
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ ok: false, pesan: 'Badan bukan JSON sah' }, { status: 400 });
  }

  if (!isBadan(parsed)) {
    return NextResponse.json({ ok: false, pesan: 'Bentuk badan tidak dikenal' }, { status: 400 });
  }

  const sheetId = process.env.SHEET_OPS_ID;
  if (!sheetId) {
    return NextResponse.json(
      { ok: false, pesan: 'Sistem belum siap. Hubungi admin.' },
      { status: 503 }
    );
  }

  const { env } = getCloudflareContext();

  if (parsed.aksi === 'mulai') {
    return handleMulai(parsed, pengguna.username, sheetId, env);
  }

  if (parsed.aksi === 'kirim') {
    return handleKirim(parsed, pengguna, sheetId, env);
  }

  return handleBatal(parsed, sheetId, env);
}

async function handleMulai(
  badan: BadanMulai,
  username: string,
  sheetId: string,
  env: ReturnType<typeof getCloudflareContext>['env']
): Promise<NextResponse> {
  // Lokasi maya (Barang Datang / Barang Rusak) tidak punya saldo — tidak ada
  // yang bisa dihitung fisik di situ.
  if (!isKodeLokasi(badan.lokasi) || !LOKASI_NYATA.includes(badan.lokasi)) {
    return NextResponse.json({ ok: false, pesan: 'Lokasi tidak valid untuk dihitung.' }, { status: 400 });
  }
  const lokasi: KodeLokasi = badan.lokasi;

  const saldo = await saldoDiLokasi(lokasi);
  if (!saldo) {
    return NextResponse.json(
      { ok: false, pesan: 'Saldo belum pernah dihitung. Tunggu penyegaran berikutnya.' },
      { status: 503 }
    );
  }

  const sesiId = await tambahSesi(sheetId, {
    waktuMulai: new Date().toISOString(),
    waktuSaldo: saldo.waktu,
    waktuKirim: null,
    lokasi,
    user: username,
    status: 'BERJALAN',
    jumlahBaris: null,
    catatan: null,
  });

  const qty: Record<string, number> = {};
  const saldoBalasan: { productId: string; qty: number }[] = [];
  for (const [productId, jumlah] of saldo.peta) {
    if (jumlah === 0) continue;
    qty[productId] = jumlah;
    saldoBalasan.push({ productId, qty: jumlah });
  }

  const cuplikan: CuplikanSesi = { lokasi, waktuSaldo: saldo.waktu, idSaldo: saldo.idTerakhir, qty };
  // Angka pembanding dikunci di sini, bukan dibaca ulang saat 'kirim' — saldo
  // KV disegarkan cron tiap 10 menit, kalau dibaca ulang mutasi yang menyelip
  // di antara mulai dan kirim bisa terhitung dua kali.
  await env.KATALOG.put(`sesi:${sesiId}`, JSON.stringify(cuplikan), { expirationTtl: 86400 });

  return NextResponse.json({
    ok: true,
    sesiId,
    waktuSaldo: saldo.waktu,
    lokasi,
    saldo: saldoBalasan,
  });
}

async function handleKirim(
  badan: BadanKirim,
  pengguna: { username: string; peran: string },
  sheetId: string,
  env: ReturnType<typeof getCloudflareContext>['env']
): Promise<NextResponse> {
  if (badan.baris.length === 0) {
    return NextResponse.json({ ok: false, pesan: 'Kiriman tidak boleh kosong.' }, { status: 400 });
  }
  if (badan.baris.length > BATAS_BARIS_KIRIM) {
    return NextResponse.json(
      { ok: false, pesan: `Kiriman terlalu besar, maksimal ${BATAS_BARIS_KIRIM} baris sekali kirim` },
      { status: 400 }
    );
  }

  const semuaSesi = await bacaSesi(sheetId);
  const sesi = semuaSesi.find((s) => s.id === badan.sesiId);
  if (!sesi) {
    return NextResponse.json({ ok: false, pesan: 'Sesi tidak ditemukan.' }, { status: 404 });
  }

  // Penjaga kirim ganda — sesi yang sudah SELESAI/DITINJAU/DIBATALKAN tidak
  // boleh dikirim ulang lewat jalur ini.
  if (sesi.status !== 'BERJALAN') {
    return NextResponse.json({ ok: false, pesan: 'Sesi ini sudah ditutup.' }, { status: 409 });
  }

  if (sesi.user !== pengguna.username && !PERAN_BOLEH_KIRIM_ORANG_LAIN.includes(pengguna.peran)) {
    return NextResponse.json(
      { ok: false, pesan: 'Tidak berwenang mengirim sesi milik orang lain.' },
      { status: 403 }
    );
  }

  const cuplikan = await env.KATALOG.get<CuplikanSesi>(`sesi:${badan.sesiId}`, 'json');
  if (!cuplikan) {
    return NextResponse.json(
      { ok: false, pesan: 'Cuplikan sesi sudah kedaluwarsa. Ulangi hitung dari awal.' },
      { status: 409 }
    );
  }

  // Riwayat dipecah per bulan; sesi yang melewati pergantian bulan
  // membandingkan angka dari dua buku berbeda.
  if (namaTabLog(new Date(sesi.waktuSaldo)) !== namaTabLog(new Date())) {
    return NextResponse.json(
      { ok: false, pesan: 'Sesi melewati pergantian bulan. Ulangi hitung.' },
      { status: 409 }
    );
  }

  const idsUnik = [...new Set(badan.baris.map((b) => b.productId))];
  const peta = await petaProdukRingkas(idsUnik);

  interface BarisValid extends BarisHitung {
    satuanInput: string;
    qtyInput: number;
  }

  const ditolak: { productId: string; pesan: string }[] = [];
  const barisValid: BarisValid[] = [];
  const sudahDilihat = new Set<string>();

  for (const b of badan.baris) {
    // Dua hasil hitung untuk barang yang sama tidak bisa diputuskan mesin.
    if (sudahDilihat.has(b.productId)) {
      ditolak.push({ productId: b.productId, pesan: 'Produk ini sudah dihitung di kiriman ini.' });
      continue;
    }
    sudahDilihat.add(b.productId);

    const produk = peta.get(b.productId);
    if (!produk) {
      ditolak.push({ productId: b.productId, pesan: 'Barang tidak ada di katalog atau datanya belum lengkap.' });
      continue;
    }

    if (!Number.isFinite(b.qtyInput) || b.qtyInput < 0) {
      ditolak.push({ productId: b.productId, pesan: 'Jumlah hitung harus angka tidak negatif.' });
      continue;
    }

    const qtyPokok = keQtyPokok(b.qtyInput, b.satuanInput, produk.satuan);
    if (qtyPokok === null) {
      ditolak.push({ productId: b.productId, pesan: `Satuan "${b.satuanInput}" tidak dikenal untuk produk ini.` });
      continue;
    }

    barisValid.push({
      productId: b.productId,
      nama: produk.nama,
      qtyHitung: qtyPokok,
      qtyTerlihat: cuplikan.qty[b.productId] ?? 0,
      satuanInput: b.satuanInput,
      qtyInput: b.qtyInput,
    });
  }

  const log = await bacaLogBulanIni(sheetId);
  const setProduk = new Set(barisValid.map((b) => b.productId));
  const menyelipPerProduk = menyelipSejak(log, cuplikan.idSaldo, sesi.lokasi, setProduk);
  const hasilPeriksa = periksaHitung(barisValid, menyelipPerProduk);

  const infoBaris = new Map(barisValid.map((b) => [b.productId, b]));
  const lokasi = sesi.lokasi as KodeLokasi;

  const barisPenulis: {
    clientId: string;
    jenis: 'OPNAME';
    productId: string;
    namaSaatItu: string;
    qtyPokok: number;
    satuanInput: string;
    qtyInput: number;
    dari: KodeLokasi | null;
    ke: KodeLokasi | null;
    sebab: null;
    catatan: string;
    qtyTerlihat: number;
    sesiId: string;
  }[] = [];
  const barisTinjau: Omit<BarisTinjau, 'id' | 'barisSheet'>[] = [];
  let takBerubah = 0;

  for (const hasil of hasilPeriksa) {
    if (hasil.bentrok) {
      barisTinjau.push({
        sesiId: badan.sesiId,
        productId: hasil.productId,
        nama: hasil.nama,
        lokasi: sesi.lokasi,
        qtyHitung: hasil.qtyHitung,
        qtyTerlihat: hasil.qtyTerlihat,
        qtySistem: hasil.qtySistem,
        mutasiMenyelip: ringkasMenyelip(hasil.menyelip),
        status: 'MENUNGGU',
        keputusan: null,
        userTinjau: null,
        waktuTinjau: null,
      });
      continue;
    }

    const penyesuaian = deltaKePenyesuaian(
      hasil.productId,
      hasil.nama,
      lokasi,
      hasil.delta ?? 0,
      hasil.qtyTerlihat
    );
    if (penyesuaian === null) {
      takBerubah += 1;
      continue;
    }

    const asal = infoBaris.get(hasil.productId);
    if (!asal) continue; // tidak mungkin — hasilPeriksa berasal dari barisValid

    barisPenulis.push({
      // Deterministik dan wajib begini: ini satu-satunya yang mencegah
      // kiriman yang diulang menyesuaikan stok dua kali.
      // Waktu mulai sesi ikut masuk kunci, bukan cuma id-nya. Id sesi adalah
      // `max(id)+1` dari Sesi_SO, jadi menghapus baris di spreadsheet -- yang
      // memang diizinkan -- membuat id lama terpakai lagi. Tanpa waktu di sini,
      // penyesuaian stok yang sah dari sesi baru itu ditolak diam-diam sebagai
      // kiriman kembar, dan tidak ada apa pun di hilir yang menandainya.
      clientId: `opname-${badan.sesiId}-${sesi.waktuMulai}-${hasil.productId}`,
      jenis: 'OPNAME',
      productId: hasil.productId,
      namaSaatItu: hasil.nama,
      // Untuk baris OPNAME, qtyPokok adalah BESAR PENYESUAIAN (delta), bukan
      // qtyInput dikali pengali — beda arti dari baris mutasi biasa.
      qtyPokok: penyesuaian.qtyPokok,
      satuanInput: asal.satuanInput,
      qtyInput: asal.qtyInput,
      dari: penyesuaian.dari,
      ke: penyesuaian.ke,
      sebab: null,
      catatan: `Hitung stok #${badan.sesiId}`,
      qtyTerlihat: hasil.qtySistem,
      sesiId: String(badan.sesiId),
    });
  }

  if (barisPenulis.length > 0) {
    try {
      const stub = env.PENULIS.get(env.PENULIS.idFromName('penulis'));
      const res = await stub.fetch('https://do/tulis', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sheetId, user: pengguna.username, baris: barisPenulis }),
      });
      if (!res.ok) {
        throw new Error(`DO membalas status ${res.status}`);
      }
    } catch {
      // Sesi TETAP BERJALAN, jangan ubah jadi SELESAI — clientId deterministik
      // menjaga pengiriman ulang supaya tidak menyesuaikan stok dua kali.
      return NextResponse.json(
        { ok: false, pesan: 'Penyesuaian belum tersimpan, coba kirim ulang.' },
        { status: 502 }
      );
    }
  }

  if (barisTinjau.length > 0) {
    // Baris tinjauan tidak punya kunci deterministik seperti clientId di Log.
    // Kalau `tambahTinjau` sempat mendarat lalu jawabannya hilang, kiriman ulang
    // akan menggandakannya — dan dua baris kembar bisa diputus dua kali, yang
    // berarti stok disesuaikan dua kali. Satu bacaan tambahan di jalur bentrok
    // (jarang) jauh lebih murah daripada stok yang salah diam-diam.
    const sudahAda = new Set(
      (await bacaTinjau(sheetId))
        .filter((t) => t.sesiId === badan.sesiId)
        .map((t) => t.productId),
    );
    const belumAda = barisTinjau.filter((t) => !sudahAda.has(t.productId));
    if (belumAda.length > 0) {
      await tambahTinjau(sheetId, belumAda);
    }
  }

  const adaBentrok = barisTinjau.length > 0;
  await ubahSesi(sheetId, badan.sesiId, {
    status: adaBentrok ? 'DITINJAU' : 'SELESAI',
    waktuKirim: new Date().toISOString(),
    jumlahBaris: barisValid.length,
  });

  return NextResponse.json({
    ok: true,
    sesiId: badan.sesiId,
    diterapkan: barisPenulis.length,
    takBerubah,
    ditinjau: barisTinjau.length,
    ditolak,
  });
}

async function handleBatal(
  badan: BadanBatal,
  sheetId: string,
  env: ReturnType<typeof getCloudflareContext>['env']
): Promise<NextResponse> {
  const semuaSesi = await bacaSesi(sheetId);
  const sesi = semuaSesi.find((s) => s.id === badan.sesiId);
  if (!sesi) {
    return NextResponse.json({ ok: false, pesan: 'Sesi tidak ditemukan.' }, { status: 404 });
  }
  if (sesi.status !== 'BERJALAN') {
    return NextResponse.json({ ok: false, pesan: 'Sesi ini sudah ditutup.' }, { status: 409 });
  }

  await ubahSesi(sheetId, badan.sesiId, {
    status: 'DIBATALKAN',
    waktuKirim: new Date().toISOString(),
  });
  await env.KATALOG.delete(`sesi:${badan.sesiId}`);

  return NextResponse.json({ ok: true, sesiId: badan.sesiId });
}
