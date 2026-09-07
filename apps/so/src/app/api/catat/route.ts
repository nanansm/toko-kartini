import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getCurrentUser, canAccess, PERMISSIONS } from '@/lib/session';
import { periksaMutasi, type MasukanMutasi, type BarisMutasi } from '@/lib/mutasi';
import { petaProdukRingkas } from '@/lib/katalog';
import { MODE_LAPORAN } from '@/lib/mode';

export const dynamic = 'force-dynamic';

const BATAS_BARIS = 100;

interface BadanCatat {
  baris: MasukanMutasi[];
}

function isMasukanMutasi(value: unknown): value is MasukanMutasi {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.clientId === 'string' &&
    typeof r.jenis === 'string' &&
    typeof r.productId === 'string' &&
    typeof r.namaSaatItu === 'string' &&
    typeof r.satuanInput === 'string' &&
    typeof r.qtyInput === 'number' &&
    (r.dari === null || typeof r.dari === 'string') &&
    (r.ke === null || typeof r.ke === 'string') &&
    (r.sebab === null || typeof r.sebab === 'string') &&
    (r.catatan === null || typeof r.catatan === 'string')
  );
}

function isBadanCatat(value: unknown): value is BadanCatat {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return Array.isArray(r.baris) && r.baris.every(isMasukanMutasi);
}

// Model laporan: pencatatan pindah ke aplikasi tim, jadi jalur tulis di sini
// ditutup. 410 -- bukan 404 -- supaya pemanggil lama tahu endpointnya memang
// sengaja dimatikan, bukan salah alamat.
function ditutup(): NextResponse {
  return NextResponse.json(
    { ok: false, pesan: 'Pencatatan pindah ke aplikasi gudang tim. Layar ini hanya menampilkan laporan.' },
    { status: 410 }
  );
}

export async function GET(): Promise<NextResponse> {
  if (MODE_LAPORAN) return ditutup();
  return NextResponse.json({ ok: false, pesan: 'Metode tidak didukung' }, { status: 405 });
}

export async function POST(request: Request): Promise<NextResponse> {
  if (MODE_LAPORAN) return ditutup();
  // Alamat workers.dev ini publik dan jatah CPU paket gratis cuma 10 ms —
  // penjaga sesi wajib mendahului penguraian badan, bukan menyusul.
  // requireAuth melakukan redirect() — kalau sinyal HP hilang, pengirim latar
  // akan menganggap 302/HTML itu sukses lalu membuang barisnya dari antrean.
  // Route ini wajib selalu membalas JSON, termasuk saat sesi habis.
  const pengguna = await getCurrentUser();
  if (!pengguna) {
    return NextResponse.json({ ok: false, pesan: 'Sesi berakhir, masuk lagi.' }, { status: 401 });
  }

  if (!canAccess(pengguna.peran, PERMISSIONS.CATAT_MUTASI)) {
    return NextResponse.json(
      { ok: false, pesan: 'Tidak berwenang mencatat mutasi' },
      { status: 403 }
    );
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ ok: false, pesan: 'Badan bukan JSON sah' }, { status: 400 });
  }

  if (!isBadanCatat(parsed) || parsed.baris.length === 0) {
    return NextResponse.json(
      { ok: false, pesan: 'Badan wajib berisi larik "baris" yang tidak kosong' },
      { status: 400 }
    );
  }

  if (parsed.baris.length > BATAS_BARIS) {
    return NextResponse.json(
      { ok: false, pesan: `Kiriman terlalu besar, maksimal ${BATAS_BARIS} baris sekali kirim` },
      { status: 400 }
    );
  }

  const sheetId = process.env.SHEET_OPS_ID;
  if (!sheetId) {
    // Salah pasang, bukan salah pengguna — dibedakan supaya tidak terlihat
    // seperti semua pencatatan tiba-tiba ditolak.
    return NextResponse.json(
      { ok: false, pesan: 'Sistem belum siap. Hubungi admin.' },
      { status: 503 }
    );
  }

  const idUnik = [...new Set(parsed.baris.map((b) => b.productId))];
  const peta = await petaProdukRingkas(idUnik);

  const barisSah: BarisMutasi[] = [];
  const ditolak: { clientId: string; pesan: string }[] = [];

  for (const masukan of parsed.baris) {
    const produk = peta.get(masukan.productId);
    if (!produk) {
      // Barang berdata pincang memang sengaja tidak masuk katalog ini — bukan
      // kesalahan, itu penyaringan yang diinginkan.
      ditolak.push({
        clientId: masukan.clientId,
        pesan: 'Barang tidak ada di katalog atau datanya belum lengkap.',
      });
      continue;
    }

    // Nama disalin dari katalog, bukan dari HP: kalau HP yang menentukan,
    // riwayat lama bisa dipalsukan atau basi saat nama diubah di Pricelist.
    const hasil = periksaMutasi({ ...masukan, namaSaatItu: produk.nama }, produk.satuan);
    if (!hasil.ok) {
      ditolak.push({ clientId: masukan.clientId, pesan: hasil.pesan });
      continue;
    }

    barisSah.push(hasil.baris);
  }

  if (barisSah.length === 0) {
    return NextResponse.json(
      { ok: false, diterima: [], duplikat: [], tertunda: [], ditolak },
      { status: 400 }
    );
  }

  const { env } = getCloudflareContext();
  try {
    const stub = env.PENULIS.get(env.PENULIS.idFromName('penulis'));
    const res = await stub.fetch('https://do/tulis', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sheetId, user: pengguna.username, baris: barisSah }),
    });

    if (!res.ok) {
      throw new Error(`DO membalas status ${res.status}`);
    }

    const hasilDo = (await res.json()) as {
      ok: boolean;
      diterima: string[];
      duplikat: string[];
      tertunda: string[];
    };

    return NextResponse.json({ ...hasilDo, ditolak }, { status: 200 });
  } catch {
    // Jangan balas 200 di sini: pengirim latar memakai status ini untuk
    // memutuskan boleh-tidaknya membuang baris dari antrean HP.
    return NextResponse.json(
      { ok: false, pesan: 'Pencatatan belum tersimpan, akan dicoba lagi.' },
      { status: 502 }
    );
  }
}
