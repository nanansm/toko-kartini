import { bukaDb, jalankan, TOKO_KERANJANG } from './idb';
import type { JenisMutasi } from './mutasi';

export interface ItemKeranjang {
  id: string;
  jenis: JenisMutasi;
  productId: string;
  nama: string;
  /** qty per nama satuan, mis. { 'Krtn (12 Pcs)': 3, 'Pcs': 1 }. Nilai 0
   *  tidak disimpan. */
  qtySatuan: Record<string, number>;
  dari: string | null;
  ke: string | null;
  sebab: string | null;
  catatan: string | null;
  dibuat: number;
}

export async function tambahKeranjang(
  item: Omit<ItemKeranjang, 'id' | 'dibuat'>,
): Promise<ItemKeranjang | null> {
  const db = await bukaDb();
  if (!db) return null;

  const baru: ItemKeranjang = {
    ...item,
    id: crypto.randomUUID(),
    dibuat: Date.now(),
  };

  try {
    await jalankan<IDBValidKey>(db, TOKO_KERANJANG, 'readwrite', (store) => store.add(baru));
    return baru;
  } catch {
    // diam — kegagalan penyimpanan lokal tidak boleh menjatuhkan layar pencatatan
    return null;
  }
}

export async function ubahKeranjang(
  id: string,
  ubah: Partial<Omit<ItemKeranjang, 'id' | 'dibuat'>>,
): Promise<ItemKeranjang | null> {
  const db = await bukaDb();
  if (!db) return null;

  try {
    const ada = await jalankan<ItemKeranjang | undefined>(db, TOKO_KERANJANG, 'readonly', (store) =>
      store.get(id),
    );
    if (!ada) return null;

    const digabung: ItemKeranjang = { ...ada, ...ubah };
    await jalankan<IDBValidKey>(db, TOKO_KERANJANG, 'readwrite', (store) => store.put(digabung));
    return digabung;
  } catch {
    return null;
  }
}

export async function hapusKeranjang(id: string): Promise<ItemKeranjang | null> {
  const db = await bukaDb();
  if (!db) return null;

  try {
    const ada = await jalankan<ItemKeranjang | undefined>(db, TOKO_KERANJANG, 'readonly', (store) =>
      store.get(id),
    );
    if (!ada) return null;

    await jalankan<undefined>(db, TOKO_KERANJANG, 'readwrite', (store) => store.delete(id));
    return ada;
  } catch {
    return null;
  }
}

export async function pulihkanKeranjang(item: ItemKeranjang): Promise<boolean> {
  const db = await bukaDb();
  if (!db) return false;

  try {
    // `id` dan `dibuat` asli dipertahankan apa adanya — kalau `dibuat` dibuat
    // baru, urutan daftar melompat dan barisnya seolah pindah tempat setelah
    // diurungkan.
    await jalankan<IDBValidKey>(db, TOKO_KERANJANG, 'readwrite', (store) => store.put(item));
    return true;
  } catch {
    return false;
  }
}

export async function ambilKeranjang(): Promise<ItemKeranjang[]> {
  const db = await bukaDb();
  if (!db) return [];

  try {
    const semua = await jalankan<ItemKeranjang[]>(db, TOKO_KERANJANG, 'readonly', (store) =>
      store.getAll(),
    );
    return semua.sort((a, b) => a.dibuat - b.dibuat);
  } catch {
    return [];
  }
}

export async function kosongkanKeranjang(ids: string[]): Promise<void> {
  const db = await bukaDb();
  if (!db) return;

  try {
    for (const id of ids) {
      await jalankan<undefined>(db, TOKO_KERANJANG, 'readwrite', (store) => store.delete(id));
    }
  } catch {
    // diam — baris yang gagal dihapus tetap tinggal di keranjang, tidak fatal
  }
}
