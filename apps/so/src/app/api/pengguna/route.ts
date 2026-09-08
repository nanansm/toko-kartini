import { NextResponse } from 'next/server';
import {
  ambilSemuaPengguna,
  cariPenggunaByUsername,
  tambahPengguna,
  setAktif,
  ubahPengguna,
  hapusPengguna,
} from '@kartini/sheets';
import type { UbahPengguna } from '@kartini/sheets';
import { hashPin } from '@/lib/pin';
import { getCurrentUser, canAccess, PERMISSIONS } from '@/lib/session';
import type { UserRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

const PERAN_SAH: readonly UserRole[] = ['OWNER', 'ADMIN', 'SUPERVISOR', 'STAF_GUDANG', 'KASIR'];

interface BadanBuatPengguna {
  username: string;
  nama: string;
  peran: string;
  pin: string;
  lokasi?: string[];
}

interface BadanUbahStatus {
  username: string;
  aktif: boolean;
}

interface BadanUbahDetail {
  username: string;
  ubah: {
    nama?: string;
    peran?: string;
    lokasi?: string[];
    pinBaru?: string;
  };
}

interface BadanHapusPengguna {
  username: string;
}

function isBadanBuatPengguna(value: unknown): value is BadanBuatPengguna {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.username === 'string' &&
    typeof r.nama === 'string' &&
    typeof r.peran === 'string' &&
    typeof r.pin === 'string' &&
    (r.lokasi === undefined ||
      (Array.isArray(r.lokasi) && r.lokasi.every((l) => typeof l === 'string')))
  );
}

function isBadanUbahStatus(value: unknown): value is BadanUbahStatus {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return typeof r.username === 'string' && typeof r.aktif === 'boolean';
}

function isBadanUbahDetail(value: unknown): value is BadanUbahDetail {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  if (typeof r.username !== 'string') return false;
  if (typeof r.ubah !== 'object' || r.ubah === null) return false;
  const u = r.ubah as Record<string, unknown>;
  if (u.nama !== undefined && typeof u.nama !== 'string') return false;
  if (u.peran !== undefined && typeof u.peran !== 'string') return false;
  if (
    u.lokasi !== undefined &&
    !(Array.isArray(u.lokasi) && u.lokasi.every((l) => typeof l === 'string'))
  ) {
    return false;
  }
  if (u.pinBaru !== undefined && typeof u.pinBaru !== 'string') return false;
  return true;
}

function isBadanHapusPengguna(value: unknown): value is BadanHapusPengguna {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return typeof r.username === 'string';
}

function pinLemah(pin: string): boolean {
  if (/^(\d)\1{5}$/.test(pin)) return true;

  const digit = pin.split('').map(Number);
  let menaik = true;
  let menurun = true;
  for (let i = 1; i < digit.length; i++) {
    const kini = digit[i] as number;
    const lalu = digit[i - 1] as number;
    if (kini !== lalu + 1) menaik = false;
    if (kini !== lalu - 1) menurun = false;
  }
  return menaik || menurun;
}

async function periksaIzin(): Promise<
  { ok: true } | { ok: false; status: 401 | 403; pesan: string }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, status: 401, pesan: 'Belum masuk' };
  }
  if (!canAccess(user.peran, PERMISSIONS.KELOLA_PENGGUNA)) {
    return { ok: false, status: 403, pesan: 'Tidak berwenang mengelola pengguna' };
  }
  return { ok: true };
}

export async function GET(): Promise<NextResponse> {
  const izin = await periksaIzin();
  if (!izin.ok) {
    return NextResponse.json({ ok: false, pesan: izin.pesan }, { status: izin.status });
  }

  const sheetId = process.env.SHEET_ADMIN_ID as string;
  const semua = await ambilSemuaPengguna(sheetId);

  const pengguna = semua.map(({ pinHash, pinGaram, ...aman }) => aman);

  return NextResponse.json({ ok: true, pengguna });
}

export async function POST(request: Request): Promise<NextResponse> {
  const izin = await periksaIzin();
  if (!izin.ok) {
    return NextResponse.json({ ok: false, pesan: izin.pesan }, { status: izin.status });
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ ok: false, pesan: 'Badan bukan JSON sah' }, { status: 400 });
  }

  if (!isBadanBuatPengguna(parsed)) {
    return NextResponse.json({ ok: false, pesan: 'Bentuk badan permintaan tidak sah' }, {
      status: 400,
    });
  }

  const username = parsed.username.trim().toLowerCase();
  if (!/^[a-z0-9._]{3,20}$/.test(username)) {
    return NextResponse.json(
      { ok: false, pesan: 'username: wajib 3-20 karakter huruf/angka/titik/garis bawah' },
      { status: 400 }
    );
  }

  if (!/^\d{6}$/.test(parsed.pin)) {
    return NextResponse.json(
      { ok: false, pesan: 'pin: wajib tepat 6 angka' },
      { status: 400 }
    );
  }

  if (pinLemah(parsed.pin)) {
    return NextResponse.json(
      { ok: false, pesan: 'pin: terlalu mudah ditebak, pilih PIN lain' },
      { status: 400 }
    );
  }

  if (!PERAN_SAH.includes(parsed.peran as UserRole)) {
    return NextResponse.json(
      { ok: false, pesan: `peran: wajib salah satu dari ${PERAN_SAH.join(', ')}` },
      { status: 400 }
    );
  }

  const nama = parsed.nama.trim();
  if (nama.length === 0) {
    return NextResponse.json({ ok: false, pesan: 'nama: tidak boleh kosong' }, { status: 400 });
  }

  const sheetId = process.env.SHEET_ADMIN_ID as string;

  const sudahAda = await cariPenggunaByUsername(sheetId, username);
  if (sudahAda) {
    return NextResponse.json({ ok: false, pesan: 'username sudah dipakai' }, { status: 409 });
  }

  const hasilHash = await hashPin(parsed.pin);
  const userId = crypto.randomUUID();

  await tambahPengguna(sheetId, {
    userId,
    username,
    nama,
    peran: parsed.peran,
    pinHash: hasilHash.hash,
    pinGaram: hasilHash.garam,
    pinIterasi: hasilHash.iterasi,
    lokasi: parsed.lokasi ?? [],
    aktif: true,
  });

  return NextResponse.json({ ok: true, userId }, { status: 201 });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const izin = await periksaIzin();
  if (!izin.ok) {
    return NextResponse.json({ ok: false, pesan: izin.pesan }, { status: izin.status });
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ ok: false, pesan: 'Badan bukan JSON sah' }, { status: 400 });
  }

  if (isBadanUbahStatus(parsed)) {
    const username = parsed.username.trim().toLowerCase();
    const user = await getCurrentUser();

    if (!parsed.aktif && user?.username.trim().toLowerCase() === username) {
      return NextResponse.json(
        { ok: false, pesan: 'Tidak boleh menonaktifkan akun sendiri' },
        { status: 400 }
      );
    }

    const sheetId = process.env.SHEET_ADMIN_ID as string;
    const target = await cariPenggunaByUsername(sheetId, username);
    if (!target) {
      return NextResponse.json({ ok: false, pesan: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    await setAktif(sheetId, target.barisSheet, parsed.aktif);

    return NextResponse.json({ ok: true });
  }

  if (isBadanUbahDetail(parsed)) {
    const username = parsed.username.trim().toLowerCase();
    const user = await getCurrentUser();

    const { nama: namaMentah, peran, lokasi, pinBaru } = parsed.ubah;
    const nama = namaMentah?.trim();
    if (namaMentah !== undefined && nama === '') {
      return NextResponse.json({ ok: false, pesan: 'nama: tidak boleh kosong' }, { status: 400 });
    }

    if (peran !== undefined && !PERAN_SAH.includes(peran as UserRole)) {
      return NextResponse.json(
        { ok: false, pesan: `peran: wajib salah satu dari ${PERAN_SAH.join(', ')}` },
        { status: 400 }
      );
    }

    // Pemilik yang tanpa sengaja menurunkan perannya sendiri langsung terkunci
    // dari halaman ini, dan tidak ada jalan balik lewat aplikasi.
    if (peran !== undefined && user?.username.trim().toLowerCase() === username) {
      return NextResponse.json(
        { ok: false, pesan: 'Tidak boleh mengubah peran akun sendiri' },
        { status: 400 }
      );
    }

    if (pinBaru !== undefined && !/^\d{6}$/.test(pinBaru)) {
      return NextResponse.json(
        { ok: false, pesan: 'pin: wajib tepat 6 angka' },
        { status: 400 }
      );
    }

    if (pinBaru !== undefined && pinLemah(pinBaru)) {
      return NextResponse.json(
        { ok: false, pesan: 'pin: terlalu mudah ditebak, pilih PIN lain' },
        { status: 400 }
      );
    }

    if (nama === undefined && peran === undefined && lokasi === undefined && pinBaru === undefined) {
      return NextResponse.json(
        { ok: false, pesan: 'ubah: tidak ada field yang diisi' },
        { status: 400 }
      );
    }

    const sheetId = process.env.SHEET_ADMIN_ID as string;
    const target = await cariPenggunaByUsername(sheetId, username);
    if (!target) {
      return NextResponse.json({ ok: false, pesan: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    const dataUbah: UbahPengguna = {};
    if (nama !== undefined) dataUbah.nama = nama;
    if (peran !== undefined) dataUbah.peran = peran;
    if (lokasi !== undefined) dataUbah.lokasi = lokasi;
    if (pinBaru !== undefined) {
      // Jalur hash sama persis dengan POST -- jangan bikin skema hash kedua.
      const hasilHash = await hashPin(pinBaru);
      dataUbah.pinHash = hasilHash.hash;
      dataUbah.pinGaram = hasilHash.garam;
      dataUbah.pinIterasi = hasilHash.iterasi;
    }

    await ubahPengguna(sheetId, target.barisSheet, dataUbah);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, pesan: 'Bentuk badan permintaan tidak sah' }, {
    status: 400,
  });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const izin = await periksaIzin();
  if (!izin.ok) {
    return NextResponse.json({ ok: false, pesan: izin.pesan }, { status: izin.status });
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ ok: false, pesan: 'Badan bukan JSON sah' }, { status: 400 });
  }

  if (!isBadanHapusPengguna(parsed)) {
    return NextResponse.json({ ok: false, pesan: 'Bentuk badan permintaan tidak sah' }, {
      status: 400,
    });
  }

  const username = parsed.username.trim().toLowerCase();
  const user = await getCurrentUser();

  if (user?.username.trim().toLowerCase() === username) {
    return NextResponse.json(
      { ok: false, pesan: 'Tidak boleh menghapus akun sendiri' },
      { status: 400 }
    );
  }

  const sheetId = process.env.SHEET_ADMIN_ID as string;
  const target = await cariPenggunaByUsername(sheetId, username);
  if (!target) {
    return NextResponse.json({ ok: false, pesan: 'Pengguna tidak ditemukan' }, { status: 404 });
  }

  // Baris di sheet Users boleh hilang -- riwayat di buku besar menyimpan
  // username sebagai TEKS, bukan rujukan ke baris ini, jadi catatan lama
  // tidak rusak sesudah akunnya dihapus.
  if (target.peran === 'OWNER' && target.aktif) {
    const semua = await ambilSemuaPengguna(sheetId);
    const ownerAktif = semua.filter((p) => p.peran === 'OWNER' && p.aktif);
    if (ownerAktif.length <= 1) {
      return NextResponse.json(
        { ok: false, pesan: 'Tidak boleh menghapus satu-satunya OWNER aktif' },
        { status: 400 }
      );
    }
  }

  await hapusPengguna(sheetId, target.barisSheet);

  return NextResponse.json({ ok: true });
}
