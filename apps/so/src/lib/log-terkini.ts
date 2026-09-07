import { bacaLog, namaTabLog, type BarisLog } from '@kartini/sheets';
import { LOKASI_MAYA } from './lokasi';
import type { MutasiMenyelip } from './opname';

const MAYA = new Set<string>(LOKASI_MAYA);

export async function bacaLogBulanIni(sheetId: string, sekarang = new Date()): Promise<BarisLog[]> {
  return bacaLog(sheetId, namaTabLog(sekarang));
}

/**
 * Tanda qty satu baris relatif SATU lokasi: +1 kalau barang masuk ke situ,
 * −1 kalau keluar, 0 kalau baris itu tidak menyentuh lokasi tersebut.
 * Lokasi maya (Barang Datang / Barang Rusak) tidak pernah punya saldo, jadi
 * baris yang cuma menyentuh lokasi maya dihitung 0 untuk lokasi maya itu.
 */
export function tandaUntukLokasi(baris: BarisLog, lokasi: string): number {
  if (MAYA.has(lokasi)) return 0;
  if (baris.ke === lokasi) return 1;
  if (baris.dari === lokasi) return -1;
  return 0;
}

/**
 * Batas "sudah terhitung" memakai nomor `id`, BUKAN cap waktu. Cap waktu di
 * saldo diambil sebelum Log dibaca, jadi baris yang masuk di sela itu ikut
 * terjumlah di saldo padahal waktunya lebih baru — memakai waktu sebagai batas
 * membuatnya terhitung dua kali. `id` naik berurutan dan ditetapkan oleh satu
 * penulis tunggal (Durable Object), jadi tidak punya celah itu dan kebal
 * terhadap dua baris yang kebetulan sedetik.
 */
interface OpsiSaring {
  sejakId: number;
  lokasi: string;
  produk: ReadonlySet<string>;
}

function* barisRelevan(log: readonly BarisLog[], opsi: OpsiSaring) {
  for (const baris of log) {
    if (!opsi.produk.has(baris.productId)) continue;
    if (baris.id <= opsi.sejakId) continue;
    const tanda = tandaUntukLokasi(baris, opsi.lokasi);
    if (tanda === 0) continue;
    // qty_pokok kosong atau bukan angka: JANGAN dianggap nol. Nol berarti
    // "mutasi ini tidak memindahkan apa pun", dan itu membuat data rusak
    // terbaca sebagai saldo yang waras.
    if (baris.qtyPokok === null) continue;
    yield { baris, qtyBertanda: tanda * baris.qtyPokok };
  }
}

/** Mutasi yang menyelip sesudah baris ber-`id` `sejakId`, dikelompokkan per produk. */
export function menyelipSejak(
  log: readonly BarisLog[],
  sejakId: number,
  lokasi: string,
  produk: ReadonlySet<string>,
): Map<string, MutasiMenyelip[]> {
  const peta = new Map<string, MutasiMenyelip[]>();
  for (const { baris, qtyBertanda } of barisRelevan(log, { sejakId, lokasi, produk })) {
    const daftar = peta.get(baris.productId) ?? [];
    daftar.push({
      id: baris.id,
      waktuServer: baris.waktuServer,
      jenis: baris.jenis,
      qtyBertanda,
      user: baris.user,
    });
    peta.set(baris.productId, daftar);
  }
  return peta;
}

/** Jumlah bertanda mutasi sesudah baris ber-`id` `sejakId`, per produk. Untuk menambal saldo KV
 *  yang cap waktunya lebih tua daripada keadaan sekarang. */
export function pergeseranSejak(
  log: readonly BarisLog[],
  sejakId: number,
  lokasi: string,
  produk: ReadonlySet<string>,
): Map<string, number> {
  const peta = new Map<string, number>();
  for (const { baris, qtyBertanda } of barisRelevan(log, { sejakId, lokasi, produk })) {
    peta.set(baris.productId, (peta.get(baris.productId) ?? 0) + qtyBertanda);
  }
  return peta;
}

/** Baris kejanggalan untuk ditampilkan/dicatat: qty_pokok yang tidak terbaca. */
export function barisQtyRusak(log: readonly BarisLog[]): number[] {
  return log.filter((b) => b.qtyPokok === null).map((b) => b.id);
}
