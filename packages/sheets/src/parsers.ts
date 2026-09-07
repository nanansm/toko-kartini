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

const PASANGAN_ISI_SATUAN: Array<[number, number]> = [
  [7, 8],
  [9, 10],
  [11, 12],
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

  const validPairs: Array<{ isi: number; nama: string }> = [];
  PASANGAN_ISI_SATUAN.forEach(([isiIdx, satIdx], i) => {
    const isi = angkaID(row[isiIdx]);
    const nama = s(row[satIdx]);
    if (isi === null && nama === null) return;
    if (isi === null || nama === null) {
      alasanPincang.push(`Pasangan Isi/Satuan ke-${i + 1} tidak lengkap`);
      return;
    }
    validPairs.push({ isi, nama });
  });

  const isiTerbesar = validPairs.length > 0 ? Math.max(...validPairs.map((p) => p.isi)) : 1;

  const satuan: SatuanTingkat[] = [];
  const seen = new Set<string>();
  if (satuanGrosirRaw) {
    satuan.push({ nama: satuanGrosirRaw, pengali: isiTerbesar });
    seen.add(satuanGrosirRaw);
  }
  for (const p of validPairs) {
    if (seen.has(p.nama)) continue;
    satuan.push({ nama: p.nama, pengali: isiTerbesar / p.isi });
    seen.add(p.nama);
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
