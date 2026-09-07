import { readSheet } from './client';

export const KOLOM_MINIMUM = ['product_id', 'nama', 'minimum', 'satuan', 'catatan'] as const;

export interface BarisMinimum {
  productId: string;
  nama: string;
  /** Batas minimum dalam satuan `satuanInput`, BUKAN satuan terkecil. */
  minimum: number;
  satuanInput: string;
  catatan: string | null;
  barisSheet: number;
}

const MINIMUM_TAB = 'Minimum';
const MINIMUM_RANGE = `${MINIMUM_TAB}!A2:E`;

function kosongJadiNull(raw: string | undefined): string | null {
  const s = (raw ?? '').trim();
  return s === '' ? null : s;
}

function arrayKeBarisMinimum(row: string[], barisSheet: number): BarisMinimum | null {
  const productId = (row[0] ?? '').trim();
  if (productId === '') return null;

  const satuanInput = (row[3] ?? '').trim();
  if (satuanInput === '') return null;

  // Sel minimum kosong/rusak -> lewati baris. Angka 0 dipakai apa adanya,
  // karena 0 berarti barang ini memang tidak perlu dipesan — menyamakannya
  // dengan "belum diisi" bikin barang yang seharusnya dipesan hilang diam-diam.
  const minimumMentah = (row[2] ?? '').trim();
  if (minimumMentah === '') return null;
  const minimum = Number(minimumMentah);
  if (!Number.isFinite(minimum) || minimum < 0) return null;

  return {
    productId,
    nama: row[1] ?? '',
    minimum,
    satuanInput,
    catatan: kosongJadiNull(row[4]),
    barisSheet,
  };
}

export async function bacaMinimum(sheetId: string): Promise<BarisMinimum[]> {
  const rows = await readSheet(sheetId, MINIMUM_RANGE);
  // product_id dobel wajar di sheet yang diedit tangan — baris terakhir menang,
  // makanya dikumpulkan dulu ke Map sebelum dipulangkan sebagai array.
  const hasil = new Map<string, BarisMinimum>();
  rows.forEach((row, i) => {
    const baris = arrayKeBarisMinimum(row, i + 2);
    if (baris) hasil.set(baris.productId, baris);
  });
  return Array.from(hasil.values());
}
