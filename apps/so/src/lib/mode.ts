// Satu saklar, bukan penghapusan. Aplikasi ini jadi LAYAR LAPORAN saja —
// staf gudang mencatat/menghitung/meninjau di aplikasi tim (repo lain, data
// di Supabase + spreadsheet SO). Kalau `MODE_LAPORAN` true, rute tulis di
// `RUTE_TULIS` dan menunya dimatikan supaya tidak ada dua buku besar untuk
// gudang yang sama. Buku besar yang sah ada di aplikasi tim, bukan di sini.
// Membalik arah cukup ubah nilai ini jadi `false`, kodenya tidak dihapus.
export const MODE_LAPORAN = true;

export const RUTE_TULIS: readonly string[] = ['/catat', '/hitung', '/tinjau'];
