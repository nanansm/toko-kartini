import type { HasilParse, ProdukSheet, SatuanTingkat } from './types';

function s(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const str = String(v).trim();
  return str === '' ? null : str;
}

/**
 * Parse angka format Indonesia.
 * Titik (.) = pemisah ribuan → dibuang. Koma (,) = pemisah desimal → jadi titik.
 * "8.620" -> 8620 | "8.620,00" -> 8620 | "6,6" -> 6.6
 */
export function angkaID(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isNaN(v) ? null : v;
  const raw = String(v).trim();
  if (raw === '') return null;
  const cleaned = raw.replace(/\./g, '').replace(',', '.');
  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
}

// [isiIdx, satuanIdx, skuIdx, unitOrder]. Kolom dibaca per posisi, bukan per
// nama header — baris 1 punya empat kolom bernama "SKU" yang identik.
const PASANGAN_ISI_SATUAN: Array<[number, number, number, number]> = [
  [7, 8, 29, 1],
  [9, 10, 30, 2],
  [11, 12, 31, 3],
];

export function parseProdukRow(row: string[], barisSheet: number): ProdukSheet | null {
  const kolom0 = s(row[0]);
  if (kolom0 && kolom0.startsWith('===')) return null;

  const skuGrosirRaw = s(row[28]);
  if (!skuGrosirRaw) return null;
  const productId = skuGrosirRaw.replace(/-(G|1|2|3)$/i, '');

  const alasanPincang: string[] = [];
  const satuanGrosirRaw = s(row[6]);
  if (!satuanGrosirRaw) alasanPincang.push('Satuan Grosir (kolom 6) kosong');

  // Aplikasi gudang tim memaksa pengali semua satuan produk ini jadi 1 kalau
  // ada slot yang punya SKU dan nama satuan tapi Isi-nya tak terbaca
  // (parseMaster.js:53-58 di repo mereka). Kalau kita menyimpang, angka yang
  // kita tulis balik ke spreadsheet mereka tidak akan cocok dengan angka lama.
  let paksaPengaliSatu = false;

  const validPairs: Array<{ isi: number; nama: string; sku: string | null; unitOrder: number }> = [];
  PASANGAN_ISI_SATUAN.forEach(([isiIdx, satIdx, skuIdx, unitOrder], i) => {
    const isi = angkaID(row[isiIdx]);
    const nama = s(row[satIdx]);
    const sku = s(row[skuIdx]);
    if (isi === null && nama === null) return;
    if (isi === null || nama === null) {
      alasanPincang.push(`Pasangan Isi/Satuan ke-${i + 1} tidak lengkap`);
      if (isi === null && nama && sku) paksaPengaliSatu = true;
      return;
    }
    // Isi 0 atau negatif membuat pengali jadi Infinity/negatif tanpa ada yang
    // mengeluh. Sheet ini diedit tangan, jadi angkanya diperiksa, bukan dipercaya.
    if (isi <= 0) {
      alasanPincang.push(`Isi pada pasangan ke-${i + 1} bukan angka positif`);
      return;
    }
    validPairs.push({ isi, nama, sku, unitOrder });
  });

  const isiTerbesar = validPairs.length > 0 ? Math.max(...validPairs.map((p) => p.isi)) : 1;

  const satuan: SatuanTingkat[] = [];
  const seen = new Set<string>();
  if (satuanGrosirRaw && skuGrosirRaw) {
    satuan.push({
      nama: satuanGrosirRaw,
      pengali: Math.round(isiTerbesar * 10000) / 10000,
      sku: skuGrosirRaw,
      unitOrder: 0,
    });
    seen.add(skuGrosirRaw);
  }
  for (const p of validPairs) {
    if (!p.sku) continue;
    // Dedup pakai SKU, bukan nama satuan. 130 produk punya dua slot bernama
    // sama persis (mis. "Pack (10pcs)" di slot Grosir dan slot 3) dengan SKU
    // berbeda; parseMaster.js tim menyimpan dua-duanya. Kalau kita dedup per
    // nama, 129 SKU satuan hilang dan kolom SKU yang kita tulis ke tab Log
    // mereka jadi salah.
    if (seen.has(p.sku)) continue;
    satuan.push({
      nama: p.nama,
      pengali: Math.round((isiTerbesar / p.isi) * 10000) / 10000,
      sku: p.sku,
      unitOrder: p.unitOrder,
    });
    seen.add(p.sku);
  }

  if (paksaPengaliSatu) {
    satuan.forEach((satuanItem) => {
      satuanItem.pengali = 1;
    });
  }

  return {
    productId,
    nama: s(row[3]) ?? '',
    kategori: kolom0 ?? '',
    brand: s(row[2]),
    supplier: s(row[4]),
    hppGrosir: angkaID(row[5]),
    satuanGrosir: satuanGrosirRaw,
    satuan,
    hargaGrosir: angkaID(row[16]),
    hj1: angkaID(row[13]),
    hj2: angkaID(row[14]),
    hj3: angkaID(row[15]),
    barisSheet,
    pincang: alasanPincang.length > 0,
    alasanPincang,
  };
}

export function parsePricelist(rows: string[][], barisAwal = 3): HasilParse {
  const produk: ProdukSheet[] = [];
  const pincang: ProdukSheet[] = [];
  let dilewati = 0;

  rows.forEach((row, i) => {
    const parsed = parseProdukRow(row, barisAwal + i);
    if (!parsed) {
      dilewati++;
      return;
    }
    if (parsed.pincang) {
      pincang.push(parsed);
    } else {
      produk.push(parsed);
    }
  });

  return { produk, pincang, dilewati };
}
