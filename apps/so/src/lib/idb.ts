// Wrapper IndexedDB mentah — tanpa paket luar (idb/dexie dilarang).
// Boleh dipakai lib lain yang butuh antrean/katalog offline.

export const NAMA_DB = 'kartini';
// v2: tambah TOKO_KERANJANG — penampungan sebelum antrean, biar staf bisa
// kumpul/ubah/hapus barang dulu sebelum sekali tekan "Kirim semua".
export const VERSI_DB = 2;
export const TOKO_ANTRE = 'antre'; // keyPath: 'clientId'
export const TOKO_KATALOG = 'katalog'; // keyPath: 'kunci'
export const TOKO_KERANJANG = 'keranjang'; // keyPath: 'id'

// Cache koneksi supaya tidak buka db berkali-kali. Dibuang saat
// koneksi ditutup/di-upgrade dari tab lain, biar panggilan berikut
// membuka koneksi baru yang sehat.
let dbCache: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase | null> | null = null;

function bukaBaru(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }

    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(NAMA_DB, VERSI_DB);
    } catch {
      // Beberapa mode penyamaran browser melempar sinkron saat open().
      resolve(null);
      return;
    }

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TOKO_ANTRE)) {
        const toko = db.createObjectStore(TOKO_ANTRE, { keyPath: 'clientId' });
        toko.createIndex('status', 'status', { unique: false });
      }
      if (!db.objectStoreNames.contains(TOKO_KATALOG)) {
        db.createObjectStore(TOKO_KATALOG, { keyPath: 'kunci' });
      }
      if (!db.objectStoreNames.contains(TOKO_KERANJANG)) {
        db.createObjectStore(TOKO_KERANJANG, { keyPath: 'id' });
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      db.onclose = () => {
        dbCache = null;
        dbPromise = null;
      };
      db.onversionchange = () => {
        db.close();
        dbCache = null;
        dbPromise = null;
      };
      dbCache = db;
      resolve(db);
    };

    req.onerror = () => {
      resolve(null);
    };
  });
}

export async function bukaDb(): Promise<IDBDatabase | null> {
  if (dbCache) return dbCache;
  if (!dbPromise) {
    dbPromise = bukaBaru();
  }
  const db = await dbPromise;
  // Kegagalan JANGAN di-cache selamanya. `open` bisa gagal sementara (kuota
  // penuh sesaat, transaksi versi dari tab lain); kalau promise gagalnya
  // disimpan, satu kegagalan sekali membuat antrean mati sampai halaman
  // dimuat ulang — padahal justru saat itulah catatan staf perlu diselamatkan.
  if (db === null) {
    dbPromise = null;
  }
  return db;
}

export function jalankan<T>(
  db: IDBDatabase,
  toko: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction;
    let req: IDBRequest;
    try {
      tx = db.transaction(toko, mode);
      req = fn(tx.objectStore(toko));
    } catch (err) {
      // `transaction()` melempar sinkron kalau koneksinya sedang ditutup.
      reject(err);
      return;
    }

    let hasil: unknown;
    req.onsuccess = () => {
      hasil = req.result;
    };

    // Selesai baru dianggap selesai saat TRANSAKSI commit, bukan saat
    // permintaannya sukses. Permintaan tulis bisa sukses lalu transaksinya
    // batal (kuota penuh), dan kalau itu dilaporkan sebagai berhasil, baris
    // yang belum sampai ke spreadsheet ditandai terkirim lalu hilang.
    tx.oncomplete = () => resolve(hasil as T);
    tx.onerror = () => reject(tx.error ?? req.error);
    tx.onabort = () => reject(tx.error ?? new Error('transaksi IndexedDB dibatalkan'));
  });
}
