// Port persis dari scripts/hitung_stok.py milik tim. Modul ini MURNI --
// tidak menyentuh Google Sheets sama sekali, cuma menggabungkan dua rumus
// saldo (gudang dan display) jadi satu tabel 13 kolom. Penulisan ke sheet
// diurus pemanggil.

import type { BarisLog, BarisMutasi, BarisPenjualan, BarisStok } from './tipe';
import { DISPLAY } from './tipe';
import type { PetaHarga } from './harga';
import { hitungSaldoGudang } from './saldo-gudang';
import { hitungSaldoDisplay } from './saldo-display';

// Urutan dan JUMLAH kolom ini TIDAK BOLEH berubah: tab lain di sheet tim
// merujuk kolom-kolom Stok lewat HURUF KOLOM, jadi menyisipkan kolom baru
// di tengah menggeser arti semua kolom sesudahnya tanpa memunculkan galat
// apa pun -- salah diam-diam, baru ketahuan setelah laporan salah dibaca.
export const HEADER_STOK: readonly string[] = [
  'Lokasi', 'SKU', 'Produk', 'Satuan', 'Hasil SO', 'Tgl SO',
  'Masuk', 'Keluar', 'Terjual', 'Sisa', 'HPP', 'Nilai Sisa', 'Catatan',
];

export function hitungStok(
  log: BarisLog[],
  mutasi: BarisMutasi[],
  penjualan: BarisPenjualan[],
  harga: PetaHarga,
): { baris: BarisStok[]; peringatan: string[]; tanpaHarga: number; totalNilai: number } {
  const gudang = hitungSaldoGudang(log, mutasi, harga);
  const { baris: display, peringatan } = hitungSaldoDisplay(log, mutasi, penjualan, harga);

  const baris = [...gudang, ...display];
  // Area Display selalu di bawah supaya gudang-gudang berkelompok di atas --
  // sama persis dengan kunci urut di gabung() milik hitung_stok.py:
  // (lokasi == DISPLAY, lokasi, produk).
  baris.sort((a, b) => {
    const da = a.lokasi === DISPLAY ? 1 : 0;
    const db = b.lokasi === DISPLAY ? 1 : 0;
    if (da !== db) return da - db;
    if (a.lokasi !== b.lokasi) return a.lokasi < b.lokasi ? -1 : 1;
    if (a.produk !== b.produk) return a.produk < b.produk ? -1 : 1;
    return 0;
  });

  let tanpaHarga = 0;
  let totalNilai = 0;
  for (const b of baris) {
    if (b.hpp === '') tanpaHarga += 1;
    if (b.nilaiSisa !== '') totalNilai += b.nilaiSisa;
  }

  return { baris, peringatan, tanpaHarga, totalNilai };
}

export function keSelStok(baris: BarisStok[]): (string | number)[][] {
  return baris.map((b) => [
    b.lokasi, b.sku, b.produk, b.satuan, b.hasilSO, b.tglSO,
    b.masuk, b.keluar, b.terjual, b.sisa, b.hpp, b.nilaiSisa, b.catatan,
  ]);
}
