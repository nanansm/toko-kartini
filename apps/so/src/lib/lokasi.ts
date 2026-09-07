export type KodeLokasi =
  | 'GUDANG_PACKAGING'
  | 'GUDANG_BAHAN_KUE'
  | 'GUDANG_CIHERANG'
  | 'GUDANG_DAPUR_CHERRY'
  | 'AREA_DISPLAY'
  | 'BARANG_DATANG' // maya: asal barang dari supplier
  | 'BARANG_RUSAK'; // maya: jalan keluar satu arah

export const LOKASI_NYATA: readonly KodeLokasi[] = [
  'GUDANG_PACKAGING',
  'GUDANG_BAHAN_KUE',
  'GUDANG_CIHERANG',
  'GUDANG_DAPUR_CHERRY',
  'AREA_DISPLAY',
];

export const LOKASI_MAYA: readonly KodeLokasi[] = ['BARANG_DATANG', 'BARANG_RUSAK'];

export const SEMUA_LOKASI: readonly KodeLokasi[] = [...LOKASI_NYATA, ...LOKASI_MAYA];

export const LABEL_LOKASI: Record<KodeLokasi, string> = {
  GUDANG_PACKAGING: 'Gudang Packaging',
  GUDANG_BAHAN_KUE: 'Gudang Bahan Kue',
  GUDANG_CIHERANG: 'Gudang Ciherang',
  GUDANG_DAPUR_CHERRY: 'Gudang Dapur Cherry',
  AREA_DISPLAY: 'Area Display',
  BARANG_DATANG: 'Barang Datang',
  BARANG_RUSAK: 'Barang Rusak',
};

export const GUDANG: readonly KodeLokasi[] = LOKASI_NYATA.filter(
  (kode) => kode !== 'AREA_DISPLAY',
);

const SET_SEMUA_LOKASI = new Set<string>(SEMUA_LOKASI);

export function isKodeLokasi(nilai: string): nilai is KodeLokasi {
  return SET_SEMUA_LOKASI.has(nilai);
}
