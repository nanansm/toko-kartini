import { getCloudflareContext } from '@opennextjs/cloudflare';

export interface BarisNilaiLokasi {
  lokasi: string; // kode, mis. "GUDANG_PACKAGING"
  qty: number; // total satuan pokok di lokasi itu; BOLEH NEGATIF
  nilai: number; // rupiah, qty × harga beli per satuan pokok
  jumlahProduk: number;
}

// Bentuk yang ditulis worker cron ke `nilai:v1`. Jangan diubah tanpa mengubah
// workers/cron/src/nilai.ts — dua tempat harus sepakat.
export interface NilaiTersimpan {
  versi: 1;
  waktu: string; // ISO
  waktuSaldo: string; // ISO
  totalQty: number;
  totalNilai: number;
  qtyTanpaHarga: number; // qty yang produknya tak punya harga; TIDAK ikut totalNilai
  produkTanpaHarga: number;
  lokasi: BarisNilaiLokasi[]; // sudah urut, 5 lokasi nyata dulu
}

export async function ambilNilai(): Promise<NilaiTersimpan | null> {
  const { env } = getCloudflareContext();
  return env.KATALOG.get<NilaiTersimpan>('nilai:v1', 'json');
}
