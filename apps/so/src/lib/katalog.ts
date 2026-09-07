import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { ProdukSheet } from '@kartini/sheets';

export interface BungkusKatalog {
  versi: number;
  waktu: string;
  jumlah: number;
  produk: ProdukSheet[];
}

export interface MetaKatalog {
  versi: number;
  waktu: string;
  jumlahProduk: number;
  jumlahPincang: number;
  dilewati: number;
  barisMentah: number;
  sidik: string;
}

export interface ErrorKatalog {
  waktu: string;
  pesan: string;
  jumlahBaru: number;
  jumlahLama: number;
}

// Bentuk ramping yang ditulis cron ke `katalog:cari`. Sengaja bukan ProdukSheet:
// layar pencatatan cuma butuh empat kolom ini, dan catatan lengkapnya 412 KB.
export interface ProdukRingkas {
  id: string;
  nama: string;
  kategori: string;
  satuan: { nama: string; pengali: number }[];
}

export interface BungkusRingkas {
  versi: number;
  waktu: string;
  jumlah: number;
  produk: ProdukRingkas[];
}

const BATAS_CARI_BAKU = 50;

export async function ambilKatalog(): Promise<BungkusKatalog | null> {
  const { env } = getCloudflareContext();
  return env.KATALOG.get<BungkusKatalog>('katalog:v1', 'json');
}

export async function ambilPincang(): Promise<BungkusKatalog | null> {
  const { env } = getCloudflareContext();
  return env.KATALOG.get<BungkusKatalog>('katalog:pincang', 'json');
}

export async function ambilMetaKatalog(): Promise<MetaKatalog | null> {
  const { env } = getCloudflareContext();
  return env.KATALOG.get<MetaKatalog>('katalog:meta', 'json');
}

export async function ambilErrorKatalog(): Promise<ErrorKatalog | null> {
  const { env } = getCloudflareContext();
  return env.KATALOG.get<ErrorKatalog>('katalog:error', 'json');
}

export async function ambilKatalogRingkas(): Promise<BungkusRingkas | null> {
  const { env } = getCloudflareContext();
  return env.KATALOG.get<BungkusRingkas>('katalog:cari', 'json');
}

// Satu bacaan `katalog:cari` (181 KB) untuk banyak id sekaligus — bukan satu
// bacaan per id, supaya CPU tidak terbakar mengulang data yang sama.
export async function petaProdukRingkas(ids: readonly string[]): Promise<Map<string, ProdukRingkas>> {
  const katalog = await ambilKatalogRingkas();
  const peta = new Map<string, ProdukRingkas>();
  if (!katalog) return peta;

  const dicari = new Set(ids);
  for (const produk of katalog.produk) {
    if (dicari.has(produk.id)) {
      peta.set(produk.id, produk);
    }
  }
  return peta;
}

// Menyaring `katalog:cari`, yang isinya sudah bersih dari barang pincang —
// jangan pernah digabung dengan katalog:pincang, layar pencatatan tidak boleh
// melihatnya.
export async function cariProduk(kata: string, batas = BATAS_CARI_BAKU): Promise<ProdukRingkas[]> {
  const katalog = await ambilKatalogRingkas();
  if (!katalog) return [];

  const kataKunci = kata.trim().toLowerCase();
  if (!kataKunci) {
    return katalog.produk.slice(0, batas);
  }

  const hasil: ProdukRingkas[] = [];
  for (const produk of katalog.produk) {
    if (produk.nama.toLowerCase().includes(kataKunci) || produk.id.toLowerCase().includes(kataKunci)) {
      hasil.push(produk);
      if (hasil.length >= batas) break;
    }
  }
  return hasil;
}
