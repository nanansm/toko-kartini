import { batchGet, bacaLog, namaTabLog } from '@kartini/sheets';
import { lipatSaldo } from './saldo';

interface Env {
  KATALOG: KVNamespace;
}

interface BarisSaldo {
  productId: string;
  lokasi: string;
  qty: number;
}

interface SaldoTersimpan {
  versi: number;
  waktu: string;
  bulan: string;
  jumlah: number;
  idTerakhir: number;
  saldo: BarisSaldo[];
}

export interface RingkasanStokSO {
  waktu: string;
  barisStok: number;
  barisSaldo: number;
  totalQty: number;
  lokasiAsing: string[];
  skuTanpaIsi: number;
  sisaTakTerbaca: number;
  /** Jumlah baris Log kita yang ikut dilipat di atas angka SO. 0 = tidak ada
   *  mutasi dari aplikasi ini bulan berjalan, atau Log memang tidak dibaca. */
  barisLog: number;
  idTerakhir: number;
  takBerubah?: boolean;
  dibatalkan?: boolean;
  kode?: string;
}

// Peta nama lokasi persis seperti tertulis di tab Stok -> kode yang dipakai
// sistem kita. Nama di luar peta ini dikumpulkan ke lokasiAsing, bukan dibuang
// diam-diam -- itu tanda tab Stok punya lokasi baru yang belum didaftarkan.
const PETA_LOKASI: Record<string, string> = {
  'Gudang Packaging': 'GUDANG_PACKAGING',
  'Gudang Bahan Kue': 'GUDANG_BAHAN_KUE',
  'Gudang Ciherang': 'GUDANG_CIHERANG',
  'Gudang Dapur Cherry': 'GUDANG_DAPUR_CHERRY',
  'Area Display': 'AREA_DISPLAY',
};

function bulanSekarang(waktu: Date): string {
  const tahun = waktu.getUTCFullYear();
  const bulan = String(waktu.getUTCMonth() + 1).padStart(2, '0');
  return `${tahun}-${bulan}`;
}

/** `sku.replace(/-(G|\d+)$/, '')` -- basis produk yang dipakai katalog kita.
 *  `BHK-0004-3` (satuan ke-3) atau `BHK-0004-G` (Grosir) sama-sama jadi
 *  `BHK-0004`. */
function basisSKU(sku: string): string {
  return sku.replace(/-(G|\d+)$/, '');
}

/** Sheet ber-locale Indonesia bisa menulis angka dengan dua gaya berbeda
 *  tergantung format sel: "3229,17" (koma desimal, titik ribuan) atau
 *  kadang cuma "1.234" (titik ribuan, tanpa desimal sama sekali). Dua
 *  cabang di bawah menangani keduanya tanpa saling tabrak: kalau ada koma,
 *  titik pasti pemisah ribuan; kalau tidak ada koma tapi polanya persis
 *  kelompok 3-digit dipisah titik, titik itu juga ribuan bukan desimal. */
function angkaSheet(mentah: string | undefined): number {
  if (mentah === undefined || mentah === null || mentah === '') return NaN;
  if (mentah.includes(',')) {
    return Number(mentah.replace(/\./g, '').replace(',', '.'));
  }
  if (/^-?\d{1,3}(\.\d{3})+$/.test(mentah)) {
    return Number(mentah.replace(/\./g, ''));
  }
  return Number(mentah);
}

/** Menarik stok dari spreadsheet SO tim ("Stok Opname Toko Kartini") dan
 *  menulisnya ke KV `saldo:v1` dalam bentuk PERSIS seperti yang ditulis
 *  `hitungSaldo` (lihat saldo.ts) -- `hitungNilai` di nilai.ts membaca kunci
 *  ini dan kontraknya tidak boleh berubah.
 *
 *  Aplikasi lama ini berubah jadi layar laporan: staf memakai aplikasi tim
 *  yang lain, buku besarnya di tab Stok spreadsheet SO. Fungsi ini cuma
 *  menyalin hasilnya tiap 10 menit, tidak pernah menulis balik ke sheet. */
export async function tarikStokSO(
  env: Env,
  sheetSoId: string,
  sheetOpsId?: string
): Promise<RingkasanStokSO> {
  const waktu = new Date().toISOString();
  const bulan = bulanSekarang(new Date());

  const hasil = await batchGet(sheetSoId, ['Stok!A3:M', 'Harga!A2:H']);
  const [barisStokMentah = [], barisHargaMentah = []] = Object.values(hasil);

  // Isi_baris per SKU persis, lalu Isi terbesar per basis SKU -- dua peta
  // terpisah karena qtyPokok butuh keduanya sekaligus per baris Stok.
  const isiPerSku = new Map<string, number>();
  const isiMaxPerBasis = new Map<string, number>();

  for (const baris of barisHargaMentah) {
    const sku = baris[0];
    const isi = angkaSheet(baris[3]);
    if (sku === undefined || sku === '' || Number.isNaN(isi)) continue;
    isiPerSku.set(sku, isi);
    const basis = basisSKU(sku);
    const isiMaxLama = isiMaxPerBasis.get(basis);
    if (isiMaxLama === undefined || isi > isiMaxLama) {
      isiMaxPerBasis.set(basis, isi);
    }
  }

  const lokasiAsing = new Set<string>();
  const skuAsingTanpaHarga = new Set<string>();
  let sisaTakTerbaca = 0;

  const peta = new Map<string, number>();
  for (const baris of barisStokMentah) {
    const namaLokasi = baris[0];
    const sku = baris[1];
    const sisaMentah = baris[9];
    if (namaLokasi === undefined || namaLokasi === '' || sku === undefined || sku === '') continue;

    const kodeLokasi = PETA_LOKASI[namaLokasi];
    if (kodeLokasi === undefined) {
      lokasiAsing.add(namaLokasi);
      continue;
    }

    const sisa = angkaSheet(sisaMentah);
    if (Number.isNaN(sisa)) {
      sisaTakTerbaca += 1;
      continue;
    }

    const isiBaris = isiPerSku.get(sku);
    const basis = basisSKU(sku);
    const isiMax = isiMaxPerBasis.get(basis);
    if (isiBaris === undefined || isiMax === undefined) {
      skuAsingTanpaHarga.add(sku);
      continue;
    }

    const qtyPokok = sisa * (isiMax / isiBaris);
    const kunci = `${basis}|${kodeLokasi}`;
    peta.set(kunci, (peta.get(kunci) ?? 0) + qtyPokok);
  }

  // Angka dari tab Stok SO adalah DASAR, bukan hasil akhir. Selama tim masih
  // memakai dua aplikasi berdampingan, mutasi yang dicatat di aplikasi ini
  // tidak pernah masuk ke tab Stok mereka -- kalau saldo:v1 ditulis mentah dari
  // SO, tiap catatan staf di sini akan terhapus lagi 10 menit kemudian dan
  // layarnya terlihat seperti tidak menyimpan apa-apa.
  //
  // Log kita dilipat di atasnya lewat lipatSaldo -- fungsi yang sama yang
  // dipakai hitungSaldo dan tutupBulan, supaya aturan lokasi maya, saldo minus,
  // dan pelaporan kejanggalan tidak bercabang jadi dua versi.
  //
  // Kalau tim sudah pindah sepenuhnya, cukup lepas SHEET_SO_ID dari cron:
  // tarikan SO berhenti, hitungSaldo hidup lagi dari Saldo_Awal + Log.
  let barisLog = 0;
  let idTerakhir = 0;
  if (sheetOpsId !== undefined && sheetOpsId !== '') {
    const dasar: BarisSaldo[] = [];
    for (const [kunci, qty] of peta) {
      const p = kunci.indexOf('|');
      dasar.push({ productId: kunci.slice(0, p), lokasi: kunci.slice(p + 1), qty });
    }
    const log = await bacaLog(sheetOpsId, namaTabLog(new Date()));
    barisLog = log.length;
    const hasilLipat = lipatSaldo(dasar, log);
    idTerakhir = hasilLipat.idTerakhir;
    peta.clear();
    for (const [kunci, qty] of hasilLipat.peta) peta.set(kunci, qty);
  }

  const saldo: BarisSaldo[] = [];
  let totalQty = 0;
  for (const [kunci, qty] of peta) {
    if (qty === 0) continue;
    const pemisah = kunci.indexOf('|');
    const productId = kunci.slice(0, pemisah);
    const lokasi = kunci.slice(pemisah + 1);
    saldo.push({ productId, lokasi, qty });
    totalQty += qty;
  }
  // Urutan deterministik: Map bisa bergeser urutannya antar-run walau isinya
  // sama, dan itu bikin gerbang hemat-tulis di bawah tak pernah kena.
  saldo.sort((a, b) => (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : a.lokasi < b.lokasi ? -1 : a.lokasi > b.lokasi ? 1 : 0));

  const lamaStr = await env.KATALOG.get('saldo:v1');
  const lama: SaldoTersimpan | null = lamaStr ? JSON.parse(lamaStr) : null;

  // Gerbang kosong/menyusut: tab Stok diregenerasi ulang oleh skrip Python
  // tim. Kalau cron kebetulan membaca saat tab sedang kosong/separuh, saldo
  // sehat yang sudah ada di KV tidak boleh tertimpa nol.
  if (saldo.length === 0 || (lama !== null && saldo.length < lama.saldo.length * 0.5)) {
    return {
      waktu,
      barisStok: barisStokMentah.length,
      barisSaldo: saldo.length,
      totalQty,
      lokasiAsing: [...lokasiAsing],
      skuTanpaIsi: skuAsingTanpaHarga.size,
      sisaTakTerbaca,
    barisLog,
    idTerakhir,
      dibatalkan: true,
      kode: 'saldo baru kosong atau menyusut lebih dari separuh',
    };
  }

  // Gerbang hemat tulis: cron jalan 144x/hari, jatah tulis KV gratis 1.000/hari.
  const saldoBaruStr = JSON.stringify(saldo);
  if (lama !== null && JSON.stringify(lama.saldo) === saldoBaruStr) {
    return {
      waktu,
      barisStok: barisStokMentah.length,
      barisSaldo: saldo.length,
      totalQty,
      lokasiAsing: [...lokasiAsing],
      skuTanpaIsi: skuAsingTanpaHarga.size,
      sisaTakTerbaca,
    barisLog,
    idTerakhir,
      takBerubah: true,
    };
  }

  await env.KATALOG.put(
    'saldo:v1',
    JSON.stringify({ versi: 1, waktu, bulan, jumlah: saldo.length, idTerakhir, saldo })
  );

  return {
    waktu,
    barisStok: barisStokMentah.length,
    barisSaldo: saldo.length,
    totalQty,
    lokasiAsing: [...lokasiAsing],
    skuTanpaIsi: skuAsingTanpaHarga.size,
    sisaTakTerbaca,
    barisLog,
    idTerakhir,
  };
}
