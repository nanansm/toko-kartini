import { readSheet, appendRows, updateRange, daftarTab, hapusBaris } from './client';

const SHEET_TAB = 'Users';
const DATA_RANGE = `${SHEET_TAB}!A2:L`;

export interface PenggunaSheet {
  userId: string;
  username: string;
  nama: string;
  peran: string;
  pinHash: string;
  pinGaram: string;
  pinIterasi: number;
  lokasi: string[];
  aktif: boolean;
  barisSheet: number; // nomor baris asli di sheet, dipakai untuk update
}

function parsePinIterasi(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

function parseLokasi(raw: string | undefined): string[] {
  if (!raw || raw.trim() === '') return [];
  return raw
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseAktif(raw: string | undefined): boolean {
  return (raw ?? '').trim().toUpperCase() === 'TRUE';
}

function rowToPengguna(row: string[], barisSheet: number): PenggunaSheet | null {
  const username = row[1];
  if (!username || username.trim() === '') return null;

  return {
    userId: row[0] ?? '',
    username,
    nama: row[2] ?? '',
    peran: row[3] ?? '',
    pinHash: row[4] ?? '',
    pinGaram: row[5] ?? '',
    pinIterasi: parsePinIterasi(row[6]),
    lokasi: parseLokasi(row[7]),
    aktif: parseAktif(row[8]),
    barisSheet,
  };
}

export async function ambilSemuaPengguna(sheetId: string): Promise<PenggunaSheet[]> {
  const rows = await readSheet(sheetId, DATA_RANGE);
  const hasil: PenggunaSheet[] = [];
  rows.forEach((row, i) => {
    const p = rowToPengguna(row, i + 2);
    if (p) hasil.push(p);
  });
  return hasil;
}

export async function cariPenggunaByUsername(
  sheetId: string,
  username: string
): Promise<PenggunaSheet | null> {
  const target = username.trim().toLowerCase();
  const semua = await ambilSemuaPengguna(sheetId);
  return semua.find((p) => p.username.trim().toLowerCase() === target) ?? null;
}

export async function tambahPengguna(
  sheetId: string,
  p: Omit<PenggunaSheet, 'barisSheet'>
): Promise<void> {
  const row: (string | number)[] = [
    p.userId,
    p.username,
    p.nama,
    p.peran,
    p.pinHash,
    p.pinGaram,
    p.pinIterasi,
    p.lokasi.join(';'),
    p.aktif ? 'TRUE' : 'FALSE',
    new Date().toISOString(),
    '',
    '',
  ];
  await appendRows(sheetId, DATA_RANGE, [row]);
}

export async function setAktif(
  sheetId: string,
  barisSheet: number,
  aktif: boolean
): Promise<void> {
  await updateRange(sheetId, `${SHEET_TAB}!I${barisSheet}`, [[aktif ? 'TRUE' : 'FALSE']]);
}

export interface UbahPengguna {
  nama?: string;
  peran?: string;
  lokasi?: string[];
  /** Diisi hanya kalau PIN direset. Ketiganya wajib bersamaan. */
  pinHash?: string;
  pinGaram?: string;
  pinIterasi?: number;
}

// Menulis kolom yang diisi saja (bukan A:L penuh) supaya hash PIN yang tidak
// diminta berubah tidak ikut terkirim ulang.
export async function ubahPengguna(
  sheetId: string,
  barisSheet: number,
  ubah: UbahPengguna
): Promise<void> {
  if (
    ubah.nama === undefined &&
    ubah.peran === undefined &&
    ubah.lokasi === undefined &&
    ubah.pinHash === undefined &&
    ubah.pinGaram === undefined &&
    ubah.pinIterasi === undefined
  ) {
    return;
  }

  if (ubah.nama !== undefined) {
    await updateRange(sheetId, `${SHEET_TAB}!C${barisSheet}`, [[ubah.nama]]);
  }
  if (ubah.peran !== undefined) {
    await updateRange(sheetId, `${SHEET_TAB}!D${barisSheet}`, [[ubah.peran]]);
  }
  if (ubah.lokasi !== undefined) {
    await updateRange(sheetId, `${SHEET_TAB}!H${barisSheet}`, [[ubah.lokasi.join(';')]]);
  }
  if (ubah.pinHash !== undefined && ubah.pinGaram !== undefined && ubah.pinIterasi !== undefined) {
    await updateRange(sheetId, `${SHEET_TAB}!E${barisSheet}:G${barisSheet}`, [
      [ubah.pinHash, ubah.pinGaram, ubah.pinIterasi],
    ]);
  }
}

export async function hapusPengguna(sheetId: string, barisSheet: number): Promise<void> {
  const tabs = await daftarTab(sheetId);
  const tabUsers = tabs.find((t) => t.judul === SHEET_TAB);
  if (!tabUsers) {
    throw new Error(`Tab '${SHEET_TAB}' tidak ditemukan di sheet ${sheetId}`);
  }
  await hapusBaris(sheetId, tabUsers.gid, barisSheet);
}

export async function catatMasukTerakhir(
  sheetId: string,
  barisSheet: number,
  waktuIso: string
): Promise<void> {
  await updateRange(sheetId, `${SHEET_TAB}!K${barisSheet}`, [[waktuIso]]);
}
