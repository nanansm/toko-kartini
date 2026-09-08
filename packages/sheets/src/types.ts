export interface SatuanTingkat {
  nama: string;
  pengali: number;
  sku: string;
  unitOrder: number;
}

export interface ProdukSheet {
  productId: string;
  nama: string;
  kategori: string;
  brand: string | null;
  supplier: string | null;
  hppGrosir: number | null;
  satuanGrosir: string | null;
  satuan: SatuanTingkat[];
  hargaGrosir: number | null;
  hj1: number | null;
  hj2: number | null;
  hj3: number | null;
  barisSheet: number;
  pincang: boolean;
  alasanPincang: string[];
}

export interface HasilParse {
  produk: ProdukSheet[];
  pincang: ProdukSheet[];
  dilewati: number;
}
