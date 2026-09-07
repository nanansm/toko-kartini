import { bukaDb, jalankan, TOKO_ANTRE } from './idb';
import type { MasukanMutasi } from './mutasi';

export type StatusAntre = 'menunggu' | 'terkirim' | 'gagal';

export interface ItemAntre {
  clientId: string;
  muatan: MasukanMutasi;
  status: StatusAntre;
  pesan: string | null;
  dibuat: number;
  percobaan: number;
  berikutnya: number;
}

// Jeda coba-lagi bertahap, mentok di 5 menit — hindari banjir request
// saat jaringan lagi jelek.
const JEDA_TAHAP_MS = [5_000, 15_000, 60_000, 300_000];

export async function antreanTersedia(): Promise<boolean> {
  const db = await bukaDb();
  return db !== null;
}

export async function tambahAntre(muatan: MasukanMutasi): Promise<ItemAntre | null> {
  const db = await bukaDb();
  if (!db) return null;

  try {
    const ada = await jalankan<ItemAntre | undefined>(db, TOKO_ANTRE, 'readonly', (store) =>
      store.get(muatan.clientId),
    );
    // Jangan timpa — pengiriman ulang wajib pakai clientId yang sama
    // dan barisnya harus tetap yang pertama kali dibuat.
    if (ada) return ada;

    const item: ItemAntre = {
      clientId: muatan.clientId,
      muatan,
      status: 'menunggu',
      pesan: null,
      dibuat: Date.now(),
      percobaan: 0,
      berikutnya: Date.now(),
    };
    await jalankan<IDBValidKey>(db, TOKO_ANTRE, 'readwrite', (store) => store.add(item));
    return item;
  } catch {
    // `add` menolak kunci yang sudah ada. Antara pemeriksaan di atas dan
    // penulisan ini bisa terselip penyimpanan dari tab lain, dan itu BUKAN
    // kegagalan — barisnya memang sudah antre. Yang lama dipulangkan supaya
    // pemanggil tidak mengira catatannya hilang lalu membuat clientId baru.
    try {
      const ada = await jalankan<ItemAntre | undefined>(db, TOKO_ANTRE, 'readonly', (store) =>
        store.get(muatan.clientId),
      );
      return ada ?? null;
    } catch {
      return null;
    }
  }
}

export async function ambilSiapKirim(sekarang: number, batas: number): Promise<ItemAntre[]> {
  const db = await bukaDb();
  if (!db) return [];

  try {
    const semua = await jalankan<ItemAntre[]>(db, TOKO_ANTRE, 'readonly', (store) =>
      store.getAll(),
    );
    return semua
      .filter((it) => it.status === 'menunggu' && it.berikutnya <= sekarang)
      .sort((a, b) => a.dibuat - b.dibuat)
      .slice(0, batas);
  } catch {
    return [];
  }
}

export async function ambilSemua(): Promise<ItemAntre[]> {
  const db = await bukaDb();
  if (!db) return [];

  try {
    const semua = await jalankan<ItemAntre[]>(db, TOKO_ANTRE, 'readonly', (store) =>
      store.getAll(),
    );
    return semua.sort((a, b) => b.dibuat - a.dibuat);
  } catch {
    return [];
  }
}

async function ubahItem(
  clientId: string,
  ubah: (item: ItemAntre) => ItemAntre,
): Promise<void> {
  const db = await bukaDb();
  if (!db) return;

  try {
    const item = await jalankan<ItemAntre | undefined>(db, TOKO_ANTRE, 'readonly', (store) =>
      store.get(clientId),
    );
    if (!item) return;
    await jalankan<IDBValidKey>(db, TOKO_ANTRE, 'readwrite', (store) => store.put(ubah(item)));
  } catch {
    // diam — antrean yang gagal ditulis tidak boleh menjatuhkan layar pencatatan
  }
}

export async function tandaiTerkirim(clientId: string): Promise<void> {
  await ubahItem(clientId, (item) => ({ ...item, status: 'terkirim', pesan: null }));
}

export async function tandaiGagal(clientId: string, pesan: string): Promise<void> {
  // Baris TETAP disimpan (bukan dihapus) supaya penyebabnya terlihat.
  await ubahItem(clientId, (item) => ({ ...item, status: 'gagal', pesan }));
}

export async function tundaKirim(clientId: string, pesan: string | null): Promise<void> {
  await ubahItem(clientId, (item) => {
    const percobaan = item.percobaan + 1;
    const jeda = JEDA_TAHAP_MS[Math.min(percobaan - 1, JEDA_TAHAP_MS.length - 1)] ?? 300_000;
    return {
      ...item,
      status: 'menunggu',
      percobaan,
      pesan,
      berikutnya: Date.now() + jeda,
    };
  });
}

export async function hitungMenunggu(): Promise<number> {
  const db = await bukaDb();
  if (!db) return 0;

  try {
    const semua = await jalankan<ItemAntre[]>(db, TOKO_ANTRE, 'readonly', (store) =>
      store.getAll(),
    );
    return semua.filter((it) => it.status === 'menunggu').length;
  } catch {
    return 0;
  }
}

export async function pangkasTerkirimLama(maksUmurHari = 7): Promise<void> {
  const db = await bukaDb();
  if (!db) return;

  const batasWaktu = Date.now() - maksUmurHari * 24 * 60 * 60 * 1000;

  try {
    const semua = await jalankan<ItemAntre[]>(db, TOKO_ANTRE, 'readonly', (store) =>
      store.getAll(),
    );
    const kunciDihapus = semua
      .filter((it) => it.status === 'terkirim' && it.dibuat < batasWaktu)
      .map((it) => it.clientId);

    for (const kunci of kunciDihapus) {
      await jalankan<undefined>(db, TOKO_ANTRE, 'readwrite', (store) => store.delete(kunci));
    }
  } catch {
    // diam — pemangkasan gagal tidak fatal, baris lama cuma menumpuk
  }
}
