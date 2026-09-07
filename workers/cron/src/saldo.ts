import {
  bacaSaldoAwal,
  bacaLog,
  namaTabLog,
  catatErrorSheet,
  daftarTab,
  duplikatTab,
  updateRange,
} from '@kartini/sheets';

interface Env {
  KATALOG: KVNamespace;
}

// Disalin dari apps/so/src/lib/lokasi.ts — paket beda (worker ini tidak boleh
// impor lintas app), jadi daftar lokasi maya digandakan di sini secara sengaja.
const LOKASI_MAYA: readonly string[] = ['BARANG_DATANG', 'BARANG_RUSAK'];

// Ketujuh kode lokasi yang dikenal sistem: 5 nyata + 2 maya. Dipakai cuma untuk
// gerbang kewarasan (dari/ke di luar daftar ini = data yang belum tercatat benar),
// bukan untuk memutuskan apakah saldo diubah — itu urusan LOKASI_MAYA di atas.
const LOKASI_DIKENAL = new Set<string>([
  'GUDANG_PACKAGING',
  'GUDANG_BAHAN_KUE',
  'GUDANG_CIHERANG',
  'GUDANG_DAPUR_CHERRY',
  'AREA_DISPLAY',
  'BARANG_DATANG',
  'BARANG_RUSAK',
]);

function bulanSekarang(waktu: Date): string {
  const tahun = waktu.getUTCFullYear();
  const bulan = String(waktu.getUTCMonth() + 1).padStart(2, '0');
  return `${tahun}-${bulan}`;
}

function tanggalUTC(waktu: Date): string {
  const tahun = waktu.getUTCFullYear();
  const bulan = String(waktu.getUTCMonth() + 1).padStart(2, '0');
  const hari = String(waktu.getUTCDate()).padStart(2, '0');
  return `${tahun}-${bulan}-${hari}`;
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
  /** `id` Log terakhir yang ikut terhitung. Pemakai hilir memakai angka ini —
   *  bukan `waktu` — sebagai batas mutasi susulan: `waktu` dicap SEBELUM Log
   *  dibaca, jadi baris yang masuk di sela itu sudah ikut terjumlah di sini
   *  padahal cap waktunya lebih baru, dan memakai waktu sebagai batas membuat
   *  baris itu terhitung dua kali. */
  idTerakhir: number;
  saldo: BarisSaldo[];
}

export interface RingkasanSaldo {
  waktu: string;
  bulan: string;
  jumlahBaris: number;
  jumlahSaldo: number;
  kejanggalan: number;
  takBerubah?: boolean;
}

interface HasilLipat {
  peta: Map<string, number>;
  kejanggalan: string[];
  idTerakhir: number;
}

/** Melipat Saldo_Awal + baris Log jadi saldo per produk x lokasi.
 *  Murni, tanpa I/O. Dipakai dua tempat -- penghitungan saldo berjalan dan
 *  penutupan bulan -- dan keduanya WAJIB memakai aturan yang sama persis:
 *  kalau salah satunya menyimpang, saldo pembuka bulan baru tidak akan cocok
 *  dengan saldo penutup bulan lalu dan tidak ada yang memberi tahu. */
export function lipatSaldo(
  saldoAwal: readonly { productId: string; lokasi: string; qty: number }[],
  log: readonly BarisLogRingkas[]
): HasilLipat {
  const peta = new Map<string, number>();
  for (const baris of saldoAwal) {
    peta.set(`${baris.productId}|${baris.lokasi}`, baris.qty);
  }

  // Baris sheet bisa disisipkan/diedit tangan -- urutan baris tidak boleh
  // dipercaya sebagai urutan kejadian, wajib diurutkan lewat id sendiri.
  const logUrut = [...log].sort((a, b) => a.id - b.id);

  const idTerlihat = new Set<number>();
  const clientIdTerlihat = new Set<string>();
  const kejanggalan: string[] = [];

  for (const baris of logUrut) {
    if (idTerlihat.has(baris.id)) {
      kejanggalan.push(`id ${baris.id} dobel`);
    }
    idTerlihat.add(baris.id);

    if (clientIdTerlihat.has(baris.clientId)) {
      kejanggalan.push(`client_id ${baris.clientId} dobel`);
    }
    clientIdTerlihat.add(baris.clientId);

    if (baris.dari !== null && !LOKASI_DIKENAL.has(baris.dari)) {
      kejanggalan.push(`baris ${baris.id} dari="${baris.dari}" bukan kode lokasi dikenal`);
    }
    if (baris.ke !== null && !LOKASI_DIKENAL.has(baris.ke)) {
      kejanggalan.push(`baris ${baris.id} ke="${baris.ke}" bukan kode lokasi dikenal`);
    }

    // qty_pokok kosong atau bukan angka tidak boleh diperlakukan sebagai 0:
    // nol berarti "mutasi ini tidak menggeser apa pun", dan itu membuat sel
    // yang rusak terbaca sebagai saldo yang waras. Barisnya dilewati dan
    // dilaporkan supaya ada yang membetulkannya.
    if (baris.qtyPokok === null) {
      kejanggalan.push(`baris ${baris.id} qty_pokok kosong atau bukan angka`);
      continue;
    }
    const qtyPokok = baris.qtyPokok;

    // Lokasi maya tidak pernah punya saldo -- barang datang dari luar sistem,
    // barang rusak keluar satu arah. Selain itu, saldo boleh minus: minus
    // berarti ada perpindahan yang belum tercatat dan itu wajib kelihatan.
    //
    // Lokasi yang tidak dikenal dilewati, bukan dijumlahkan: kalau diterima,
    // satu salah ketik di spreadsheet melahirkan lokasi hantu yang ikut muncul
    // di kartu stok dan daftar pesanan. Kejanggalannya sudah dicatat di atas.
    if (baris.dari !== null && LOKASI_DIKENAL.has(baris.dari) && !LOKASI_MAYA.includes(baris.dari)) {
      const kunci = `${baris.productId}|${baris.dari}`;
      peta.set(kunci, (peta.get(kunci) ?? 0) - qtyPokok);
    }
    if (baris.ke !== null && LOKASI_DIKENAL.has(baris.ke) && !LOKASI_MAYA.includes(baris.ke)) {
      const kunci = `${baris.productId}|${baris.ke}`;
      peta.set(kunci, (peta.get(kunci) ?? 0) + qtyPokok);
    }
  }

  // id terbesar yang ikut terjumlah. logUrut sudah diurutkan menaik.
  const idTerakhir = logUrut.length === 0 ? 0 : (logUrut[logUrut.length - 1]?.id ?? 0);

  return { peta, kejanggalan, idTerakhir };
}

/** Bentuk minimal baris Log yang dibutuhkan lipatSaldo. */
export interface BarisLogRingkas {
  id: number;
  clientId: string;
  productId: string;
  qtyPokok: number | null;
  dari: string | null;
  ke: string | null;
}

export async function hitungSaldo(env: Env, sheetId: string): Promise<RingkasanSaldo> {
  const sekarang = new Date();
  const bulan = bulanSekarang(sekarang);
  const tab = namaTabLog(sekarang);
  const waktu = sekarang.toISOString();

  const [saldoAwal, log] = await Promise.all([
    bacaSaldoAwal(sheetId, bulan),
    bacaLog(sheetId, tab),
  ]);

  const { peta, kejanggalan, idTerakhir } = lipatSaldo(saldoAwal, log);
  const jumlahBarisLog = log.length;

  // Kejanggalan yang sama dicatat sekali, bukan tiap siklus. Cron jalan 144x
  // sehari; tanpa gerbang ini satu baris janggal yang belum dibetulkan
  // menghasilkan 144 baris di tab Error setiap hari sampai orangnya menyerah
  // membacanya.
  const kejanggalanStr = kejanggalan.join('; ');
  const kejanggalanLama = await env.KATALOG.get('saldo:kejanggalan');
  if (kejanggalanStr !== (kejanggalanLama ?? '')) {
    if (kejanggalanStr !== '') {
      await catatErrorSheet(sheetId, kejanggalanStr.slice(0, 300), tab);
      await env.KATALOG.put('saldo:kejanggalan', kejanggalanStr);
    } else {
      await env.KATALOG.delete('saldo:kejanggalan');
    }
  }

  const saldo: BarisSaldo[] = [];
  for (const [kunci, qty] of peta) {
    if (qty === 0) continue;
    const pemisah = kunci.indexOf('|');
    saldo.push({ productId: kunci.slice(0, pemisah), lokasi: kunci.slice(pemisah + 1), qty });
  }

  // Gerbang hemat tulis: cron jalan tiap 10 menit (144x/hari), jatah tulis KV
  // gratis 1.000/hari. Isi identik dengan yang lama = jangan tulis ulang.
  const saldoBaruStr = JSON.stringify(saldo);
  const lamaStr = await env.KATALOG.get('saldo:v1');
  const lama: SaldoTersimpan | null = lamaStr ? JSON.parse(lamaStr) : null;
  if (lama !== null && JSON.stringify(lama.saldo) === saldoBaruStr) {
    return {
      waktu,
      bulan,
      jumlahBaris: jumlahBarisLog,
      jumlahSaldo: saldo.length,
      kejanggalan: kejanggalan.length,
      takBerubah: true,
    };
  }

  await env.KATALOG.put(
    'saldo:v1',
    JSON.stringify({ versi: 1, waktu, bulan, jumlah: saldo.length, idTerakhir, saldo })
  );

  // Cermin ke tab Stok untuk mata manusia. KV tetap sumber yang dipakai
  // aplikasi; kegagalan di sini TIDAK boleh menggagalkan hitungSaldo.
  try {
    const barisStok: (string | number)[][] = saldo.map((b) => [b.productId, b.lokasi, b.qty, waktu]);
    const panjangLama = lama?.saldo.length ?? 0;
    // Baris lama yang lebih panjang dari data baru ditimpa kosong juga,
    // supaya tidak ada baris basi tersisa di bawah data yang baru ditulis.
    const totalBaris = Math.max(barisStok.length, panjangLama);
    for (let i = barisStok.length; i < totalBaris; i++) {
      barisStok.push(['', '', '', '']);
    }
    if (totalBaris > 0) {
      await updateRange(sheetId, `Stok!A2:D${totalBaris + 1}`, barisStok);
    }
  } catch (err) {
    const pesan = err instanceof Error ? err.message : String(err);
    await catatErrorSheet(sheetId, `Gagal menulis tab Stok: ${pesan}`, tab);
  }

  return {
    waktu,
    bulan,
    jumlahBaris: jumlahBarisLog,
    jumlahSaldo: saldo.length,
    kejanggalan: kejanggalan.length,
  };
}

export async function cadangkanLog(
  env: Env,
  sheetId: string
): Promise<{ dibuat: boolean; tab: string; alasan?: string }> {
  const sekarang = new Date();
  const tabSumber = namaTabLog(sekarang);
  const hariIni = tanggalUTC(sekarang);
  const tabCadangan = `Cadangan_${hariIni}`;

  // Sekali sehari saja: penanda dicek dulu supaya hari yang sama tidak
  // memanggil Sheets sama sekali — bukan cuma menghindari tulis, tapi bacanya juga.
  const penanda = await env.KATALOG.get('cadangan:terakhir');
  if (penanda === hariIni) {
    return { dibuat: false, tab: tabCadangan, alasan: 'sudah dicadangkan hari ini' };
  }

  try {
    const tab = await daftarTab(sheetId);

    // Cadangan hari ini sudah ada di spreadsheet walau penanda KV hilang
    // (KV bisa dikosongkan, tab tidak). Penandanya dipulihkan, tabnya tidak
    // digandakan dua kali.
    if (tab.some((t) => t.judul === tabCadangan)) {
      await env.KATALOG.put('cadangan:terakhir', hariIni);
      return { dibuat: false, tab: tabCadangan, alasan: 'tab cadangan sudah ada' };
    }

    const sumber = tab.find((t) => t.judul === tabSumber);
    if (!sumber) {
      // Bulan baru yang tabnya belum dibuat bukan kerusakan — tidak ada yang
      // perlu dicadangkan, dan penanda sengaja TIDAK ditulis supaya siklus
      // berikutnya mencoba lagi setelah tabnya ada.
      return { dibuat: false, tab: tabCadangan, alasan: `tab ${tabSumber} belum ada` };
    }

    await duplikatTab(sheetId, sumber.gid, tabCadangan);

    // Penanda ditulis HANYA setelah penggandaan berhasil, supaya kegagalan
    // di tengah tidak membuat hari itu dianggap sudah tercadangkan.
    await env.KATALOG.put('cadangan:terakhir', hariIni);
    return { dibuat: true, tab: tabCadangan };
  } catch (err) {
    const pesan = err instanceof Error ? err.message : String(err);
    await catatErrorSheet(
      sheetId,
      `Gagal menggandakan ${tabSumber} ke ${tabCadangan}: ${pesan}`,
      tabSumber
    );
    return { dibuat: false, tab: tabCadangan, alasan: pesan };
  }
}
