import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { cariPenggunaByUsername, catatMasukTerakhir } from '@kartini/sheets';
import { verifikasiPin } from '@/lib/pin';
import { buatSesi } from '@/lib/session';
import type { UserRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

const PESAN_SALAH = 'Username atau PIN salah';

const PERAN_SAH: UserRole[] = ['OWNER', 'ADMIN', 'SUPERVISOR', 'STAF_GUDANG', 'KASIR'];

// Hash+garam umpan (nilai tetap, sah secara format) dipakai untuk menjalankan
// verifikasiPin ketika username tidak ditemukan, supaya waktu balasan
// "akun tidak ada" mirip dengan "PIN salah" — mencegah timing attack yang
// membocorkan username mana yang terdaftar.
const HASH_UMPAN = {
  hash: 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYQ==',
  garam: 'YmJiYmJiYmJiYmJiYmJiYg==',
  iterasi: 100_000,
};

interface BadanMasuk {
  username: string;
  pin: string;
}

function isBadanMasuk(value: unknown): value is BadanMasuk {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.username === 'string' &&
    r.username.trim().length > 0 &&
    typeof r.pin === 'string' &&
    r.pin.trim().length > 0
  );
}

async function panggilGerbang(
  env: ReturnType<typeof getCloudflareContext>['env'],
  path: string,
  username: string
): Promise<{ terkunci: boolean; sisaDetik?: number }> {
  const stub = env.GERBANG.get(env.GERBANG.idFromName('gerbang'));
  const res = await stub.fetch(`https://do${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  const data = (await res.json()) as { terkunci?: boolean; sisaDetik?: number };
  return { terkunci: Boolean(data.terkunci), sisaDetik: data.sisaDetik };
}

export async function POST(request: Request): Promise<NextResponse> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ ok: false, pesan: 'Badan bukan JSON sah' }, { status: 400 });
  }

  if (!isBadanMasuk(parsed)) {
    return NextResponse.json(
      { ok: false, pesan: 'Username dan PIN wajib diisi' },
      { status: 400 }
    );
  }

  const username = parsed.username.trim().toLowerCase();
  const pin = parsed.pin;

  const { env, ctx } = getCloudflareContext();

  const cek = await panggilGerbang(env, '/cek', username);
  if (cek.terkunci) {
    const menit = Math.ceil((cek.sisaDetik ?? 0) / 60);
    return NextResponse.json(
      {
        ok: false,
        pesan: `Terlalu banyak percobaan. Coba lagi dalam ${menit} menit.`,
        sisaDetik: cek.sisaDetik ?? 0,
      },
      { status: 429 }
    );
  }

  const sheetId = process.env.SHEET_ADMIN_ID;
  if (!sheetId) {
    // Salah pasang, bukan salah PIN. Dibedakan supaya tidak terlihat seperti
    // "semua orang tiba-tiba salah PIN" saat rahasianya lupa dipasang.
    return NextResponse.json(
      { ok: false, pesan: 'Sistem belum siap. Hubungi admin.' },
      { status: 503 }
    );
  }

  const pengguna = await cariPenggunaByUsername(sheetId, username);

  if (!pengguna) {
    // Jalankan verifikasi umpan supaya durasi mirip dengan jalur PIN salah.
    await verifikasiPin(pin, HASH_UMPAN);
    await panggilGerbang(env, '/gagal', username);
    return NextResponse.json({ ok: false, pesan: PESAN_SALAH }, { status: 401 });
  }

  if (!pengguna.aktif) {
    await verifikasiPin(pin, HASH_UMPAN);
    await panggilGerbang(env, '/gagal', username);
    return NextResponse.json({ ok: false, pesan: PESAN_SALAH }, { status: 401 });
  }

  const pinCocok = await verifikasiPin(pin, {
    hash: pengguna.pinHash,
    garam: pengguna.pinGaram,
    iterasi: pengguna.pinIterasi,
  });

  if (!pinCocok) {
    await panggilGerbang(env, '/gagal', username);
    return NextResponse.json({ ok: false, pesan: PESAN_SALAH }, { status: 401 });
  }

  await panggilGerbang(env, '/berhasil', username);

  // Peran datang dari sel yang boleh diedit tangan. Salah ketik tidak boleh
  // diam-diam berubah jadi "tanpa akses" — itu menghabiskan waktu orang.
  const peran = pengguna.peran.trim().toUpperCase();
  if (!PERAN_SAH.includes(peran as UserRole)) {
    return NextResponse.json(
      { ok: false, pesan: 'Peran akun tidak dikenal. Hubungi admin.' },
      { status: 409 }
    );
  }

  await buatSesi({
    id: pengguna.userId,
    username: pengguna.username,
    nama: pengguna.nama,
    peran: peran as UserRole,
    lokasi: pengguna.lokasi,
  });

  ctx.waitUntil(
    catatMasukTerakhir(sheetId, pengguna.barisSheet, new Date().toISOString()).catch(() => {
      // Kegagalan pencatatan waktu masuk terakhir tidak boleh menggagalkan login.
    })
  );

  return NextResponse.json({ ok: true, nama: pengguna.nama, peran: pengguna.peran });
}
