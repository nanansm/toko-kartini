import { readSheet, parsePricelist } from '@kartini/sheets';
import type { ProdukSheet } from '@kartini/sheets';

interface Env {
  KATALOG: KVNamespace;
}

// Dinaikkan setiap kali BENTUK data di KV berubah. Ikut masuk ke sidik supaya
// perubahan bentuk memaksa penulisan ulang, walau isi Pricelist-nya sama persis.
const VERSI_BENTUK = 2;

// Bentuk ramping untuk layar pencatatan: cuma yang dibutuhkan buat mencari dan
// memilih barang. Catatan lengkapnya 412 KB, dan mengurai segitu di tiap
// permintaan staf membakar CPU untuk kolom yang tidak dipakai layar itu.
interface ProdukRingkas {
  id: string;
  nama: string;
  kategori: string;
  satuan: { nama: string; pengali: number }[];
}

function ringkas(produk: ProdukSheet[]): ProdukRingkas[] {
  return produk.map((p) => ({
    id: p.productId,
    nama: p.nama,
    kategori: p.kategori,
    satuan: p.satuan,
  }));
}

interface MetaKatalog {
  versi: 1;
  waktu: string;
  jumlahProduk: number;
  jumlahPincang: number;
  dilewati: number;
  barisMentah: number;
  sidik: string;
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
}

function hitungSidik(produk: ProdukSheet[]): string {
  const str = JSON.stringify(produk);
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return `b${VERSI_BENTUK}-${str.length}-${(hash >>> 0).toString(36)}`;
}

async function segarkanKatalog(env: Env): Promise<Ringkasan> {
  const sheetId = process.env.SHEET_PRICELIST_ID;
  if (!sheetId) {
    throw new Error('SHEET_PRICELIST_ID belum dipasang');
  }
  const tab = process.env.SHEET_PRICELIST_TAB || 'Master Pricelist New';

  const rows = await readSheet(sheetId, `${tab}!A3:AF`);
  const hasil = parsePricelist(rows, 3);
  const waktu = new Date().toISOString();
  const sidik = hitungSidik(hasil.produk);

  const [metaLamaStr, errorLamaStr] = await Promise.all([
    env.KATALOG.get('katalog:meta'),
    env.KATALOG.get('katalog:error'),
  ]);
  const metaLama: MetaKatalog | null = metaLamaStr ? JSON.parse(metaLamaStr) : null;
  const errorLama: { pesan?: string } | null = errorLamaStr ? JSON.parse(errorLamaStr) : null;

  // Gerbang penyusutan: spreadsheet diedit tangan, satu kolom geser bisa
  // memulangkan nol produk. Tanpa gerbang ini katalog sehat ketimpa kosong diam-diam.
  const susut = metaLama !== null && hasil.produk.length < metaLama.jumlahProduk * 0.5;
  if (hasil.produk.length === 0 || susut) {
    const jumlahLama = metaLama?.jumlahProduk ?? 0;
    const pesan = `Katalog baru (${hasil.produk.length} produk) menyusut drastis dari sebelumnya (${jumlahLama} produk), penulisan dibatalkan`;
    // Selama kerusakan belum dibetulkan, cron tetap jalan tiap 10 menit. Menulis
    // ulang galat yang sama 144x sehari membakar jatah tulis KV tanpa menambah
    // satu pun keterangan baru, jadi hanya galat yang isinya berubah yang ditulis.
    if (errorLama?.pesan !== pesan) {
      await env.KATALOG.put(
        'katalog:error',
        JSON.stringify({ waktu, pesan, jumlahBaru: hasil.produk.length, jumlahLama })
      );
    }
    return {
      waktu,
      jumlahProduk: hasil.produk.length,
      jumlahPincang: hasil.pincang.length,
      dilewati: hasil.dilewati,
      barisMentah: rows.length,
      sidik,
      dibatalkan: true,
    };
  }

  // Lewati kalau sidik sama dengan sebelumnya: hemat jatah tulis KV
  // (1.000/hari paket gratis, cron 10 menit = 144x jalan/hari).
  if (metaLama !== null && metaLama.sidik === sidik) {
    // Isi sama seperti sebelumnya, tapi kalau galat lama masih menempel berarti
    // penyegaran sebelumnya sempat dibatalkan lalu sheet dikembalikan persis
    // seperti semula. Tanpa penghapusan ini peringatannya menempel selamanya.
    if (errorLama !== null) {
      await env.KATALOG.delete('katalog:error');
    }
    return {
      waktu,
      jumlahProduk: hasil.produk.length,
      jumlahPincang: hasil.pincang.length,
      dilewati: hasil.dilewati,
      barisMentah: rows.length,
      sidik,
      takBerubah: true,
    };
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

  await env.KATALOG.put(
    'katalog:v1',
    JSON.stringify({ versi: 1, waktu, jumlah: hasil.produk.length, produk: hasil.produk })
  );
  const daftarRingkas = ringkas(hasil.produk);
  await env.KATALOG.put(
    'katalog:cari',
    JSON.stringify({ versi: 1, waktu, jumlah: daftarRingkas.length, produk: daftarRingkas })
  );
  await env.KATALOG.put(
    'katalog:pincang',
    JSON.stringify({ versi: 1, waktu, jumlah: hasil.pincang.length, produk: hasil.pincang })
  );
  await env.KATALOG.put('katalog:meta', JSON.stringify(meta));
  if (errorLama !== null) {
    await env.KATALOG.delete('katalog:error');
  }

  return {
    waktu,
    jumlahProduk: hasil.produk.length,
    jumlahPincang: hasil.pincang.length,
    dilewati: hasil.dilewati,
    barisMentah: rows.length,
    sidik,
  };
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

export default {
  async scheduled(_event, env, _ctx) {
    try {
      const ringkasan = await segarkanKatalog(env);
      console.log('segarkanKatalog selesai', ringkasan);
    } catch (err) {
      console.error('segarkanKatalog gagal', err);
    }
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

    if (url.pathname === '/status' && request.method === 'GET') {
      const [metaStr, errorStr] = await Promise.all([
        env.KATALOG.get('katalog:meta'),
        env.KATALOG.get('katalog:error'),
      ]);
      return jsonRespons({
        ok: true,
        meta: metaStr ? JSON.parse(metaStr) : null,
        error: errorStr ? JSON.parse(errorStr) : null,
      });
    }

    return jsonRespons({ ok: false, pesan: 'tidak ditemukan' }, 404);
  },
} satisfies ExportedHandler<Env>;
