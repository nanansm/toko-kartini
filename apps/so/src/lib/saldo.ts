import { getCloudflareContext } from '@opennextjs/cloudflare';

export interface BarisSaldo {
  productId: string;
  lokasi: string;
  qty: number;
}

// Bentuk yang ditulis worker cron ke `saldo:v1`. Jangan diubah tanpa mengubah
// workers/cron/src/saldo.ts — dua tempat harus sepakat.
export interface SaldoTersimpan {
  versi: number;
  waktu: string;
  bulan: string;
  jumlah: number;
  /** `id` Log terakhir yang IKUT terhitung di saldo ini. Batas mutasi susulan
   *  memakai angka ini, bukan `waktu`: cap waktu diambil sebelum Log dibaca,
   *  jadi baris yang masuk di sela itu sudah ikut terjumlah TAPI cap waktunya
   *  lebih baru — kalau `waktu` dipakai sebagai batas, baris itu terhitung dua
   *  kali. `id` naik berurutan dan tidak punya celah itu. */
  idTerakhir: number;
  saldo: BarisSaldo[];
}

export async function ambilSaldo(): Promise<SaldoTersimpan | null> {
  const { env } = getCloudflareContext();
  return env.KATALOG.get<SaldoTersimpan>('saldo:v1', 'json');
}

export interface SaldoLokasi {
  /** Lihat SaldoTersimpan.idTerakhir. Ini batas yang dipakai, bukan `waktu`. */
  idTerakhir: number;
  /** Cap waktu saldo ini dihitung. INI yang jadi `waktu_saldo` sesi hitung —
   *  bukan jam layar dibuka. Angka di `peta` sah persis pada detik ini, jadi
   *  mutasi yang menyelip sesudahnya bisa dijumlahkan di atasnya tanpa
   *  menghitung ulang seluruh Log. */
  waktu: string;
  bulan: string;
  peta: Map<string, number>;
}

export async function saldoDiLokasi(lokasi: string): Promise<SaldoLokasi | null> {
  const bungkus = await ambilSaldo();
  if (!bungkus) return null;

  const peta = new Map<string, number>();
  for (const baris of bungkus.saldo) {
    if (baris.lokasi === lokasi) peta.set(baris.productId, baris.qty);
  }
  return { waktu: bungkus.waktu, idTerakhir: bungkus.idTerakhir ?? 0, bulan: bungkus.bulan, peta };
}

/** Saldo satu produk di semua lokasi nyata — untuk kartu stok. */
export async function saldoPerLokasi(productId: string): Promise<{ waktu: string; baris: BarisSaldo[] } | null> {
  const bungkus = await ambilSaldo();
  if (!bungkus) return null;
  return { waktu: bungkus.waktu, baris: bungkus.saldo.filter((b) => b.productId === productId) };
}

/** Total per produk di seluruh lokasi nyata — untuk perbandingan stok minimum. */
export async function totalPerProduk(): Promise<{ waktu: string; peta: Map<string, number> } | null> {
  const bungkus = await ambilSaldo();
  if (!bungkus) return null;

  const peta = new Map<string, number>();
  for (const baris of bungkus.saldo) {
    peta.set(baris.productId, (peta.get(baris.productId) ?? 0) + baris.qty);
  }
  return { waktu: bungkus.waktu, peta };
}
