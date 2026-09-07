import { readSheet, parsePricelist } from '@kartini/sheets';
import type { ProdukSheet } from '@kartini/sheets';
import { hitungSaldo, cadangkanLog } from './saldo';
import { tutupBulan } from './bulan';

interface Env {
  KATALOG: KVNamespace;
}

// Dinaikkan setiap kali BENTUK data di KV berubah. Ikut masuk ke sidik supaya
// perubahan bentuk memaksa penulisan ulang, walau isi Pricelist-nya sama persis.
const VERSI_BENTUK = 2;

// Parser membaca kolom berdasarkan POSISI, bukan nama, karena baris header punya
// empat kolom bernama "SKU" yang identik. Konsekuensinya satu kolom yang disisipkan
// di spreadsheet membuat seluruh katalog salah tanpa jumlah barisnya berubah —
// gerbang penyusutan tidak akan menangkapnya. Karena itu posisi kolom yang dipakai
// parser diperiksa dulu terhadap label yang seharusnya ada di sana.
const HEADER_DIHARAPKAN: Array<[number, string]> = [
  [0, 'category'],
  [3, 'nama barang'],
  [4, 'suplier'],
  [5, 'hpp grosir'],
  [6, 'satuan grosir'],
  [7, 'banyaknya'],
  [28, 'sku'],
];

// Bentuk ramping untuk layar pencatatan: cuma yang dibutuhkan buat mencari dan
// memilih barang. Catatan lengkapnya 412 KB, dan mengurai segitu di tiap
// permintaan staf membakar CPU untuk kolom yang tidak dipakai layar itu.
interface ProdukRingkas {
  id: string;
  nama: string;
  kategori: string;
  supplier: string | null;
  satuan: { nama: string; pengali: number }[];
}

// Dinaikkan sendiri dari VERSI_BENTUK: bentuk ringkas ini dipakai halaman
// pesanan supplier untuk mengelompokkan barang, jadi field `supplier` yang
// baru ditambahkan wajib membuat konsumen lama sadar bentuknya berubah.
const VERSI_RINGKAS = 2;

interface MetaKatalog {
  versi: 1;
  waktu: string;
  jumlahProduk: number;
  jumlahPincang: number;
  dilewati: number;
  barisMentah: number;
  sidik: string;
}

type KodeGalat = 'HEADER_TIDAK_COCOK' | 'KATALOG_MENYUSUT';

interface GalatKatalog {
  kode: KodeGalat;
  waktu: string;
  pesan: string;
  jumlahBaru: number;
  jumlahLama: number;
}

interface Ringkasan {
  waktu: string;
  jumlahProduk: number;
  jumlahPincang: number;
  dilewati: number;
  barisMentah: number;
  sidik: string;
  takBerubah?: boolean;
  dibatalkan?: boolean;
  kode?: KodeGalat;
}

function ringkas(produk: ProdukSheet[]): ProdukRingkas[] {
  return produk.map((p) => ({
    id: p.productId,
    nama: p.nama,
    kategori: p.kategori,
    supplier: p.supplier,
    satuan: p.satuan,
  }));
}

// Daftar pincang ikut dihitung. Kalau tidak, baris baru yang datanya belum lengkap
// tidak mengubah daftar produk sehat, sidiknya sama, penulisan dilewati, dan
// halaman Data Pincang tidak pernah menyebut barang itu — padahal halaman itu
// justru ada untuk menyebutnya.
function hitungSidik(produk: ProdukSheet[], pincang: ProdukSheet[]): string {
  const str = JSON.stringify(produk) + ' ' + JSON.stringify(pincang);
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  // VERSI_RINGKAS ikut masuk, bukan cuma VERSI_BENTUK. `katalog:cari` ditulis
  // dari `ringkas()`, yang punya bentuknya sendiri: waktu `supplier` ditambahkan
  // ke sana, isi Pricelist tidak berubah sedikit pun, sidiknya sama, `takBerubah`
  // memotong penulisan -- dan KV menyimpan bentuk lama SELAMANYA tanpa satu pun
  // galat. Halaman Pesanan Supplier kelihatan jalan, cuma semua barang jatuh ke
  // "Tanpa supplier". Sudah terjadi sekali.
  return `b${VERSI_BENTUK}r${VERSI_RINGKAS}-${str.length}-${(hash >>> 0).toString(36)}`;
}

function periksaHeader(baris: string[] | undefined): string | null {
  if (!baris) return 'Baris header tidak terbaca';
  for (const [kolom, diharapkan] of HEADER_DIHARAPKAN) {
    const isi = (baris[kolom] ?? '').trim().toLowerCase();
    if (isi !== diharapkan) {
      return `Kolom ke-${kolom + 1} berisi "${baris[kolom] ?? ''}", seharusnya "${diharapkan}"`;
    }
  }
  return null;
}

// Selama kerusakan belum dibetulkan, cron tetap jalan tiap 10 menit. Dedup memakai
// `kode`, bukan teks pesannya: pesan memuat angka yang bisa bergoyang tiap siklus
// saat sheet sedang diedit, dan itu membuat galat yang sama ditulis ulang 144x
// sehari — menggerus jatah tulis KV yang justru mau dihemat.
async function catatGalat(
  env: Env,
  galat: GalatKatalog,
  galatLama: GalatKatalog | null
): Promise<void> {
  if (galatLama?.kode === galat.kode) return;
  await env.KATALOG.put('katalog:error', JSON.stringify(galat));
}

async function segarkanKatalog(env: Env): Promise<Ringkasan> {
  const sheetId = process.env.SHEET_PRICELIST_ID;
  if (!sheetId) {
    throw new Error('SHEET_PRICELIST_ID belum dipasang');
  }
  const tab = process.env.SHEET_PRICELIST_TAB || 'Master Pricelist New';

  // Satu bacaan untuk header dan data sekaligus: header 2 baris, data mulai baris 3.
  const semua = await readSheet(sheetId, `${tab}!A1:AF`);
  const rows = semua.slice(2);
  const waktu = new Date().toISOString();

  const [metaLamaStr, galatLamaStr] = await Promise.all([
    env.KATALOG.get('katalog:meta'),
    env.KATALOG.get('katalog:error'),
  ]);
  const metaLama: MetaKatalog | null = metaLamaStr ? JSON.parse(metaLamaStr) : null;
  const galatLama: GalatKatalog | null = galatLamaStr ? JSON.parse(galatLamaStr) : null;
  const jumlahLama = metaLama?.jumlahProduk ?? 0;

  const bedaHeader = periksaHeader(semua[0]);
  if (bedaHeader !== null) {
    await catatGalat(
      env,
      {
        kode: 'HEADER_TIDAK_COCOK',
        waktu,
        pesan: `Susunan kolom Pricelist berubah, penulisan dibatalkan. ${bedaHeader}`,
        jumlahBaru: 0,
        jumlahLama,
      },
      galatLama
    );
    return {
      waktu,
      jumlahProduk: 0,
      jumlahPincang: 0,
      dilewati: 0,
      barisMentah: rows.length,
      sidik: '',
      dibatalkan: true,
      kode: 'HEADER_TIDAK_COCOK',
    };
  }

  const hasil = parsePricelist(rows, 3);
  const sidik = hitungSidik(hasil.produk, hasil.pincang);

  const dasar: Ringkasan = {
    waktu,
    jumlahProduk: hasil.produk.length,
    jumlahPincang: hasil.pincang.length,
    dilewati: hasil.dilewati,
    barisMentah: rows.length,
    sidik,
  };

  // Gerbang penyusutan: spreadsheet diedit tangan, satu blok yang terhapus bisa
  // memulangkan nol produk. Tanpa gerbang ini katalog sehat ketimpa kosong diam-diam.
  const susut = metaLama !== null && hasil.produk.length < metaLama.jumlahProduk * 0.5;
  if (hasil.produk.length === 0 || susut) {
    await catatGalat(
      env,
      {
        kode: 'KATALOG_MENYUSUT',
        waktu,
        pesan: `Katalog baru (${hasil.produk.length} produk) menyusut drastis dari sebelumnya (${jumlahLama} produk), penulisan dibatalkan`,
        jumlahBaru: hasil.produk.length,
        jumlahLama,
      },
      galatLama
    );
    return { ...dasar, dibatalkan: true, kode: 'KATALOG_MENYUSUT' };
  }

  if (metaLama !== null && metaLama.sidik === sidik) {
    // Isi sama seperti sebelumnya, tapi kalau galat lama masih menempel berarti
    // penyegaran sebelumnya sempat dibatalkan lalu sheet dikembalikan persis
    // seperti semula. Tanpa penghapusan ini peringatannya menempel selamanya.
    if (galatLama !== null) {
      await env.KATALOG.delete('katalog:error');
    }
    return { ...dasar, takBerubah: true };
  }

  const meta: MetaKatalog = {
    versi: 1,
    waktu,
    jumlahProduk: hasil.produk.length,
    jumlahPincang: hasil.pincang.length,
    dilewati: hasil.dilewati,
    barisMentah: rows.length,
    sidik,
  };

  // Urutan penting: data dulu, `katalog:meta` paling akhir. KV tidak punya transaksi,
  // jadi meta diperlakukan sebagai penanda "data sudah lengkap" — kalau Worker mati
  // di tengah, yang tertinggal adalah meta lama, bukan meta baru yang menunjuk data
  // yang baru separuh ditulis.
  const daftarRingkas = ringkas(hasil.produk);
  await env.KATALOG.put(
    'katalog:v1',
    JSON.stringify({ versi: 1, waktu, jumlah: hasil.produk.length, produk: hasil.produk })
  );
  await env.KATALOG.put(
    'katalog:cari',
    JSON.stringify({ versi: VERSI_RINGKAS, waktu, jumlah: daftarRingkas.length, produk: daftarRingkas })
  );
  await env.KATALOG.put(
    'katalog:pincang',
    JSON.stringify({ versi: 1, waktu, jumlah: hasil.pincang.length, produk: hasil.pincang })
  );
  await env.KATALOG.put('katalog:meta', JSON.stringify(meta));
  if (galatLama !== null) {
    await env.KATALOG.delete('katalog:error');
  }

  return dasar;
}

function jsonRespons(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function tokenValid(request: Request): boolean {
  const tokenDiminta = process.env.CRON_TOKEN;
  if (!tokenDiminta) return false;
  const tokenDiterima = request.headers.get('x-cron-token');
  return tokenDiterima === tokenDiminta;
}

// Jalankan hitungSaldo & cadangkanLog kalau SHEET_OPS_ID sudah dipasang.
// Spreadsheet operasional belum dibuat, jadi ketiadaannya dilewati diam-diam
// (log saja) dan TIDAK melempar — cron katalog tidak boleh ikut mati karenanya.
async function jalankanTugasSaldo(env: Env): Promise<void> {
  const sheetId = process.env.SHEET_OPS_ID;
  if (!sheetId) {
    console.log('SHEET_OPS_ID belum dipasang, lewati hitungSaldo & cadangkanLog');
    return;
  }

  try {
    const hasil = await tutupBulan(sheetId);
    console.log('tutupBulan selesai', hasil);
  } catch (err) {
    console.error('tutupBulan gagal', err);
  }

  try {
    const ringkasan = await hitungSaldo(env, sheetId);
    console.log('hitungSaldo selesai', ringkasan);
  } catch (err) {
    console.error('hitungSaldo gagal', err);
  }

  try {
    const hasil = await cadangkanLog(env, sheetId);
    console.log('cadangkanLog selesai', hasil);
  } catch (err) {
    console.error('cadangkanLog gagal', err);
  }
}

export default {
  async scheduled(_event, env, _ctx) {
    try {
      const ringkasan = await segarkanKatalog(env);
      console.log('segarkanKatalog selesai', ringkasan);
    } catch (err) {
      console.error('segarkanKatalog gagal', err);
    }

    await jalankanTugasSaldo(env);
  },

  async fetch(request, env, _ctx) {
    const url = new URL(request.url);

    if (!tokenValid(request)) {
      return jsonRespons({ ok: false, pesan: 'token salah' }, 401);
    }

    if (url.pathname === '/segarkan' && request.method === 'POST') {
      try {
        const ringkasan = await segarkanKatalog(env);
        return jsonRespons(ringkasan);
      } catch (err) {
        const pesan = err instanceof Error ? err.message : String(err);
        return jsonRespons({ ok: false, pesan }, 500);
      }
    }

    if (url.pathname === '/saldo' && request.method === 'POST') {
      const sheetId = process.env.SHEET_OPS_ID;
      if (!sheetId) {
        return jsonRespons({ ok: false, pesan: 'SHEET_OPS_ID belum dipasang' }, 500);
      }
      try {
        const ringkasan = await hitungSaldo(env, sheetId);
        return jsonRespons(ringkasan);
      } catch (err) {
        const pesan = err instanceof Error ? err.message : String(err);
        return jsonRespons({ ok: false, pesan }, 500);
      }
    }

    if (url.pathname === '/tutup-bulan' && request.method === 'POST') {
      const sheetId = process.env.SHEET_OPS_ID;
      if (!sheetId) {
        return jsonRespons({ ok: false, pesan: 'SHEET_OPS_ID belum dipasang' }, 500);
      }
      try {
        const ringkasan = await tutupBulan(sheetId);
        return jsonRespons(ringkasan);
      } catch (err) {
        const pesan = err instanceof Error ? err.message : String(err);
        return jsonRespons({ ok: false, pesan }, 500);
      }
    }

    if (url.pathname === '/status' && request.method === 'GET') {
      const [metaStr, galatStr, saldoStr] = await Promise.all([
        env.KATALOG.get('katalog:meta'),
        env.KATALOG.get('katalog:error'),
        env.KATALOG.get('saldo:v1'),
      ]);
      // Cuma ringkasan saldo yang dikirim, bukan array `saldo` isinya —
      // itu bisa ratusan baris dan /status tidak perlu memuatnya.
      let saldo: { versi: number; waktu: string; bulan: string; jumlah: number } | null = null;
      if (saldoStr) {
        const parsed = JSON.parse(saldoStr);
        saldo = { versi: parsed.versi, waktu: parsed.waktu, bulan: parsed.bulan, jumlah: parsed.jumlah };
      }
      return jsonRespons({
        ok: true,
        meta: metaStr ? JSON.parse(metaStr) : null,
        error: galatStr ? JSON.parse(galatStr) : null,
        saldo,
      });
    }

    return jsonRespons({ ok: false, pesan: 'tidak ditemukan' }, 404);
  },
} satisfies ExportedHandler<Env>;
