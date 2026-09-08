// Tata letak tab `Stok` dan `Selisih SO` di spreadsheet tim: baris 1 penanda,
// baris 2 judul, data mulai baris 3, ringkasan di kolom jauh kanan.
//
// Kenapa dipisah dari stok.ts / selisih.ts: dua modul itu MURNI hitungan, dan
// harus tetap begitu supaya bisa diuji tanpa menyentuh sheet. Yang di sini
// bentuk tulisannya, bukan angkanya.
//
// KENAPA INI PENTING: tab `Ringkasan` membaca `Stok!A1` dan `'Selisih SO'!A1`
// lewat rumus (lihat scripts/add_ringkasan.py baris 51 dan 111), dan
// `add_stok_gudang.py` baris 59 juga membacanya. Menulis tab ini tanpa baris 1
// membuat Ringkasan berbunyi "belum pernah dihitung" walau angkanya baru saja
// dihitung -- salah diam-diam, persis kelas kesalahan yang mau dihindari.
//
// Port dari scripts/hitung_stok.py (PENANDA, blok tulis baris 140-153) dan
// scripts/selisih_so.py (PENANDA, blok tulis baris 298-313).

import { bulatGenap } from './tipe';

// Rumus yang sama persis dipakai kedua tab. Ia memeriksa dirinya sendiri: kalau
// stempel di B1 sudah lewat sehari, sel ini berteriak tanpa perlu ada yang
// memeriksa. Stempel teks di kolom kanan tidak pernah dibaca siapa pun.
//
// Pemisah argumen memakai `;` (bukan `,`) karena spreadsheet tim berlokal
// Indonesia. Menggantinya dengan `,` membuat rumusnya masuk sebagai teks.
export const PENANDA =
  '=IF($B$1="";"belum pernah dihitung";' +
  'IF(TODAY()-INT($B$1)>=1;' +
  '"⚠ ANGKA LAMA — dihitung "&TEXT($B$1;"d mmm HH:mm")&", jalankan ulang hitung saldo";' +
  '"✓ Terbaru — dihitung "&TEXT($B$1;"d mmm HH:mm")))';

/** Baris pengganti kalau tabelnya kosong -- tab tidak boleh cuma berisi judul,
 *  karena rumus SUMIF di Ringkasan lalu membaca rentang kosong dan diam. */
export const KOSONG_STOK = '(belum ada data)';
export const KOSONG_SELISIH = '(semua cocok)';

/** `1234567.4` -> `1.234.567`. Setara `f"{x:,.0f}".replace(",", ".")` di Python,
 *  termasuk pembulatannya: format Python membulatkan yang tepat di tengah ke
 *  bilangan GENAP, bukan selalu ke atas seperti `Math.round()`. */
export function rupiahID(x: number): string {
  const bulat = bulatGenap(x);
  const neg = bulat < 0;
  const angka = Math.abs(bulat)
    .toFixed(0)
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return neg ? `-${angka}` : angka;
}

/** Isi sel A1:B1 -- penanda + stempel waktu sebagai NILAI tanggal, bukan teks,
 *  supaya `TODAY()-INT($B$1)` di rumus penanda bisa membandingkannya. Pemanggil
 *  WAJIB memakai valueInputOption USER_ENTERED untuk rentang ini; dengan RAW,
 *  rumusnya masuk sebagai teks dan penandanya mati. */
export function barisPenanda(stempel: string): (string | number)[][] {
  return [[PENANDA, stempel]];
}

/** Isi kolom O di tab Stok (13 kolom data + 1 kolom jeda). */
export function footerStok(
  totalNilai: number,
  tanpaHarga: number,
  peringatan: readonly string[],
): string[][] {
  return [
    [`Nilai stok Rp ${rupiahID(totalNilai)}`],
    [`${tanpaHarga} baris tanpa harga`],
    ...peringatan.map((p) => [p]),
  ];
}

/** Isi kolom M di tab Selisih SO (11 kolom data + 1 kolom jeda). */
export function footerSelisih(
  cocok: number,
  jumlahSelisih: number,
  nilaiKurang: number,
  nilaiLebih: number,
): string[][] {
  return [
    [`${cocok} produk cocok, ${jumlahSelisih} selisih`],
    [`Nilai barang kurang Rp ${rupiahID(Math.abs(nilaiKurang))}`],
    [`Nilai barang lebih Rp ${rupiahID(nilaiLebih)}`],
  ];
}
