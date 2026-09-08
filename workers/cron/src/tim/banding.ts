import { batchGet } from '@kartini/sheets';
import { uraiLog, uraiMutasi, uraiPenjualan } from './urai';
import { bangunPetaHarga, uraiHarga } from './harga';
import { hitungStok, keSelStok, HEADER_STOK } from './stok';
import { hitungSelisih, keSelSelisih, HEADER_SELISIH } from './selisih';

/**
 * Gerbang Fase 5. Menghitung ulang tab `Stok` dan `Selisih SO` dari Log/Mutasi/
 * Harga/Penjualan, lalu MEMBANDINGKAN hasilnya dengan isi tab itu sekarang --
 * yang masih ditulis skrip Python milik tim.
 *
 * Sengaja TIDAK menulis apa pun. Selama skrip mereka masih dipakai, dua penulis
 * ke tab yang sama akan saling menimpa dan tidak ada yang tahu angka siapa yang
 * bertahan. Penulisan baru dinyalakan sesudah gerbang ini bersih dan skrip
 * mereka dipensiunkan (Fase 7).
 */

export interface Beda {
  baris: number;
  kolom: string;
  kami: string;
  mereka: string;
}

export interface HasilBanding {
  ok: boolean;
  stok: { barisKami: number; barisMereka: number; beda: number; contoh: Beda[] };
  selisih: { barisKami: number; barisMereka: number; beda: number; contoh: Beda[] };
  peringatan: string[];
  hargaBentrok: number;
}

/** Sel dari spreadsheet selalu teks; angka kami disamakan bentuknya dulu. */
function samakan(v: string | number): string {
  if (typeof v === 'number') {
    // Sheets menulis desimal dengan koma di ranah tim. Bandingkan sebagai
    // angka, bukan teks, supaya "3229,17" dan 3229.17 tidak dianggap berbeda.
    return String(v);
  }
  const t = v.trim();
  if (t === '') return '';
  const angka = Number(t.replace(/\./g, '').replace(',', '.'));
  return Number.isNaN(angka) ? t : String(angka);
}

function bandingkan(
  kami: (string | number)[][],
  mereka: string[][],
  header: readonly string[],
  batasContoh = 20,
): { barisKami: number; barisMereka: number; beda: number; contoh: Beda[] } {
  const contoh: Beda[] = [];
  let beda = 0;
  const maks = Math.max(kami.length, mereka.length);
  for (let i = 0; i < maks; i++) {
    const a = kami[i];
    const b = mereka[i];
    for (let k = 0; k < header.length; k++) {
      const va = samakan(a?.[k] ?? '');
      const vb = samakan(b?.[k] ?? '');
      if (va === vb) continue;
      beda++;
      if (contoh.length < batasContoh) {
        contoh.push({ baris: i, kolom: header[k] ?? String(k), kami: va, mereka: vb });
      }
    }
  }
  return { barisKami: kami.length, barisMereka: mereka.length, beda, contoh };
}

export async function bandingStok(sheetSoId: string): Promise<HasilBanding> {
  // Satu batchGet, bukan enam permintaan: paket gratis membatasi 50 subrequest
  // per pemanggilan dan tab-tab ini besar.
  // Data tab Stok dan Selisih SO mulai baris 3: baris 1 stempel, baris 2 header.
  const R_LOG = 'Log!A2:I';
  const R_MUTASI = 'Mutasi!A2:L';
  const R_HARGA = 'Harga!A2:H';
  const R_JUAL = 'Penjualan!A2:K';
  const R_STOK = 'Stok!A3:M';
  const R_SELISIH = "'Selisih SO'!A3:K";

  // batchGet mengembalikan peta BERKUNCI RENTANG, bukan larik. Mengindeksnya
  // dengan angka lolos pemeriksa tipe (index signature string) tapi selalu
  // undefined saat jalan, dan gerbangnya akan lulus di atas data kosong.
  const hasil = await batchGet(sheetSoId, [R_LOG, R_MUTASI, R_HARGA, R_JUAL, R_STOK, R_SELISIH]);

  const log = uraiLog(hasil[R_LOG] ?? []);
  const mutasi = uraiMutasi(hasil[R_MUTASI] ?? []);
  const harga = bangunPetaHarga(uraiHarga(hasil[R_HARGA] ?? []));
  const penjualan = uraiPenjualan(hasil[R_JUAL] ?? []);

  const stokKami = hitungStok(log, mutasi, penjualan, harga);
  const selisihKami = hitungSelisih(log, mutasi, harga);

  const stok = bandingkan(keSelStok(stokKami.baris), hasil[R_STOK] ?? [], HEADER_STOK);
  const selisih = bandingkan(keSelSelisih(selisihKami.baris), hasil[R_SELISIH] ?? [], HEADER_SELISIH);

  return {
    ok: stok.beda === 0 && selisih.beda === 0,
    stok,
    selisih,
    peringatan: stokKami.peringatan,
    hargaBentrok: harga.bentrok.length,
  };
}
