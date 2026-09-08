// Port persis dari scripts/harga_lookup.py milik tim. Aturan pencarian HPP
// harus sama persis di semua tempat yang menghitung nilai stok -- kalau
// beda cara hitung, angka gudang dan angka display tidak bisa dijumlahkan
// dan angka selisih ikut salah.

import type { BarisHarga } from './tipe';
import { angkaID, bulatGenap } from './tipe';

export interface Harga {
  hpp: number | null;
  jual: number | null;
}

export interface PetaHarga {
  cari(sku: string, produk: string, satuan: string): Harga | null;
  /** Kunci (produk|satuan) yang HPP-nya berbeda-beda antar baris. */
  bentrok: string[];
}

/**
 * Bangun peta pencarian HPP dari baris tab Harga.
 *
 * Dua jalan cari, berurutan: lewat SKU (paling tepat), lalu lewat
 * (produk, satuan) untuk baris yang tidak punya SKU.
 */
export function bangunPetaHarga(baris: BarisHarga[]): PetaHarga {
  const perSku = new Map<string, Harga>();
  const kandidat = new Map<string, Harga[]>();

  for (const r of baris) {
    // Baris tanpa HPP terbaca dilewati sepenuhnya, bukan dianggap 0 --
    // nol berarti "harganya nol", kosong berarti "tidak diketahui".
    if (r.hpp === null) continue;
    const harga: Harga = { hpp: r.hpp, jual: r.jual };
    if (r.sku) perSku.set(r.sku, harga);
    if (r.produk && r.satuan) {
      const kunci = `${r.produk}|${r.satuan}`;
      const daftar = kandidat.get(kunci);
      if (daftar) daftar.push(harga);
      else kandidat.set(kunci, [harga]);
    }
  }

  const perNama = new Map<string, Harga>();
  const bentrok: string[] = [];
  for (const [kunci, daftar] of kandidat) {
    const hppBeda = new Set(daftar.map((d) => d.hpp));
    if (hppBeda.size > 1) {
      // HPP yang berbeda tidak boleh ditebak -- menebaknya berarti nilai
      // stok berubah tanpa ada yang tahu dari mana angkanya. Kunci ini
      // dibuang dari peta dan dicatat sebagai bentrok.
      bentrok.push(kunci);
      continue;
    }
    // HPP sama di semua slot, tapi harga jual bisa cuma terisi di salah
    // satu (grosir sering kosong, HJ3 terisi) -- ambil yang punya harga
    // jual supaya tidak hilang percuma.
    const dg = daftar.find((d) => d.jual !== null) ?? daftar[0];
    if (dg) perNama.set(kunci, dg);
  }

  return {
    bentrok,
    cari(sku: string, produk: string, satuan: string): Harga | null {
      // SKU menang atas nama. Kalau SKU ada tapi tidak ditemukan di peta,
      // tetap jatuh ke pencarian lewat (produk, satuan) -- bukan langsung
      // dianggap tidak ketemu.
      if (sku) {
        const h = perSku.get(sku);
        if (h) return h;
      }
      return perNama.get(`${produk}|${satuan}`) ?? null;
    },
  };
}

/** qty x hpp, dibulatkan ke rupiah. '' kalau salah satunya tidak ada. */
export function nilaiRupiah(qty: number | null, hpp: number | null): number | '' {
  if (hpp === null || qty === null) return '';
  return bulatGenap(qty * hpp);
}

/**
 * Urai baris mentah tab Harga (tanpa header) jadi BarisHarga.
 * Kolom: 0 SKU, 1 Produk, 2 Satuan, 3 Isi, 4 HPP, 5 Harga Jual, 6 Slot, 7 Kategori.
 */
export function uraiHarga(rows: string[][]): BarisHarga[] {
  const hasil: BarisHarga[] = [];
  for (const row of rows) {
    const hpp = angkaID(row[4]);
    // Baris yang HPP-nya kosong atau tak terbaca dilewati di sini juga,
    // supaya tidak lolos ke peta manapun.
    if (hpp === null) continue;
    hasil.push({
      sku: (row[0] ?? '').toString().trim(),
      produk: (row[1] ?? '').toString().trim(),
      satuan: (row[2] ?? '').toString().trim(),
      isi: (row[3] ?? '').toString().trim(),
      hpp,
      jual: angkaID(row[5]),
      slot: (row[6] ?? '').toString().trim(),
      kategori: (row[7] ?? '').toString().trim(),
    });
  }
  return hasil;
}
