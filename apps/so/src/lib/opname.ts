import type { KodeLokasi } from './lokasi';

export type KeputusanTinjau = 'MUTLAK' | 'SELISIH';

/** Satu mutasi yang menyelip setelah `waktuSaldo`, untuk produk x lokasi ini. */
export interface MutasiMenyelip {
  id: number;
  waktuServer: string;
  jenis: string;
  /** SUDAH BERTANDA relatif lokasi yang dihitung: + kalau masuk, − kalau keluar. */
  qtyBertanda: number;
  user: string;
}

export interface BarisHitung {
  productId: string;
  nama: string;
  /** Sudah dalam satuan pokok (terkecil). Pemanggil yang mengubahnya. */
  qtyHitung: number;
  qtyTerlihat: number;
}

export interface HasilPeriksaHitung {
  productId: string;
  nama: string;
  qtyHitung: number;
  qtyTerlihat: number;
  /** qtyTerlihat + jumlah semua qtyBertanda. Saldo sistem saat ini. */
  qtySistem: number;
  menyelip: MutasiMenyelip[];
  bentrok: boolean;
  /** null kalau bentrok — wajib diputuskan orang dulu. */
  delta: number | null;
}

// Saldo jadi PERSIS qtyHitung — dipakai kalau barang yang menyelip SUDAH ikut terhitung.
export function deltaMutlak(qtyHitung: number, qtySistem: number): number {
  return qtyHitung - qtySistem;
}

// Saldo jadi qtySistem + selisih — dipakai kalau barang yang menyelip BELUM ikut terhitung.
// Sengaja dihitung dari qtyTerlihat (bukan qtySistem) supaya delta cuma mencerminkan
// selisih hasil hitung staf terhadap saldo yang dia lihat, bukan ikut mutasi yang menyelip.
export function deltaSelisih(qtyHitung: number, qtyTerlihat: number): number {
  return qtyHitung - qtyTerlihat;
}

export function periksaHitung(
  baris: readonly BarisHitung[],
  menyelipPerProduk: ReadonlyMap<string, readonly MutasiMenyelip[]>,
): HasilPeriksaHitung[] {
  const hasil: HasilPeriksaHitung[] = [];

  for (const b of baris) {
    if (!Number.isFinite(b.qtyHitung) || !Number.isFinite(b.qtyTerlihat)) {
      continue;
    }

    const menyelip = [...(menyelipPerProduk.get(b.productId) ?? [])];
    // qtyTerlihat SUDAH saldo penuh pada waktuSaldo — jangan hitung ulang dari nol,
    // cukup tambahkan mutasi yang menyelip sesudahnya.
    const qtySistem = menyelip.reduce((acc, m) => acc + m.qtyBertanda, b.qtyTerlihat);
    const bentrok = menyelip.length > 0;

    hasil.push({
      productId: b.productId,
      nama: b.nama,
      qtyHitung: b.qtyHitung,
      qtyTerlihat: b.qtyTerlihat,
      qtySistem,
      menyelip,
      bentrok,
      delta: bentrok ? null : deltaMutlak(b.qtyHitung, qtySistem),
    });
  }

  return hasil;
}

export function terapkanKeputusan(hasil: HasilPeriksaHitung, keputusan: KeputusanTinjau): number {
  if (keputusan === 'MUTLAK') {
    return deltaMutlak(hasil.qtyHitung, hasil.qtySistem);
  }
  return deltaSelisih(hasil.qtyHitung, hasil.qtyTerlihat);
}

export function ringkasMenyelip(menyelip: readonly MutasiMenyelip[]): string {
  return menyelip
    .map((m) => {
      const tanda = m.qtyBertanda >= 0 ? '+' : '';
      return `#${m.id} ${m.jenis} ${tanda}${m.qtyBertanda} oleh ${m.user}`;
    })
    .join('; ');
}

export interface BarisPenyesuaian {
  productId: string;
  nama: string;
  lokasi: KodeLokasi;
  /** Selalu POSITIF. Arahnya ditentukan dari/ke. */
  qtyPokok: number;
  dari: KodeLokasi | null;
  ke: KodeLokasi | null;
  qtyTerlihat: number;
}

export function deltaKePenyesuaian(
  productId: string,
  nama: string,
  lokasi: KodeLokasi,
  delta: number,
  qtyTerlihat: number,
): BarisPenyesuaian | null {
  // NaN lolos dari `=== 0` maupun `> 0` lalu berakhir sebagai Math.abs(NaN) yang
  // ditulis ke spreadsheet sebagai sel rusak. Saring di sini, bukan di pemanggil.
  if (!Number.isFinite(delta) || delta === 0) return null;

  if (delta > 0) {
    return { productId, nama, lokasi, qtyPokok: delta, dari: null, ke: lokasi, qtyTerlihat };
  }

  return { productId, nama, lokasi, qtyPokok: Math.abs(delta), dari: lokasi, ke: null, qtyTerlihat };
}
