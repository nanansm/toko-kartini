import { readSheet, appendRows, updateRange } from './client';

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

export async function catatMasukTerakhir(
  sheetId: string,
  barisSheet: number,
  waktuIso: string
): Promise<void> {
  await updateRange(sheetId, `${SHEET_TAB}!K${barisSheet}`, [[waktuIso]]);
}
