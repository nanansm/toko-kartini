import { readSheet, appendRows, updateRange } from './client';

export const KOLOM_SESI = [
  'id',
  'waktu_mulai',
  'waktu_saldo',
  'waktu_kirim',
  'lokasi',
  'user',
  'status',
  'jumlah_baris',
  'catatan',
] as const;

export const KOLOM_TINJAU = [
  'id',
  'sesi_id',
  'product_id',
  'nama',
  'lokasi',
  'qty_hitung',
  'qty_terlihat',
  'qty_sistem',
  'mutasi_menyelip',
  'status',
  'keputusan',
  'user_tinjau',
  'waktu_tinjau',
] as const;

export interface BarisSesi {
  id: number;
  waktuMulai: string;
  waktuSaldo: string;
  waktuKirim: string | null;
  lokasi: string;
  user: string;
  status: string;
  jumlahBaris: number | null;
  catatan: string | null;
  barisSheet: number;
}

export interface BarisTinjau {
  id: number;
  sesiId: number;
  productId: string;
  nama: string;
  lokasi: string;
  qtyHitung: number | null;
  qtyTerlihat: number | null;
  qtySistem: number | null;
  mutasiMenyelip: string;
  status: string;
  keputusan: string | null;
  userTinjau: string | null;
  waktuTinjau: string | null;
  barisSheet: number;
}

const SESI_TAB = 'Sesi_SO';
const SESI_RANGE = `${SESI_TAB}!A2:I`;
const TINJAU_TAB = 'Tinjau_SO';
const TINJAU_RANGE = `${TINJAU_TAB}!A2:M`;

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

function arrayKeBarisSesi(row: string[], barisSheet: number): BarisSesi | null {
  // Number('') memulangkan 0 — baris tanpa id lolos jadi id 0 kalau tidak
  // dicegat lebih dulu, dan ikut kehitung sebagai sesi sah.
  const idMentah = (row[0] ?? '').trim();
  const id = Number(idMentah);
  if (idMentah === '' || !Number.isFinite(id)) return null;

  return {
    id,
    waktuMulai: row[1] ?? '',
    waktuSaldo: row[2] ?? '',
    waktuKirim: kosongJadiNull(row[3]),
    lokasi: row[4] ?? '',
    user: row[5] ?? '',
    status: row[6] ?? '',
    jumlahBaris: angkaAtauNull(row[7]),
    catatan: kosongJadiNull(row[8]),
    barisSheet,
  };
}

function barisSesiKeArray(baris: Omit<BarisSesi, 'barisSheet'>): (string | number)[] {
  return [
    baris.id,
    baris.waktuMulai,
    baris.waktuSaldo,
    baris.waktuKirim ?? '',
    baris.lokasi,
    baris.user,
    baris.status,
    baris.jumlahBaris ?? '',
    baris.catatan ?? '',
  ];
}

function arrayKeBarisTinjau(row: string[], barisSheet: number): BarisTinjau | null {
  const idMentah = (row[0] ?? '').trim();
  const id = Number(idMentah);
  if (idMentah === '' || !Number.isFinite(id)) return null;

  const sesiIdMentah = (row[1] ?? '').trim();
  const sesiId = Number(sesiIdMentah);
  if (sesiIdMentah === '' || !Number.isFinite(sesiId)) return null;

  return {
    id,
    sesiId,
    productId: row[2] ?? '',
    nama: row[3] ?? '',
    lokasi: row[4] ?? '',
    // Sel kosong atau sampah -> null, BUKAN 0. Angka 0 di sini berarti
    // "dihitung dan hasilnya nol" — kalau tertukar dengan "tidak ada data",
    // baris yang belum dihitung terbaca sebagai stok kosong yang sah.
    qtyHitung: angkaAtauNull(row[5]),
    qtyTerlihat: angkaAtauNull(row[6]),
    qtySistem: angkaAtauNull(row[7]),
    mutasiMenyelip: row[8] ?? '',
    status: row[9] ?? '',
    keputusan: kosongJadiNull(row[10]),
    userTinjau: kosongJadiNull(row[11]),
    waktuTinjau: kosongJadiNull(row[12]),
    barisSheet,
  };
}

function barisTinjauKeArray(baris: Omit<BarisTinjau, 'barisSheet'>): (string | number)[] {
  return [
    baris.id,
    baris.sesiId,
    baris.productId,
    baris.nama,
    baris.lokasi,
    baris.qtyHitung ?? '',
    baris.qtyTerlihat ?? '',
    baris.qtySistem ?? '',
    baris.mutasiMenyelip,
    baris.status,
    baris.keputusan ?? '',
    baris.userTinjau ?? '',
    baris.waktuTinjau ?? '',
  ];
}

export async function bacaSesi(sheetId: string): Promise<BarisSesi[]> {
  const rows = await readSheet(sheetId, SESI_RANGE);
  const hasil: BarisSesi[] = [];
  rows.forEach((row, i) => {
    const baris = arrayKeBarisSesi(row, i + 2);
    if (baris) hasil.push(baris);
  });
  return hasil;
}

export async function tambahSesi(
  sheetId: string,
  sesi: Omit<BarisSesi, 'id' | 'barisSheet'>
): Promise<number> {
  // id baru = id terbesar YANG ADA + 1, dibaca ulang tepat sebelum menulis.
  // Panjang array salah kalau ada baris yang dihapus tangan di spreadsheet.
  const semua = await bacaSesi(sheetId);
  let idTerakhir = 0;
  for (const baris of semua) {
    if (baris.id > idTerakhir) idTerakhir = baris.id;
  }
  const id = idTerakhir + 1;

  await appendRows(sheetId, `${SESI_TAB}!A:I`, [barisSesiKeArray({ ...sesi, id })]);
  return id;
}

export async function ubahSesi(
  sheetId: string,
  id: number,
  ubah: Partial<Omit<BarisSesi, 'id' | 'barisSheet'>>
): Promise<boolean> {
  const semua = await bacaSesi(sheetId);
  const ada = semua.find((b) => b.id === id);
  if (!ada) return false;

  const digabung: Omit<BarisSesi, 'barisSheet'> = { ...ada, ...ubah, id };
  await updateRange(
    sheetId,
    `${SESI_TAB}!A${ada.barisSheet}:I${ada.barisSheet}`,
    [barisSesiKeArray(digabung)]
  );
  return true;
}

export async function bacaTinjau(sheetId: string): Promise<BarisTinjau[]> {
  const rows = await readSheet(sheetId, TINJAU_RANGE);
  const hasil: BarisTinjau[] = [];
  rows.forEach((row, i) => {
    const baris = arrayKeBarisTinjau(row, i + 2);
    if (baris) hasil.push(baris);
  });
  return hasil;
}

export async function tambahTinjau(
  sheetId: string,
  baris: readonly Omit<BarisTinjau, 'id' | 'barisSheet'>[]
): Promise<number[]> {
  if (baris.length === 0) return [];

  const semua = await bacaTinjau(sheetId);
  let idTerakhir = 0;
  for (const b of semua) {
    if (b.id > idTerakhir) idTerakhir = b.id;
  }

  const idBaru: number[] = [];
  const rows: (string | number)[][] = [];
  for (const b of baris) {
    idTerakhir += 1;
    idBaru.push(idTerakhir);
    rows.push(barisTinjauKeArray({ ...b, id: idTerakhir }));
  }

  // Satu appendRows untuk semua baris — Google membatasi 60 tulis/menit
  // untuk seluruh toko, perulangan per baris menghabiskannya dalam sekejap.
  await appendRows(sheetId, `${TINJAU_TAB}!A:M`, rows);
  return idBaru;
}

export async function putuskanTinjau(
  sheetId: string,
  id: number,
  keputusan: string,
  userTinjau: string
): Promise<boolean> {
  const semua = await bacaTinjau(sheetId);
  const ada = semua.find((b) => b.id === id);
  if (!ada) return false;
  // Baris yang sudah diputus TIDAK boleh diputus ulang. Tanpa penjagaan di sini,
  // satu klik ganda menerapkan penyesuaian stok dua kali dan tidak ada apa pun
  // di hilir yang bisa membedakannya dari dua tinjauan yang sah.
  if (ada.status === 'DIPUTUS') return false;

  const digabung: Omit<BarisTinjau, 'barisSheet'> = {
    ...ada,
    status: 'DIPUTUS',
    keputusan,
    userTinjau,
    waktuTinjau: new Date().toISOString(),
  };
  await updateRange(
    sheetId,
    `${TINJAU_TAB}!A${ada.barisSheet}:M${ada.barisSheet}`,
    [barisTinjauKeArray(digabung)]
  );
  return true;
}
