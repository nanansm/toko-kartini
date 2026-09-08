// Satu saklar, bukan penghapusan. `true` = aplikasi ini jadi LAYAR LAPORAN
// saja: rute tulis di `RUTE_TULIS` dan menunya dimatikan, pencatatan
// sepenuhnya di aplikasi tim. `false` = pencatatan hidup di sini juga.
//
// Sekarang `false`: tim minta /catat dan /hitung hidup lagi dengan lembar qty
// multi-satuan. Selama dua aplikasi jalan berdampingan, saldo dihitung dari
// tarikan SO sebagai dasar + Log aplikasi ini dilipat di atasnya (lihat
// workers/cron/src/stok-so.ts), jadi tidak ada dua buku besar yang saling
// menimpa.
export const MODE_LAPORAN = false;

export const RUTE_TULIS: readonly string[] = ['/catat', '/hitung', '/tinjau'];
