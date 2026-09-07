import { type KodeLokasi, GUDANG, LOKASI_NYATA, isKodeLokasi } from './lokasi';

export type JenisMutasi = 'DATANG' | 'ISI_DISPLAY' | 'PINDAH' | 'RUSAK' | 'OPNAME';
export type SebabRusak = 'RUSAK_PECAH' | 'KADALUARSA' | 'DIPAKAI_TOKO';

const SEMUA_JENIS: readonly JenisMutasi[] = ['DATANG', 'ISI_DISPLAY', 'PINDAH', 'RUSAK', 'OPNAME'];
const SEMUA_SEBAB: readonly SebabRusak[] = ['RUSAK_PECAH', 'KADALUARSA', 'DIPAKAI_TOKO'];

export const LABEL_JENIS: Record<JenisMutasi, string> = {
  DATANG: 'Barang Datang',
  ISI_DISPLAY: 'Isi Display',
  PINDAH: 'Pindah Gudang',
  RUSAK: 'Barang Rusak',
  OPNAME: 'Hitung Stok',
};

// Tidak ada "Hilang" — tim sengaja meniadakannya, jangan ditambahkan.
export const LABEL_SEBAB: Record<SebabRusak, string> = {
  RUSAK_PECAH: 'Rusak / pecah',
  KADALUARSA: 'Kadaluarsa',
  DIPAKAI_TOKO: 'Dipakai toko sendiri',
};

export const ARAH_SAH: Record<
  JenisMutasi,
  { dari: readonly KodeLokasi[]; ke: readonly KodeLokasi[] }
> = {
  DATANG: { dari: ['BARANG_DATANG'], ke: LOKASI_NYATA },
  ISI_DISPLAY: { dari: GUDANG, ke: ['AREA_DISPLAY'] },
  PINDAH: { dari: GUDANG, ke: GUDANG },
  RUSAK: { dari: LOKASI_NYATA, ke: ['BARANG_RUSAK'] },
  OPNAME: { dari: [], ke: [] },
};

export interface SatuanTingkat {
  nama: string;
  pengali: number;
}

export function keQtyPokok(
  qtyInput: number,
  satuanNama: string,
  satuan: readonly SatuanTingkat[],
): number | null {
  const namaDicari = satuanNama.trim().toLowerCase();
  const tingkat = satuan.find((s) => s.nama.trim().toLowerCase() === namaDicari);
  if (!tingkat) return null;
  return qtyInput * tingkat.pengali;
}

export interface MasukanMutasi {
  clientId: string;
  jenis: string;
  productId: string;
  namaSaatItu: string;
  satuanInput: string;
  qtyInput: number;
  dari: string | null;
  ke: string | null;
  sebab: string | null;
  catatan: string | null;
}

export interface BarisMutasi {
  clientId: string;
  jenis: JenisMutasi;
  productId: string;
  namaSaatItu: string;
  qtyPokok: number;
  satuanInput: string;
  qtyInput: number;
  dari: KodeLokasi | null;
  ke: KodeLokasi | null;
  sebab: SebabRusak | null;
  catatan: string | null;
}

export type HasilPeriksa = { ok: true; baris: BarisMutasi } | { ok: false; pesan: string };

function isJenisMutasi(nilai: string): nilai is JenisMutasi {
  return (SEMUA_JENIS as readonly string[]).includes(nilai);
}

function isSebabRusak(nilai: string): nilai is SebabRusak {
  return (SEMUA_SEBAB as readonly string[]).includes(nilai);
}

export function periksaMutasi(
  masukan: MasukanMutasi,
  satuan: readonly SatuanTingkat[],
): HasilPeriksa {
  if (masukan.clientId.trim() === '') {
    return { ok: false, pesan: 'ID transaksi (clientId) tidak boleh kosong.' };
  }

  if (!isJenisMutasi(masukan.jenis)) {
    return { ok: false, pesan: `Jenis mutasi "${masukan.jenis}" tidak dikenal.` };
  }

  if (masukan.jenis === 'OPNAME') {
    // Hitung stok punya jalur sendiri (belum dibangun). Menerimanya lewat pintu
    // mutasi biasa akan menghasilkan baris yang salah arti (tanpa asal/tujuan).
    return {
      ok: false,
      pesan: 'Hitung stok (opname) punya jalurnya sendiri, belum tersedia di sini.',
    };
  }
  const jenis: JenisMutasi = masukan.jenis;

  if (masukan.productId.trim() === '') {
    return { ok: false, pesan: 'Produk wajib dipilih.' };
  }

  if (!Number.isFinite(masukan.qtyInput) || masukan.qtyInput <= 0) {
    return { ok: false, pesan: 'Jumlah harus angka lebih besar dari nol.' };
  }

  const arahSah = ARAH_SAH[jenis];

  if (masukan.dari === null || masukan.dari.trim() === '') {
    return { ok: false, pesan: 'Lokasi asal wajib diisi.' };
  }
  if (!isKodeLokasi(masukan.dari) || !arahSah.dari.includes(masukan.dari)) {
    return {
      ok: false,
      pesan: `Lokasi asal tidak valid untuk mutasi "${LABEL_JENIS[jenis]}".`,
    };
  }
  const dari: KodeLokasi = masukan.dari;

  if (masukan.ke === null || masukan.ke.trim() === '') {
    return { ok: false, pesan: 'Lokasi tujuan wajib diisi.' };
  }
  if (!isKodeLokasi(masukan.ke) || !arahSah.ke.includes(masukan.ke)) {
    return {
      ok: false,
      pesan: `Lokasi tujuan tidak valid untuk mutasi "${LABEL_JENIS[jenis]}".`,
    };
  }
  const ke: KodeLokasi = masukan.ke;

  if (jenis === 'PINDAH' && dari === ke) {
    return { ok: false, pesan: 'Lokasi asal dan tujuan tidak boleh sama.' };
  }

  let sebab: SebabRusak | null = null;
  const sebabMentah = masukan.sebab?.trim() ?? '';
  if (jenis === 'RUSAK') {
    if (sebabMentah === '' || !isSebabRusak(sebabMentah)) {
      return { ok: false, pesan: 'Sebab barang rusak wajib dipilih.' };
    }
    sebab = sebabMentah;
  } else if (sebabMentah !== '') {
    return { ok: false, pesan: `Sebab tidak boleh diisi untuk mutasi "${LABEL_JENIS[jenis]}".` };
  }

  const qtyPokok = keQtyPokok(masukan.qtyInput, masukan.satuanInput, satuan);
  if (qtyPokok === null) {
    return { ok: false, pesan: `Satuan "${masukan.satuanInput}" tidak dikenal untuk produk ini.` };
  }

  const catatanRapi = masukan.catatan?.trim() ?? '';

  return {
    ok: true,
    baris: {
      clientId: masukan.clientId,
      jenis,
      productId: masukan.productId,
      namaSaatItu: masukan.namaSaatItu,
      qtyPokok,
      satuanInput: masukan.satuanInput,
      qtyInput: masukan.qtyInput,
      dari,
      ke,
      sebab,
      catatan: catatanRapi === '' ? null : catatanRapi,
    },
  };
}
