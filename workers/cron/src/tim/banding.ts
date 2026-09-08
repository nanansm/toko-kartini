import { batchGet } from '@kartini/sheets';
import { uraiLog, uraiMutasi, uraiPenjualan } from './urai';
import { bangunPetaHarga, uraiHarga } from './harga';
import { hitungStok, keSelStok, HEADER_STOK } from './stok';
import { hitungSelisih, keSelSelisih, HEADER_SELISIH } from './selisih';
import { parseHarga, JUDUL_HARGA } from './harga-master';
import { footerStok, footerSelisih } from './tata-letak';

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
  harga: HasilBandingHarga | null;
  tataLetak: HasilTataLetak;
}

/**
 * Banding tab `Harga`. Dipisah dari banding Stok/Selisih karena sumbernya lain
 * (Master Pricelist, bukan Log) dan karena tab ini akan JADI YATIM begitu tim
 * berhenti menjalankan `harga_master.py`: tidak ada satu pun penulis `Harga` di
 * sisi kita sebelum port ini. `Harga` yang beku membuat kolom Nilai di `Stok`
 * dan seluruh angka rupiah di `Ringkasan` salah tanpa memunculkan galat.
 *
 * Dibandingkan per SKU, bukan per nomor baris: master boleh disisipi produk
 * baru di tengah, dan itu menggeser semua baris sesudahnya tanpa satu pun nilai
 * benar-benar berubah.
 */
export interface HasilBandingHarga {
  skuKami: number;
  skuMereka: number;
  hanyaKami: string[];
  hanyaMereka: string[];
  bedaNilai: number;
  contoh: Beda[];
}

/**
 * Tab `Stok` dan `Selisih SO` bukan cuma tabel: baris 1 penanda basi, baris 2
 * judul, data mulai baris 3, ringkasan rupiah di kolom jauh kanan. `Ringkasan`
 * membaca `Stok!A1`, `'Selisih SO'!A1`, dan `Harga!J1` lewat rumus. Banding
 * baris data saja lulus tanpa membuktikan satu pun dari itu -- karena itu
 * bagian ini ada.
 */
export interface HasilTataLetak {
  stokPenandaAda: boolean;
  stokStempel: string;
  selisihPenandaAda: boolean;
  selisihStempel: string;
  hargaStempelAda: boolean;
  footerStokKami: string[];
  footerStokMereka: string[];
  footerSelisihKami: string[];
  footerSelisihMereka: string[];
  cocok: boolean;
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

/** Banding tab `Harga` per SKU. `mentah` = baris Master Pricelist apa adanya. */
function bandingkanHarga(mentah: string[][], mereka: string[][]): HasilBandingHarga {
  const { baris: kami } = parseHarga(mentah);
  const petaKami = new Map(kami.map((b) => [String(b[0] ?? ''), b]));
  const petaMereka = new Map(mereka.map((b) => [String(b[0] ?? ''), b]));

  const contoh: Beda[] = [];
  let bedaNilai = 0;
  for (const [sku, a] of petaKami) {
    const b = petaMereka.get(sku);
    if (!b) continue;
    for (let k = 0; k < JUDUL_HARGA.length; k++) {
      const va = samakan(a[k] ?? '');
      const vb = samakan(b[k] ?? '');
      if (va === vb) continue;
      bedaNilai++;
      if (contoh.length < 20) {
        contoh.push({ baris: 0, kolom: `${sku} ${JUDUL_HARGA[k] ?? String(k)}`, kami: va, mereka: vb });
      }
    }
  }

  return {
    skuKami: petaKami.size,
    skuMereka: petaMereka.size,
    hanyaKami: [...petaKami.keys()].filter((s) => !petaMereka.has(s)).slice(0, 20),
    hanyaMereka: [...petaMereka.keys()].filter((s) => !petaKami.has(s)).slice(0, 20),
    bedaNilai,
    contoh,
  };
}

/** Ambil kolom pertama tiap baris, buang ekor kosong. */
function kolomPertama(sel: string[][]): string[] {
  const isi = sel.map((r) => (r[0] ?? '').trim());
  while (isi.length > 0 && isi[isi.length - 1] === '') isi.pop();
  return isi;
}

export async function bandingStok(
  sheetSoId: string,
  sheetPricelistId?: string,
  tabPricelist = 'Master Pricelist New',
): Promise<HasilBanding> {
  // Satu batchGet, bukan enam permintaan: paket gratis membatasi 50 subrequest
  // per pemanggilan dan tab-tab ini besar.
  // Data tab Stok dan Selisih SO mulai baris 3: baris 1 stempel, baris 2 header.
  const R_LOG = 'Log!A2:I';
  const R_MUTASI = 'Mutasi!A2:L';
  const R_HARGA = 'Harga!A2:H';
  const R_JUAL = 'Penjualan!A2:K';
  const R_STOK = 'Stok!A3:M';
  const R_SELISIH = "'Selisih SO'!A3:K";
  // Baris 1 dan footer diambil terpisah: rentang data sengaja mulai baris 3,
  // jadi keduanya tidak akan pernah ikut terbaca oleh rentang di atas.
  const R_STOK_1 = 'Stok!A1:B1';
  const R_SELISIH_1 = "'Selisih SO'!A1:B1";
  const R_FOOT_STOK = 'Stok!O1:O12';
  const R_FOOT_SELISIH = "'Selisih SO'!M1:M4";
  const R_HARGA_STEMPEL = 'Harga!J1';

  // batchGet mengembalikan peta BERKUNCI RENTANG, bukan larik. Mengindeksnya
  // dengan angka lolos pemeriksa tipe (index signature string) tapi selalu
  // undefined saat jalan, dan gerbangnya akan lulus di atas data kosong.
  const hasil = await batchGet(sheetSoId, [
    R_LOG, R_MUTASI, R_HARGA, R_JUAL, R_STOK, R_SELISIH,
    R_STOK_1, R_SELISIH_1, R_FOOT_STOK, R_FOOT_SELISIH, R_HARGA_STEMPEL,
  ]);

  const log = uraiLog(hasil[R_LOG] ?? []);
  const mutasi = uraiMutasi(hasil[R_MUTASI] ?? []);
  const harga = bangunPetaHarga(uraiHarga(hasil[R_HARGA] ?? []));
  const penjualan = uraiPenjualan(hasil[R_JUAL] ?? []);

  const stokKami = hitungStok(log, mutasi, penjualan, harga);
  const selisihKami = hitungSelisih(log, mutasi, harga);

  const stok = bandingkan(keSelStok(stokKami.baris), hasil[R_STOK] ?? [], HEADER_STOK);
  const selisih = bandingkan(keSelSelisih(selisihKami.baris), hasil[R_SELISIH] ?? [], HEADER_SELISIH);

  // Tata letak: baris 1 dan footer. Sel A1 berisi RUMUS di sheet, tapi API
  // values mengembalikan hasil tampilannya ("✓ Terbaru — dihitung ..."), jadi
  // rumusnya sendiri tidak bisa dibandingkan dari sini. Yang diperiksa: A1
  // terisi dan B1 berupa stempel waktu -- dua-duanya syarat rumus penanda
  // hidup, dan dua-duanya yang hilang kalau kita menulis mulai baris 2.
  const baris1Stok = hasil[R_STOK_1]?.[0] ?? [];
  const baris1Selisih = hasil[R_SELISIH_1]?.[0] ?? [];
  const footStokMereka = kolomPertama(hasil[R_FOOT_STOK] ?? []);
  const footSelisihMereka = kolomPertama(hasil[R_FOOT_SELISIH] ?? []);
  const footStokKami = footerStok(stokKami.totalNilai, stokKami.tanpaHarga, stokKami.peringatan)
    .map((r) => r[0] ?? '');
  const footSelisihKami = footerSelisih(
    selisihKami.cocok, selisihKami.baris.length, selisihKami.nilaiKurang, selisihKami.nilaiLebih,
  ).map((r) => r[0] ?? '');

  const tataLetak: HasilTataLetak = {
    stokPenandaAda: (baris1Stok[0] ?? '').trim() !== '',
    stokStempel: (baris1Stok[1] ?? '').trim(),
    selisihPenandaAda: (baris1Selisih[0] ?? '').trim() !== '',
    selisihStempel: (baris1Selisih[1] ?? '').trim(),
    hargaStempelAda: (hasil[R_HARGA_STEMPEL]?.[0]?.[0] ?? '').trim() !== '',
    footerStokKami: footStokKami,
    footerStokMereka: footStokMereka,
    footerSelisihKami: footSelisihKami,
    footerSelisihMereka: footSelisihMereka,
    cocok:
      JSON.stringify(footStokKami) === JSON.stringify(footStokMereka) &&
      JSON.stringify(footSelisihKami) === JSON.stringify(footSelisihMereka),
  };

  // Master Pricelist ada di spreadsheet LAIN, jadi permintaannya terpisah.
  // Opsional supaya gerbang lama tetap bisa dipanggil tanpa id itu.
  let bandingHarga: HasilBandingHarga | null = null;
  if (sheetPricelistId) {
    const rentang = tabPricelist.includes(' ') ? `'${tabPricelist}'!A:AF` : `${tabPricelist}!A:AF`;
    const master = await batchGet(sheetPricelistId, [rentang]);
    bandingHarga = bandingkanHarga(master[rentang] ?? [], hasil[R_HARGA] ?? []);
  }

  return {
    ok:
      stok.beda === 0 &&
      selisih.beda === 0 &&
      tataLetak.cocok &&
      tataLetak.stokPenandaAda &&
      tataLetak.selisihPenandaAda &&
      tataLetak.hargaStempelAda,
    stok,
    selisih,
    peringatan: stokKami.peringatan,
    hargaBentrok: harga.bentrok.length,
    harga: bandingHarga,
    tataLetak,
  };
}
