import { readSheet, batchGet, appendRows } from './client';

export const KOLOM_LOG = [
  'id',
  'waktu_server',
  'jenis',
  'product_id',
  'nama_saat_itu',
  'qty_pokok',
  'satuan_input',
  'qty_input',
  'dari',
  'ke',
  'qty_terlihat',
  'sebab',
  'catatan',
  'user',
  'client_id',
  'sesi_id',
] as const;

export interface BarisLog {
  id: number;
  waktuServer: string;
  jenis: string;
  productId: string;
  namaSaatItu: string;
  // null = sel kosong atau bukan angka. Sengaja tidak dipaksa jadi 0 — lihat
  // arrayKeBarisLog. Pemanggil wajib menanganinya sebagai kejanggalan.
  qtyPokok: number | null;
  satuanInput: string;
  qtyInput: number | null;
  dari: string | null;
  ke: string | null;
  qtyTerlihat: number | null;
  sebab: string | null;
  catatan: string | null;
  user: string;
  clientId: string;
  sesiId: string | null;
  barisSheet: number;
}

export interface SaldoAwal {
  productId: string;
  lokasi: string;
  qty: number;
}

const SALDO_AWAL_TAB = 'Saldo_Awal';
const SALDO_AWAL_RANGE = `${SALDO_AWAL_TAB}!A2:D`;
const ERROR_TAB = 'Error';

function kosongJadiNull(raw: string | undefined): string | null {
  const s = (raw ?? '').trim();
  return s === '' ? null : s;
}

function angkaAtauNull(raw: string | undefined): number | null {
  const s = (raw ?? '').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Worker selalu jalan di UTC; getter lokal beda hasil dengan mesin dev
// saat pergantian bulan, jadi wajib pakai getter UTC di sini.
export function namaTabLog(waktu: Date): string {
  const tahun = waktu.getUTCFullYear();
  const bulan = String(waktu.getUTCMonth() + 1).padStart(2, '0');
  return `Log_${tahun}-${bulan}`;
}

export function barisLogKeArray(baris: Omit<BarisLog, 'barisSheet'>): (string | number)[] {
  return [
    baris.id,
    baris.waktuServer,
    baris.jenis,
    baris.productId,
    baris.namaSaatItu,
    baris.qtyPokok ?? '',
    baris.satuanInput,
    baris.qtyInput ?? '',
    baris.dari ?? '',
    baris.ke ?? '',
    baris.qtyTerlihat ?? '',
    baris.sebab ?? '',
    baris.catatan ?? '',
    baris.user,
    baris.clientId,
    baris.sesiId ?? '',
  ];
}

export function arrayKeBarisLog(row: string[], barisSheet: number): BarisLog | null {
  // Number('') memulangkan 0, bukan NaN. Tanpa pemeriksaan kosong lebih dulu,
  // baris tanpa id akan lolos sebagai id 0 dan ikut terhitung sebagai baris sah.
  const idMentah = (row[0] ?? '').trim();
  const id = Number(idMentah);
  if (idMentah === '' || !Number.isFinite(id)) return null;

  const clientId = (row[14] ?? '').trim();
  if (clientId === '') return null;

  return {
    id,
    waktuServer: row[1] ?? '',
    jenis: row[2] ?? '',
    productId: row[3] ?? '',
    namaSaatItu: row[4] ?? '',
    // Sel kosong atau berisi sampah dipulangkan null, BUKAN 0. Number('')
    // memulangkan 0, dan 0 di sini berarti "mutasi ini tidak menggeser apa pun"
    // — kerusakan data berubah jadi saldo yang kelihatan waras. Pemanggil wajib
    // memperlakukan null sebagai kejanggalan, bukan sebagai nol.
    qtyPokok: angkaAtauNull(row[5]),
    satuanInput: row[6] ?? '',
    qtyInput: angkaAtauNull(row[7]),
    dari: kosongJadiNull(row[8]),
    ke: kosongJadiNull(row[9]),
    qtyTerlihat: angkaAtauNull(row[10]),
    sebab: kosongJadiNull(row[11]),
    catatan: kosongJadiNull(row[12]),
    user: row[13] ?? '',
    clientId,
    sesiId: kosongJadiNull(row[15]),
    barisSheet,
  };
}

export async function bacaLog(sheetId: string, tab: string): Promise<BarisLog[]> {
  const rows = await readSheet(sheetId, `${tab}!A2:P`);
  const hasil: BarisLog[] = [];
  rows.forEach((row, i) => {
    const baris = arrayKeBarisLog(row, i + 2);
    if (baris) hasil.push(baris);
  });
  return hasil;
}

export async function tambahBarisLog(
  sheetId: string,
  tab: string,
  rows: (string | number)[][]
): Promise<void> {
  await appendRows(sheetId, `${tab}!A:P`, rows);
}

export async function ringkasLog(
  sheetId: string,
  tab: string
): Promise<{ idTerakhir: number; clientIds: Set<string> }> {
  // Cuma dua kolom yang dipakai (id & client_id). Fungsi ini dipanggil tiap
  // antrean tulis kosong — julat sempit lewat batchGet menghemat kuota &
  // CPU dibanding menarik seluruh 16 kolom tiap kali.
  const rentangId = `${tab}!A2:A`;
  const rentangClient = `${tab}!O2:O`;
  const hasil = await batchGet(sheetId, [rentangId, rentangClient]);
  const kolomId = hasil[rentangId] ?? [];
  const kolomClient = hasil[rentangClient] ?? [];

  // idTerakhir = nilai id terbesar, bukan panjang array — baris bisa dihapus
  // tangan di spreadsheet, dan panjang array bisa memakai ulang id lama.
  let idTerakhir = 0;
  for (const row of kolomId) {
    const mentah = (row[0] ?? '').trim();
    if (mentah === '') continue;
    const nilai = Number(mentah);
    if (Number.isFinite(nilai) && nilai > idTerakhir) idTerakhir = nilai;
  }

  const clientIds = new Set<string>();
  for (const row of kolomClient) {
    const cid = (row[0] ?? '').trim();
    if (cid !== '') clientIds.add(cid);
  }

  return { idTerakhir, clientIds };
}

export async function bacaSaldoAwal(sheetId: string, bulan: string): Promise<SaldoAwal[]> {
  const rows = await readSheet(sheetId, SALDO_AWAL_RANGE);
  const hasil: SaldoAwal[] = [];
  for (const row of rows) {
    if ((row[0] ?? '') !== bulan) continue;
    const qtyMentah = (row[3] ?? '').trim();
    const qty = Number(qtyMentah);
    if (qtyMentah === '' || !Number.isFinite(qty)) continue;
    hasil.push({
      productId: row[1] ?? '',
      lokasi: row[2] ?? '',
      qty,
    });
  }
  return hasil;
}

/** Bulan mana saja yang sudah punya baris di Saldo_Awal. */
export async function bulanSaldoAwal(sheetId: string): Promise<Set<string>> {
  const rows = await readSheet(sheetId, SALDO_AWAL_RANGE);
  const hasil = new Set<string>();
  for (const row of rows) {
    const bulan = (row[0] ?? '').trim();
    if (bulan !== '') hasil.add(bulan);
  }
  return hasil;
}

export async function tambahSaldoAwal(
  sheetId: string,
  bulan: string,
  baris: readonly { productId: string; lokasi: string; qty: number }[]
): Promise<void> {
  if (baris.length === 0) return;
  // Satu appendRows untuk semua baris — kuota tulis Sheets 60/menit per toko.
  const rows = baris.map((b) => [bulan, b.productId, b.lokasi, b.qty]);
  await appendRows(sheetId, `${SALDO_AWAL_TAB}!A:D`, rows);
}

export async function catatErrorSheet(
  sheetId: string,
  pesan: string,
  konteks: string
): Promise<void> {
  // Fungsi pelapor galat tidak boleh ikut melempar — gagal mencatat error
  // tidak boleh menjatuhkan pekerjaan yang sedang berjalan.
  try {
    await appendRows(sheetId, `${ERROR_TAB}!A:C`, [
      [new Date().toISOString(), pesan, konteks],
    ]);
  } catch {
    // ditelan dengan sengaja
  }
}
