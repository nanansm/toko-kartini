// Satu saklar, bukan penghapusan. `true` = aplikasi ini jadi LAYAR LAPORAN
// saja: rute tulis di `RUTE_TULIS` dan menunya dimatikan, pencatatan
// sepenuhnya di aplikasi tim. `false` = pencatatan hidup di sini juga.
//
// Sekarang `false`: tim minta /catat dan /hitung hidup lagi dengan lembar qty
// multi-satuan.
//
// Sejak Fase 7, /catat TIDAK LAGI menulis buku besar sendiri: antreannya masuk
// `POST /api/mutasi` -> DO `Buku` -> tab `Mutasi` milik tim, buku besar yang
// sama yang dibaca semua hitungan hilir. Jadi dua aplikasi boleh jalan
// berdampingan tanpa dua buku besar -- keduanya menambah baris ke tab yang
// sama, dan tab itu memang tambah-saja.
//
// /hitung MASIH lewat `POST /api/hitung` (Log_YYYY-MM + Sesi_SO/Tinjau_SO di
// spreadsheet kita). Jalur itu belum dipindah karena model tim tidak punya
// tinjauan bentrok sama sekali -- memindahkannya berarti MEMBUANG penahanan
// hasil SO yang bentrok, dan itu keputusan pemilik, bukan keputusan teknis.
// Selama itu belum diputuskan, saldo /hitung tetap dilipat di atas tarikan SO
// (lihat workers/cron/src/stok-so.ts).
export const MODE_LAPORAN = false;

// `/admin/penjualan` ikut di sini karena impor mengganti SELURUH isi tab
// Penjualan. Kalau aplikasi ini kembali jadi layar laporan, yang mengisi tab itu
// `import_penjualan.py` milik tim — dua pengisi untuk satu tab berarti yang
// belakangan menimpa yang duluan tanpa tanda apa pun.
export const RUTE_TULIS: readonly string[] = ['/catat', '/hitung', '/tinjau', '/admin/penjualan'];
