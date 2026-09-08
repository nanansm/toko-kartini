// Bentuk baris apa adanya seperti tersimpan di spreadsheet gudang tim.
// Ditulis sekali di sini supaya keenam modul port dari skrip Python mereka
// memakai nama medan yang sama -- kalau tiap modul mendefinisikan bentuknya
// sendiri, satu perubahan kolom di spreadsheet harus dikejar di enam tempat.

/** Tab `Log`: Waktu, Staff, Rak, Produk, Rincian, Qty, Satuan, ED, SKU */
export interface BarisLog {
  waktu: string;
  staff: string;
  rak: string;
  produk: string;
  rincian: string;
  qty: number;
  satuan: string;
  ed: string;
  sku: string;
}

/** Tab `Mutasi`: Waktu, Staff, Jenis, Dari, Ke, Produk, Rincian, Qty, Satuan, SKU, Nota, Sebab */
export interface BarisMutasi {
  waktu: string;
  staff: string;
  jenis: string;
  dari: string;
  ke: string;
  produk: string;
  rincian: string;
  qty: number;
  satuan: string;
  sku: string;
  nota: string;
  sebab: string;
}

/**
 * Tab `Penjualan` seperti isinya SEKARANG, 11 kolom:
 * Tanggal, SKU, Produk, Satuan, Qty, Qty Dasar, Satuan Dasar, Omzet, Bayar,
 * Pelanggan, Sebab.
 *
 * Docstring `saldo_display.py` masih menyebut bentuk lama (Awal/Akhir/rentang
 * tanggal) dan itu SUDAH TIDAK BENAR -- kodenya sendiri membaca kolom 0/2/5/6/10
 * seperti di bawah. Yang diikuti kodenya, bukan keterangannya.
 */
export interface BarisPenjualan {
  /** Satu baris = satu HARI, bukan rentang. */
  tanggal: string;
  sku: string;
  produk: string;
  satuan: string;
  qty: number;
  qtyDasar: number;
  satuanDasar: string;
  omzet: number;
  bayar: string;
  pelanggan: string;
  /** Terisi = konversi ke satuan dasar gagal; angkanya belum bisa dipercaya. */
  sebab: string;
}

/** Tab `Harga`: SKU, Produk, Satuan, Isi, HPP, Harga Jual, Slot, Kategori */
export interface BarisHarga {
  sku: string;
  produk: string;
  satuan: string;
  isi: string;
  hpp: number | null;
  jual: number | null;
  slot: string;
  kategori: string;
}

/** Satu baris tab `Stok` -- 13 kolom, urutannya dikunci oleh header tim. */
export interface BarisStok {
  lokasi: string;
  sku: string;
  produk: string;
  satuan: string;
  hasilSO: number | '';
  tglSO: string;
  masuk: number | '';
  keluar: number | '';
  terjual: number | '';
  sisa: number | '';
  hpp: number | '';
  nilaiSisa: number | '';
  catatan: string;
}

/** Satu baris tab `Selisih SO` -- 11 kolom. */
export interface BarisSelisih {
  tglSO: string;
  lokasi: string;
  sku: string;
  produk: string;
  satuan: string;
  perkiraan: number | '';
  hasilHitung: number | '';
  selisih: number | '';
  hpp: number | '';
  nilaiSelisih: number | '';
  dasar: string;
}

/** Lokasi maya tidak pernah punya saldo, jadi tidak pernah dapat baris di tab Stok. */
export const MAYA: ReadonlySet<string> = new Set(['Barang Datang', 'Barang Rusak']);

export const DISPLAY = 'Area Display';

/**
 * Angka format Indonesia sebagaimana tertulis di sel spreadsheet.
 * Titik = pemisah ribuan (dibuang), koma = desimal (jadi titik).
 * Kosong atau tak terbaca -> null, BUKAN 0: nol adalah pernyataan
 * "jumlahnya nol", sedangkan null adalah "tidak ada angkanya", dan
 * dua hal itu diperlakukan berbeda di kolom HPP maupun Sisa.
 */
export function angkaID(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isNaN(v) ? null : v;
  const raw = String(v).trim();
  if (raw === '') return null;
  const bersih = raw.replace(/\./g, '').replace(',', '.');
  const n = Number(bersih);
  return Number.isNaN(n) ? null : n;
}

/**
 * Pembulatan gaya `_rapi` milik tim: bilangan bulat dibiarkan bulat, sisanya
 * dipangkas ke 3 desimal. Tanpa ini `0.1 + 0.2` muncul di sheet sebagai
 * 0.30000000000000004 dan pembandingan dengan hasil skrip mereka gagal.
 */
export function rapi(n: number): number {
  if (Number.isInteger(n)) return n;
  return bulatGenap(n * 1000) / 1000;
}

/**
 * Pembulatan cara Python: `round()` membulatkan angka yang tepat di tengah ke
 * BILANGAN GENAP terdekat (banker's rounding), sedangkan `Math.round()` di JS
 * selalu membulatkan ke atas. Bedanya cuma 1 rupiah per baris, tapi itu cukup
 * membuat tab Stok hasil Worker tidak sama persis dengan hasil skrip tim --
 * dan selama dua-duanya masih jalan berdampingan, "beda 1" tidak bisa
 * dibedakan dari "ada yang salah hitung". Contoh: 343054,5 -> 343054 (bukan
 * 343055), 343055,5 -> 343056.
 */
export function bulatGenap(x: number): number {
  const bawah = Math.floor(x);
  const sisa = x - bawah;
  if (sisa > 0.5) return bawah + 1;
  if (sisa < 0.5) return bawah;
  return bawah % 2 === 0 ? bawah : bawah + 1;
}
