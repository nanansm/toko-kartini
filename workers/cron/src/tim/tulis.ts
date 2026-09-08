import { batchGet, updateRange, bersihkanRange, wib } from '@kartini/sheets';
import { uraiLog, uraiMutasi, uraiPenjualan } from './urai';
import { bangunPetaHarga, uraiHarga } from './harga';
import { hitungStok, keSelStok, HEADER_STOK } from './stok';
import { hitungSelisih, keSelSelisih, HEADER_SELISIH } from './selisih';
import { parseHarga, JUDUL_HARGA, stempelHarga } from './harga-master';
import {
  barisPenanda,
  footerStok,
  footerSelisih,
  KOSONG_STOK,
  KOSONG_SELISIH,
} from './tata-letak';

/**
 * Penulis Fase 7: mengambil hitungan yang sudah lulus gerbang banding (0 beda)
 * dan benar-benar menaruhnya di sheet TUJUAN. Modul ini murni menulis — tidak
 * punya saklar sendiri, tidak baca `process.env`, dan tidak menebak tujuan:
 * pemanggil yang memutuskan sheet mana yang boleh ditimpa. Itu sengaja supaya
 * uji coba pertama bisa diarahkan ke spreadsheet salinan tanpa mengubah kode
 * ini sama sekali.
 */

export interface OpsiTulis {
  /** Spreadsheet TUJUAN penulisan. Wajib parameter, TIDAK BOLEH diambil dari
   *  process.env di dalam fungsi ini -- uji pertama harus bisa diarahkan ke
   *  spreadsheet SALINAN, bukan ke sheet tim yang dipakai staf tiap hari. */
  sheetTujuan: string;
  /** Spreadsheet SUMBER data mentah (Log/Mutasi/Harga/Penjualan). */
  sheetSumber: string;
  /** Spreadsheet Master Pricelist, sumber tab Harga. Kalau kosong, tab Harga dilewati. */
  sheetPricelistId?: string;
  tabPricelist?: string; // default 'Master Pricelist New'
  /** Tab mana saja yang ditulis. Default: ketiganya. */
  tab?: ('Stok' | 'Selisih SO' | 'Harga')[];
  /** ISO string. Default: waktu sekarang. Dipakai untuk stempel B1/J1. */
  waktu?: string;
  /** Awalan nama tab TUJUAN, mis. `'UJI '` -> menulis ke `UJI Stok`. Kosong di
   *  produksi. Ini satu-satunya cara menguji penulis ini tanpa menyentuh tab
   *  yang dipakai staf: akun layanan kita tidak boleh membuat spreadsheet baru
   *  (Google menjawab 403, scope-nya cuma `spreadsheets`, bukan Drive), jadi
   *  uji dijalankan di spreadsheet operasional kita sendiri dengan nama tab
   *  yang berbeda. Rentang, tata letak, dan rumusnya tetap identik. */
  prefixTab?: string;
}

export interface HasilTulis {
  waktu: string;
  ditulis: string[]; // nama tab yang benar-benar ditulis
  dilewati: string[]; // nama tab yang dilewati + alasannya, mis. 'Harga (tanpa sheetPricelistId)'
  barisStok: number;
  barisSelisih: number;
  barisHarga: number;
}

/** `('UJI ', 'Selisih SO', 'A3:K')` -> `'UJI Selisih SO'!A3:K`. Nama tab yang
 *  mengandung spasi WAJIB dikutip, kalau tidak Sheets API membaca `Selisih` dan
 *  `SO` sebagai dua rentang berbeda -- dan begitu prefix dipakai, nama tab yang
 *  tadinya satu kata pun bisa jadi berspasi. */
function rentang(prefix: string, tab: string, a1: string): string {
  const nama = `${prefix}${tab}`;
  return `${nama.includes(' ') ? `'${nama}'` : nama}!${a1}`;
}

const SEMUA_TAB: readonly ('Stok' | 'Selisih SO' | 'Harga')[] = ['Stok', 'Selisih SO', 'Harga'];

export async function tulisTabTim(opsi: OpsiTulis): Promise<HasilTulis> {
  const waktu = opsi.waktu ?? new Date().toISOString();
  // Sel B1 di tab Stok dan Selisih SO milik tim berisi NILAI TANGGAL, bukan
  // teks: dibaca mentah isinya 46273.248 dan rumus penandanya memakai
  // INT($B$1) serta TEXT($B$1;"d mmm HH:mm"). Menaruh ISO UTC apa adanya
  // ("2026-09-08T09:57:30.128Z") membuat Sheets menyimpannya sebagai TEKS --
  // INT() lalu menjawab #VALUE! dan penanda di A1 mati, ikut menyeret tab
  // Ringkasan yang membaca Stok!A1. Format "YYYY-MM-DD HH:MM:SS" yang diurai
  // Sheets jadi tanggal, dan zonanya WIB seperti punya tim.
  const stempel = wib(waktu);
  const tabDiminta = opsi.tab ?? SEMUA_TAB;
  const pre = opsi.prefixTab ?? '';
  const ditulis: string[] = [];
  const dilewati: string[] = [];

  // Sama persis rentang yang dipakai gerbang banding (./banding.ts) -- kalau
  // ini berubah, hitungan tulis dan hitungan banding bisa diam-diam membaca
  // baris yang berbeda dan gerbang "0 beda" tidak lagi membuktikan apa-apa.
  const R_LOG = 'Log!A2:I';
  const R_MUTASI = 'Mutasi!A2:L';
  const R_HARGA = 'Harga!A2:H';
  const R_JUAL = 'Penjualan!A2:K';

  const sumber = await batchGet(opsi.sheetSumber, [R_LOG, R_MUTASI, R_HARGA, R_JUAL]);
  const log = uraiLog(sumber[R_LOG] ?? []);
  const mutasi = uraiMutasi(sumber[R_MUTASI] ?? []);
  const harga = bangunPetaHarga(uraiHarga(sumber[R_HARGA] ?? []));
  const penjualan = uraiPenjualan(sumber[R_JUAL] ?? []);

  const stokKami = hitungStok(log, mutasi, penjualan, harga);
  const selisihKami = hitungSelisih(log, mutasi, harga);

  let barisStok = 0;
  let barisSelisih = 0;
  let barisHarga = 0;

  if (tabDiminta.includes('Stok')) {
    // Bersihkan A3:M dan O1:O DULU, baru tulis. Kalau hasil baru lebih pendek
    // dari isi lama, sisa baris lama nyangkut di bawah dan terbaca sebagai
    // stok yang sebenarnya sudah tidak ada -- salah diam-diam, tidak
    // memunculkan galat apa pun.
    await bersihkanRange(opsi.sheetTujuan, rentang(pre, 'Stok', 'A3:M'));
    await bersihkanRange(opsi.sheetTujuan, rentang(pre, 'Stok', 'O1:O'));

    // A1:B1 berisi RUMUS penanda, bukan teks -- WAJIB USER_ENTERED. Dengan
    // RAW, `=IF(...)` masuk sebagai teks biasa dan penanda "angka lama/
    // terbaru" yang dibaca tab Ringkasan mati total.
    await updateRange(opsi.sheetTujuan, rentang(pre, 'Stok', 'A1:B1'), barisPenanda(stempel), 'USER_ENTERED');
    await updateRange(opsi.sheetTujuan, rentang(pre, 'Stok', 'A2:M2'), [[...HEADER_STOK]]);

    const selStok = keSelStok(stokKami.baris);
    barisStok = selStok.length;
    if (selStok.length > 0) {
      await updateRange(opsi.sheetTujuan, rentang(pre, 'Stok', `A3:M${2 + selStok.length}`), selStok);
    } else {
      // Tab tidak boleh cuma berisi judul: rumus SUMIF di tab Ringkasan lalu
      // membaca rentang kosong dan menjawab 0 tanpa tanda apa pun, tidak bisa
      // dibedakan dari "stok memang nol".
      await updateRange(opsi.sheetTujuan, rentang(pre, 'Stok', 'A3'), [[KOSONG_STOK]]);
    }

    // Kolom O = dua kolom sesudah kolom data terakhir (M), satu kolom jeda
    // (N) sengaja dibiarkan kosong supaya footer tidak menempel ke data.
    const foot = footerStok(stokKami.totalNilai, stokKami.tanpaHarga, stokKami.peringatan);
    if (foot.length > 0) {
      await updateRange(opsi.sheetTujuan, rentang(pre, 'Stok', `O1:O${foot.length}`), foot);
    }
    ditulis.push('Stok');
  } else {
    dilewati.push('Stok (tidak diminta)');
  }

  if (tabDiminta.includes('Selisih SO')) {
    // Nama tab mengandung spasi -- rentang WAJIB dikutip, kalau tidak Sheets
    // API membaca 'Selisih' dan 'SO' sebagai dua rentang berbeda.
    await bersihkanRange(opsi.sheetTujuan, rentang(pre, 'Selisih SO', 'A3:K'));
    await bersihkanRange(opsi.sheetTujuan, rentang(pre, 'Selisih SO', 'M1:M'));

    await updateRange(opsi.sheetTujuan, rentang(pre, 'Selisih SO', 'A1:B1'), barisPenanda(stempel), 'USER_ENTERED');
    await updateRange(opsi.sheetTujuan, rentang(pre, 'Selisih SO', 'A2:K2'), [[...HEADER_SELISIH]]);

    const selSelisih = keSelSelisih(selisihKami.baris);
    barisSelisih = selSelisih.length;
    if (selSelisih.length > 0) {
      await updateRange(opsi.sheetTujuan, rentang(pre, 'Selisih SO', `A3:K${2 + selSelisih.length}`), selSelisih);
    } else {
      // Alasan sama dengan tab Stok di atas.
      await updateRange(opsi.sheetTujuan, rentang(pre, 'Selisih SO', 'A3'), [[KOSONG_SELISIH]]);
    }

    const foot = footerSelisih(
      selisihKami.cocok,
      selisihKami.baris.length,
      selisihKami.nilaiKurang,
      selisihKami.nilaiLebih
    );
    if (foot.length > 0) {
      await updateRange(opsi.sheetTujuan, rentang(pre, 'Selisih SO', `M1:M${foot.length}`), foot);
    }
    ditulis.push('Selisih SO');
  } else {
    dilewati.push('Selisih SO (tidak diminta)');
  }

  if (tabDiminta.includes('Harga')) {
    if (!opsi.sheetPricelistId) {
      dilewati.push('Harga (tanpa sheetPricelistId)');
    } else {
      const tabPricelist = opsi.tabPricelist ?? 'Master Pricelist New';
      // Master boleh berisi spasi di nama tab juga -- kutip dengan aturan yang
      // sama seperti tab tim. `parseHarga` sendiri yang memotong 2 baris
      // judul di depan (lihat harga-master.ts), jadi rentangnya dibaca dari
      // baris pertama, bukan langsung dari baris data.
      const rentangMaster = tabPricelist.includes(' ')
        ? `'${tabPricelist}'!A:AF`
        : `${tabPricelist}!A:AF`;
      const master = await batchGet(opsi.sheetPricelistId, [rentangMaster]);
      const { baris: barisMaster } = parseHarga(master[rentangMaster] ?? []);

      // Header tab Harga di BARIS 1, beda dari Stok/Selisih SO yang barisnya
      // dipakai penanda "angka lama/terbaru" -- tab Harga tidak punya rumus
      // semacam itu, cuma stempel teks biasa di J1.
      await bersihkanRange(opsi.sheetTujuan, rentang(pre, 'Harga', 'A2:H'));
      await updateRange(opsi.sheetTujuan, rentang(pre, 'Harga', 'A1:H1'), [[...JUDUL_HARGA]]);

      barisHarga = barisMaster.length;
      if (barisMaster.length > 0) {
        await updateRange(opsi.sheetTujuan, rentang(pre, 'Harga', `A2:H${1 + barisMaster.length}`), barisMaster);
      }
      await updateRange(opsi.sheetTujuan, rentang(pre, 'Harga', 'J1'), [[stempelHarga(stempel)]]);
      ditulis.push('Harga');
    }
  } else {
    dilewati.push('Harga (tidak diminta)');
  }

  return { waktu, ditulis, dilewati, barisStok, barisSelisih, barisHarga };
}
