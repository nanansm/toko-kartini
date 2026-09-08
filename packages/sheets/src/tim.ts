import { appendRows } from './client';

export interface SatuanQty { sku: string; nama: string; pengali: number; qty: number }

export interface BarisEntriTim {
  diubah: string;        // ISO UTC
  pengguna: string;
  rak: string;           // nama rak versi tim, mis. "Gudang Ciherang"
  namaProduk: string;
  satuan: SatuanQty[];
  qtyTotal: number;
  expired: string | null;
}

export interface BarisMutasiTim {
  diubah: string;
  pengguna: string;
  jenis: string;         // "Datang" | "Isi Ulang" | "Pindah" | "Rusak"
  dari: string;          // nama lokasi versi tim
  ke: string;
  namaProduk: string;
  satuan: SatuanQty[];
  qtyTotal: number;
  nota: string;
  sebab: string;
}

// Ubah ISO UTC jadi "YYYY-MM-DD HH:MM:SS" waktu WIB, persis rumus yang dipakai Edge Function tim.
export function wib(iso: string): string {
  return new Date(new Date(iso).getTime() + 7 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

// Qty selalu disimpan dalam satuan terkecil, jadi kolom Satuan + SKU harus menyebut
// satuan itu — bukan satuan yang kebetulan diketik staf.
export function satuanDasar(satuan: SatuanQty[]): SatuanQty | null {
  const eksakSatu = satuan.find((s) => s.pengali === 1);
  if (eksakSatu) return eksakSatu;
  let terkecil: SatuanQty | null = null;
  for (const s of satuan) {
    if (terkecil === null || s.pengali < terkecil.pengali) terkecil = s;
  }
  return terkecil;
}

// Filter `!== 0`, BUKAN `> 0`: qty negatif yang lolos `> 0` akan hilang dari teks
// Rincian sementara kolom Qty tetap menghitungnya, jadi Rincian dan Qty tidak lagi nyambung.
export function rincian(satuan: SatuanQty[]): string {
  return satuan
    .filter((s) => Number(s.qty) !== 0)
    .sort((a, b) => b.pengali - a.pengali)
    .map((s) => `${s.qty} ${s.nama}`)
    .join(' + ');
}

export const JENIS_TIM: Record<string, string> = {
  DATANG: 'Datang',
  ISI_DISPLAY: 'Isi Ulang',
  PINDAH: 'Pindah',
  RUSAK: 'Rusak',
};

// Jumlah dan urutan kolom TIDAK BOLEH berubah — tab lain di spreadsheet tim menunjuk
// kolom-kolom ini lewat huruf kolom, jadi menyisipkan kolom di tengah menggeser arti
// semua kolom sesudahnya tanpa memunculkan galat apa pun.
export function barisLogTim(entri: BarisEntriTim[]): { baris: (string | number)[][]; dilewati: string[] } {
  const baris: (string | number)[][] = [];
  const dilewati: string[] = [];
  for (const e of entri) {
    const dasar = satuanDasar(e.satuan);
    if (!dasar) {
      dilewati.push(e.namaProduk);
      continue;
    }
    baris.push([
      wib(e.diubah),
      e.pengguna,
      e.rak,
      e.namaProduk,
      rincian(e.satuan),
      Number(e.qtyTotal ?? 0),
      dasar.nama,
      e.expired ?? '',
      dasar.sku,
    ]);
  }
  return { baris, dilewati };
}

// Jumlah dan urutan kolom TIDAK BOLEH berubah — tab lain di spreadsheet tim menunjuk
// kolom-kolom ini lewat huruf kolom, jadi menyisipkan kolom di tengah menggeser arti
// semua kolom sesudahnya tanpa memunculkan galat apa pun.
export function barisMutasiTim(mutasi: BarisMutasiTim[]): { baris: (string | number)[][]; dilewati: string[] } {
  const baris: (string | number)[][] = [];
  const dilewati: string[] = [];
  for (const m of mutasi) {
    const dasar = satuanDasar(m.satuan);
    if (!dasar) {
      dilewati.push(m.namaProduk);
      continue;
    }
    baris.push([
      wib(m.diubah),
      m.pengguna,
      m.jenis,
      m.dari,
      m.ke,
      m.namaProduk,
      rincian(m.satuan),
      Number(m.qtyTotal ?? 0),
      dasar.nama,
      dasar.sku,
      m.nota ?? '',
      m.sebab ?? '',
    ]);
  }
  return { baris, dilewati };
}

export async function tulisLogTim(sheetId: string, baris: (string | number)[][]): Promise<void> {
  if (baris.length === 0) return;
  await appendRows(sheetId, 'Log!A1', baris, 'OVERWRITE');
}

export async function tulisMutasiTim(sheetId: string, baris: (string | number)[][]): Promise<void> {
  if (baris.length === 0) return;
  await appendRows(sheetId, 'Mutasi!A1', baris, 'OVERWRITE');
}
