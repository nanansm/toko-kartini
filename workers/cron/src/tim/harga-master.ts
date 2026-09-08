// Port persis dari scripts/harga_master.py milik tim (bagian murni saja --
// tanpa gspread, tanpa google_ulang, tanpa argparse). Pemanggil di Worker yang
// mengurus baca Master Pricelist dan tulis tab Harga; berkas ini cuma
// mengubah baris mentah jadi baris siap tulis, sama persis logikanya dengan
// Python supaya angka HPP di sheet tidak pernah berbeda dari hasil skrip tim.

import { bulatGenap } from './tipe';

export const TAB_HARGA = 'Harga';

export const JUDUL_HARGA: readonly string[] = [
  'SKU',
  'Produk',
  'Satuan',
  'Isi',
  'HPP',
  'Harga Jual',
  'Slot',
  'Kategori',
];

export interface LewatHarga {
  tanpaNama: number;
  pemisahKategori: number;
  satuanKosong: number;
  skuKembar: number;
  tanpaHpp: number;
}

// (nama slot, kolom SKU, kolom satuan, kolom isi, kolom HPP, kolom harga jual)
// `isi` null = slot Grosir, master tidak menuliskannya karena isinya 1 grosir.
type Slot = readonly [nama: string, skuI: number, satI: number, isiI: number | null, hppI: number, jualI: number];

const SLOTS: readonly Slot[] = [
  ['Grosir', 28, 6, null, 5, 16],
  ['HJ1', 29, 8, 7, 13, 17],
  ['HJ2', 30, 10, 9, 14, 18],
  ['HJ3', 31, 12, 11, 15, 19],
];

/**
 * `1.411.172` -> 1411172, `8.620,00` -> 8620, kosong / `-` -> null.
 *
 * Master ditulis dengan format Indonesia: titik ribuan, koma desimal. Beda
 * dari `angkaID` di tipe.ts karena kolom Master masih bisa berisi "Rp" dan
 * spasi -- keduanya dibuang di sini seperti aslinya.
 */
export function angka(raw: unknown): number | null {
  let s = (raw === null || raw === undefined ? '' : String(raw)).trim();
  if (!s || s === '-') return null;
  s = s.replace(/Rp/g, '').replace(/ /g, '');
  s = s.replace(/\./g, '').replace(/,/g, '.');
  if (!s || s === '.' || s === '-') return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

// `_rapi` Python: bilangan bulat dibiarkan bulat, sisanya dibulatkan 2 desimal
// dengan banker's rounding (`round()` Python, bukan `Math.round()` JS).
function rapi(x: number): number {
  return Number.isInteger(x) ? x : bulatGenap(x * 100) / 100;
}

/**
 * Kembalikan (baris, lewat) dari baris mentah tab Master Pricelist New.
 *
 * `rows` sudah termasuk dua baris judul -- dipotong di sini supaya sama
 * persis dengan sync_products.py dan parseMaster.js.
 */
export function parseHarga(rows: string[][]): { baris: (string | number)[][]; lewat: LewatHarga } {
  const baris: (string | number)[][] = [];
  const seen = new Set<string>();
  const lewat: LewatHarga = {
    tanpaNama: 0,
    pemisahKategori: 0,
    satuanKosong: 0,
    skuKembar: 0,
    tanpaHpp: 0,
  };

  let kategori = '';
  for (const raw of rows.slice(2)) {
    const row: string[] = [];
    for (let i = 0; i < 32; i++) {
      const v = raw[i];
      row.push(v !== undefined ? v : '');
    }
    const ambil = (i: number): string => row[i] ?? '';

    const nama = ambil(3).trim();
    const kolom0 = ambil(0).trim();

    // Baris pemisah `=== Packaging ===` menandai kategori berikutnya.
    if (kolom0.startsWith('===')) {
      let mulai = 0;
      let akhir = kolom0.length;
      while (mulai < akhir && (kolom0.charAt(mulai) === '=' || kolom0.charAt(mulai) === ' ')) mulai++;
      while (akhir > mulai && (kolom0.charAt(akhir - 1) === '=' || kolom0.charAt(akhir - 1) === ' ')) akhir--;
      kategori = kolom0.slice(mulai, akhir);
      lewat.pemisahKategori += 1;
      continue;
    }
    if (!nama) {
      lewat.tanpaNama += 1;
      continue;
    }
    if (kolom0) kategori = kolom0;

    for (const [namaSlot, skuI, satI, isiI, hppI, jualI] of SLOTS) {
      const sku = ambil(skuI).trim();
      if (!sku) continue;
      const satuan = ambil(satI).trim();
      // SKU tetap ditulis master walau satuannya tidak dipakai produk ini.
      if (!satuan) {
        lewat.satuanKosong += 1;
        continue;
      }
      if (seen.has(sku)) {
        lewat.skuKembar += 1;
        continue;
      }
      seen.add(sku);

      const hpp = angka(ambil(hppI));
      const jual = angka(ambil(jualI));
      if (hpp === null) lewat.tanpaHpp += 1;
      const isi = isiI === null ? 1 : angka(ambil(isiI));

      baris.push([
        sku,
        nama,
        satuan,
        isi === null ? '' : rapi(isi),
        hpp === null ? '' : rapi(hpp),
        jual === null ? '' : rapi(jual),
        namaSlot,
        kategori,
      ]);
    }
  }
  return { baris, lewat };
}

/** Teks sel J1 tab Harga, sama persis dengan baris 217-219 harga_master.py. */
export function stempelHarga(waktu: string): string {
  return `Ditarik dari Master Pricelist ${waktu} WIB — jalankan ulang scripts/harga_master.py sesudah master berubah`;
}
