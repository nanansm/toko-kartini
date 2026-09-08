import { readSheet, parsePricelist } from '@kartini/sheets';
import type { ProdukSheet } from '@kartini/sheets';
import { hitungNilai } from './nilai';
import { tarikStokSO } from './stok-so';

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
  /** Harga beli per SATUAN POKOK (satuan terkecil), bukan per satuan Grosir.
   *  Pricelist menyimpan HPP di kolom F untuk satuan teratas; dibagi pengali
   *  terbesar hasilnya persis kolom P ("HPP" tingkat terkecil) — sudah dicocokkan
   *  ke empat baris nyata. Saldo disimpan dalam satuan pokok, jadi nilai uang
   *  cuma benar kalau harganya juga per satuan pokok. `null` kalau Pricelist
   *  tidak memberi harga; qty-nya lalu dihitung terpisah, bukan dianggap nol. */
  hpp: number | null;
}

// Dinaikkan sendiri dari VERSI_BENTUK: bentuk ringkas ini dipakai halaman
// pesanan supplier untuk mengelompokkan barang, jadi field `supplier` yang
// baru ditambahkan wajib membuat konsumen lama sadar bentuknya berubah.
// Naik ke 3 waktu `hpp` ditambahkan untuk nilai uang stok di Beranda.
const VERSI_RINGKAS = 3;

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

/** Harga beli per satuan pokok. Pengali terbesar = satuan Grosir (Isi = 1 di
 *  Pricelist berarti pengali tertinggi), dan HPP Grosir berlaku untuk satuan
 *  itu. Pembagi 0 atau tangga satuan kosong menghasilkan `null`, bukan
 *  Infinity/NaN yang diam-diam merusak seluruh penjumlahan nilai. */
function hppPokok(p: ProdukSheet): number | null {
  if (p.hppGrosir === null || !Number.isFinite(p.hppGrosir)) return null;
  let pengaliTerbesar = 0;
  for (const s of p.satuan) {
    if (s.pengali > pengaliTerbesar) pengaliTerbesar = s.pengali;
  }
  if (pengaliTerbesar <= 0) return null;
  return p.hppGrosir / pengaliTerbesar;
}

function ringkas(produk: ProdukSheet[]): ProdukRingkas[] {
  return produk.map((p) => ({
    id: p.productId,
    nama: p.nama,
    kategori: p.kategori,
    supplier: p.supplier,
    satuan: p.satuan,
    hpp: hppPokok(p),
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

// MODEL LAPORAN. Buku besar yang sah ada di aplikasi gudang tim (spreadsheet
// Stok Opname), bukan di sini. Cron cuma menyalin tab `Stok` milik tim ke KV
// lalu menghitung nilai uangnya.
//
// `hitungSaldo` sengaja TIDAK dipanggil: ia menghitung saldo dari
// `Saldo_Awal` + `Log` saja dan akan MENIMPA hasil tarikan SO tiap 10 menit --
// stok yang dipegang aplikasi tim hilang dari layar. Selama dua aplikasi jalan
// berdampingan, angka SO yang jadi dasar dan Log kita dilipat di atasnya di
// dalam `tarikStokSO` (lewat `lipatSaldo`, fungsi yang sama), jadi mutasi yang
// dicatat staf di sini tetap menggeser angkanya.
//
// `tutupBulan` dan `cadangkanLog` juga belum dipanggil: keduanya milik model
// Saldo_Awal yang baru relevan setelah tarikan SO dimatikan.
async function jalankanTugasStok(env: Env): Promise<void> {
  const sheetSoId = process.env.SHEET_SO_ID;
  if (!sheetSoId) {
    console.log('SHEET_SO_ID belum dipasang, lewati tarikStokSO');
  } else {
    try {
      const ringkasan = await tarikStokSO(env, sheetSoId, process.env.SHEET_OPS_ID);
      console.log('tarikStokSO selesai', ringkasan);
    } catch (err) {
      console.error('tarikStokSO gagal', err);
    }
  }

  // Dijalankan walau tarikan gagal: saldo lama di KV tetap punya nilai yang
  // sah, dan menghentikan hitungNilai cuma membuat Beranda ikut basi.
  try {
    const ringkasan = await hitungNilai(env);
    console.log('hitungNilai selesai', ringkasan);
  } catch (err) {
    console.error('hitungNilai gagal', err);
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

    await jalankanTugasStok(env);
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

    // Endpoint /saldo dan /tutup-bulan ditutup, BUKAN dihapus diam-diam:
    // keduanya menulis ke `saldo:v1` dari model lama dan sekali dipanggil akan
    // menghapus hasil tarikan dari spreadsheet tim.
    if (
      (url.pathname === '/saldo' || url.pathname === '/tutup-bulan') &&
      request.method === 'POST'
    ) {
      return jsonRespons(
        { ok: false, pesan: 'Dimatikan di model laporan. Sumber saldo sekarang tab Stok spreadsheet SO tim.' },
        410
      );
    }

    if (url.pathname === '/stok-so' && request.method === 'POST') {
      const sheetSoId = process.env.SHEET_SO_ID;
      if (!sheetSoId) {
        return jsonRespons({ ok: false, pesan: 'SHEET_SO_ID belum dipasang' }, 500);
      }
      try {
        const ringkasan = await tarikStokSO(env, sheetSoId, process.env.SHEET_OPS_ID);
        return jsonRespons(ringkasan);
      } catch (err) {
        const pesan = err instanceof Error ? err.message : String(err);
        return jsonRespons({ ok: false, pesan }, 500);
      }
    }

    // Tanpa sheetId: hitungNilai murni membaca KV. Endpoint ini ada supaya
    // nilai bisa dipaksa dihitung ulang tanpa menunggu siklus 10 menit.
    if (url.pathname === '/nilai' && request.method === 'POST') {
      try {
        const ringkasan = await hitungNilai(env);
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
