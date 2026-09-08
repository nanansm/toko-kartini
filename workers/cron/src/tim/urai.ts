import { angkaID, type BarisLog, type BarisMutasi, type BarisPenjualan } from './tipe';

// Kolom dibaca PER POSISI, bukan per nama header. Tab-tab ini punya baris
// stempel di atas headernya dan beberapa kolom bernama sama, jadi pencocokan
// lewat nama akan mengambil kolom yang salah tanpa mengeluh.

function teks(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

/** Tab `Log` — baris data saja, header sudah dipotong pemanggil. */
export function uraiLog(rows: string[][]): BarisLog[] {
  const hasil: BarisLog[] = [];
  for (const r of rows) {
    const waktu = teks(r[0]);
    // Baris tanpa waktu atau tanpa SKU bukan catatan hitungan -- biasanya baris
    // kosong di ekor tab. Dibuang, bukan diurai jadi produk bernama "".
    if (waktu === '' || teks(r[8]) === '') continue;
    hasil.push({
      waktu,
      staff: teks(r[1]),
      rak: teks(r[2]),
      produk: teks(r[3]),
      rincian: teks(r[4]),
      qty: angkaID(r[5]) ?? 0,
      satuan: teks(r[6]),
      ed: teks(r[7]),
      sku: teks(r[8]),
    });
  }
  return hasil;
}

/** Tab `Mutasi` — baris data saja. */
export function uraiMutasi(rows: string[][]): BarisMutasi[] {
  const hasil: BarisMutasi[] = [];
  for (const r of rows) {
    const waktu = teks(r[0]);
    if (waktu === '' || teks(r[9]) === '') continue;
    hasil.push({
      waktu,
      staff: teks(r[1]),
      jenis: teks(r[2]),
      dari: teks(r[3]),
      ke: teks(r[4]),
      produk: teks(r[5]),
      rincian: teks(r[6]),
      qty: angkaID(r[7]) ?? 0,
      satuan: teks(r[8]),
      sku: teks(r[9]),
      nota: teks(r[10]),
      sebab: teks(r[11]),
    });
  }
  return hasil;
}

/** Tab `Penjualan` — baris data saja. 11 kolom, lihat BarisPenjualan. */
export function uraiPenjualan(rows: string[][]): BarisPenjualan[] {
  const hasil: BarisPenjualan[] = [];
  for (const r of rows) {
    const produk = teks(r[2]);
    const tanggal = teks(r[0]);
    if (produk === '' || tanggal === '') continue;
    hasil.push({
      tanggal,
      sku: teks(r[1]),
      produk,
      satuan: teks(r[3]),
      qty: angkaID(r[4]) ?? 0,
      qtyDasar: angkaID(r[5]) ?? 0,
      satuanDasar: teks(r[6]),
      omzet: angkaID(r[7]) ?? 0,
      bayar: teks(r[8]),
      pelanggan: teks(r[9]),
      sebab: teks(r[10]),
    });
  }
  return hasil;
}
