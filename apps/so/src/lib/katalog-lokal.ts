// Salinan katalog di IndexedDB — Gudang Ciherang sinyalnya tidak bisa
// diandalkan, jadi pencarian barang wajib tetap jalan tanpa jaringan.
// Cuma jalan di peramban: jangan sentuh window/indexedDB di tingkat modul,
// berkas ini ikut ter-bundel di sisi server.

import { bukaDb, jalankan, TOKO_KATALOG } from './idb';

export interface ProdukRingkas {
  id: string;
  nama: string;
  kategori: string;
  satuan: { nama: string; pengali: number }[];
}

interface RekamKatalog {
  kunci: 'ringkas';
  waktu: string;
  jumlah: number;
  produk: ProdukRingkas[];
}

const KUNCI_RINGKAS = 'ringkas' as const;
const BATAS_CARI_BAKU = 20;

async function ambilRekam(): Promise<RekamKatalog | null> {
  const db = await bukaDb();
  if (!db) return null;

  try {
    const rekam = await jalankan<RekamKatalog | undefined>(db, TOKO_KATALOG, 'readonly', (store) =>
      store.get(KUNCI_RINGKAS),
    );
    return rekam ?? null;
  } catch {
    return null;
  }
}

async function simpanRekam(rekam: RekamKatalog): Promise<boolean> {
  const db = await bukaDb();
  if (!db) return false;

  try {
    await jalankan<IDBValidKey>(db, TOKO_KATALOG, 'readwrite', (store) => store.put(rekam));
    return true;
  } catch {
    return false;
  }
}

export async function katalogSiap(): Promise<boolean> {
  const rekam = await ambilRekam();
  return rekam !== null;
}

export async function waktuKatalogLokal(): Promise<string | null> {
  const rekam = await ambilRekam();
  return rekam?.waktu ?? null;
}

interface ResponKatalogApi {
  ok: boolean;
  takBerubah?: boolean;
  waktu?: string;
  jumlah?: number;
  produk?: ProdukRingkas[];
  pesan?: string;
}

export async function segarkanKatalogLokal(): Promise<{ jumlah: number; waktu: string } | null> {
  const rekamLama = await ambilRekam();

  try {
    const params = new URLSearchParams();
    if (rekamLama) {
      params.set('waktu', rekamLama.waktu);
    }
    const respon = await fetch(`/api/katalog?${params.toString()}`, { method: 'GET' });
    if (!respon.ok) {
      // Luring adalah keadaan yang diharapkan — biarkan salinan lama apa adanya.
      return null;
    }

    const data = (await respon.json()) as ResponKatalogApi;
    if (!data.ok) return null;

    if (data.takBerubah) {
      if (!rekamLama || !data.waktu) return null;
      return { jumlah: rekamLama.jumlah, waktu: rekamLama.waktu };
    }

    if (!data.waktu || data.jumlah === undefined || !data.produk) return null;

    const rekamBaru: RekamKatalog = {
      kunci: KUNCI_RINGKAS,
      waktu: data.waktu,
      jumlah: data.jumlah,
      produk: data.produk,
    };

    const tersimpan = await simpanRekam(rekamBaru);
    if (!tersimpan) return null;

    return { jumlah: rekamBaru.jumlah, waktu: rekamBaru.waktu };
  } catch {
    return null;
  }
}

export async function cariLokal(kata: string, batas = BATAS_CARI_BAKU): Promise<ProdukRingkas[]> {
  const rekam = await ambilRekam();
  if (!rekam) return [];

  const kataKunci = kata.trim().toLowerCase();
  if (!kataKunci) {
    return rekam.produk.slice(0, batas);
  }

  const hasil: ProdukRingkas[] = [];
  for (const produk of rekam.produk) {
    if (produk.nama.toLowerCase().includes(kataKunci) || produk.id.toLowerCase().includes(kataKunci)) {
      hasil.push(produk);
      if (hasil.length >= batas) break;
    }
  }
  return hasil;
}
