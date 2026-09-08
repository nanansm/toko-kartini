import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getCurrentUser, canAccess, PERMISSIONS } from '@/lib/session';
import { LABEL_LOKASI, isKodeLokasi } from '@/lib/lokasi';
import {
  barisLogTim,
  barisMutasiTim,
  tulisLogTim,
  tulisMutasiTim,
  JENIS_TIM,
  type BarisEntriTim,
  type BarisMutasiTim,
  type SatuanQty,
} from '@kartini/sheets';

export const dynamic = 'force-dynamic';

interface BadanEntri {
  jenis: 'ENTRI';
  rak: string;
}

interface BadanMutasi {
  jenis: 'MUTASI';
  dari: string;
  ke: string;
}

type Badan = BadanEntri | BadanMutasi;

function isBadan(value: unknown): value is Badan {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  if (r.jenis === 'ENTRI') {
    return typeof r.rak === 'string' && r.rak.length > 0;
  }
  if (r.jenis === 'MUTASI') {
    return typeof r.dari === 'string' && r.dari.length > 0 && typeof r.ke === 'string' && r.ke.length > 0;
  }
  return false;
}

// Baris SQLite DO pakai kolom huruf kecil garis bawah -- ini bentuk minimal yang
// dibaca dari sana, bukan tipe punya DO (DO tidak mengekspor tipe ke app ini).
interface BarisEntriDO {
  diubah: string;
  jenis?: string;
  rak?: string;
  dari?: string;
  ke?: string;
  pengguna: string;
  nama_produk: string;
  satuan: SatuanQty[];
  qty_total: number;
  expired?: string | null;
  nota?: string;
  sebab?: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  // Penjaga sesi wajib mendahului penguraian badan dan selalu membalas JSON --
  // pengirim latar di HP menganggap HTML/redirect sebagai sukses lalu membuang baris.
  const pengguna = await getCurrentUser();
  if (!pengguna) {
    return NextResponse.json({ ok: false, pesan: 'Sesi berakhir, masuk lagi.' }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ ok: false, pesan: 'Badan bukan JSON sah' }, { status: 400 });
  }

  if (!isBadan(parsed)) {
    return NextResponse.json(
      { ok: false, pesan: 'Badan wajib berisi jenis (ENTRI/MUTASI) beserta rak, atau dari+ke' },
      { status: 400 },
    );
  }

  if (parsed.jenis === 'ENTRI') {
    if (!canAccess(pengguna.peran, PERMISSIONS.MULAI_SO)) {
      return NextResponse.json({ ok: false, pesan: 'Tidak berwenang mencatat SO' }, { status: 403 });
    }
    if (!isKodeLokasi(parsed.rak)) {
      return NextResponse.json({ ok: false, pesan: 'Rak tidak dikenal.' }, { status: 400 });
    }
  } else {
    if (!canAccess(pengguna.peran, PERMISSIONS.CATAT_MUTASI)) {
      return NextResponse.json({ ok: false, pesan: 'Tidak berwenang mencatat mutasi' }, { status: 403 });
    }
    if (!isKodeLokasi(parsed.dari) || !isKodeLokasi(parsed.ke)) {
      return NextResponse.json({ ok: false, pesan: 'Lokasi tidak dikenal.' }, { status: 400 });
    }
  }

  // Wajib process.env, bukan getCloudflareContext().env: yang lewat konteks Cloudflare
  // cuma pengikat objek (KV, DO), nilai teks seperti ID spreadsheet dibaca dari process.env.
  const sheetId = process.env.SHEET_SO_ID;
  if (!sheetId) {
    return NextResponse.json({ ok: false, pesan: 'SHEET_SO_ID belum diset.' }, { status: 500 });
  }

  const { env } = getCloudflareContext();
  const stub = env.BUKU.get(env.BUKU.idFromName('buku'));

  let ids: number[];
  let barisDO: BarisEntriDO[];

  try {
    const path = parsed.jenis === 'ENTRI' ? '/entri/klaim' : '/mutasi/klaim';
    const body =
      parsed.jenis === 'ENTRI'
        ? { rak: parsed.rak, pengguna: pengguna.username }
        : { dari: parsed.dari, ke: parsed.ke, pengguna: pengguna.username };
    const res = await stub.fetch(`https://do${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status !== 200) {
      const badan = await res.json();
      return NextResponse.json(badan, { status: res.status });
    }
    const hasil = (await res.json()) as { ok: true; ids: number[]; baris: BarisEntriDO[] };
    ids = hasil.ids;
    barisDO = hasil.baris;
  } catch {
    return NextResponse.json({ ok: false, pesan: 'Gagal mengklaim baris, coba lagi.' }, { status: 502 });
  }

  if (ids.length === 0) {
    return NextResponse.json({ ok: true, terkirim: 0, dilewati: [] });
  }

  try {
    if (parsed.jenis === 'ENTRI') {
      const entri: BarisEntriTim[] = barisDO.map((b) => ({
        diubah: b.diubah,
        pengguna: b.pengguna,
        rak: LABEL_LOKASI[(b.rak ?? parsed.rak) as keyof typeof LABEL_LOKASI],
        namaProduk: b.nama_produk,
        satuan: b.satuan,
        qtyTotal: b.qty_total,
        expired: b.expired ?? null,
      }));
      const { baris, dilewati } = barisLogTim(entri);
      await tulisLogTim(sheetId, baris);
      return NextResponse.json({ ok: true, terkirim: baris.length, dilewati });
    } else {
      const mutasi: BarisMutasiTim[] = barisDO.map((b) => ({
        diubah: b.diubah,
        pengguna: b.pengguna,
        jenis: JENIS_TIM[b.jenis ?? ''] ?? (b.jenis ?? ''),
        dari: LABEL_LOKASI[(b.dari as keyof typeof LABEL_LOKASI)],
        ke: LABEL_LOKASI[(b.ke as keyof typeof LABEL_LOKASI)],
        namaProduk: b.nama_produk,
        satuan: b.satuan,
        qtyTotal: b.qty_total,
        nota: b.nota ?? '',
        sebab: b.sebab ?? '',
      }));
      const { baris, dilewati } = barisMutasiTim(mutasi);
      await tulisMutasiTim(sheetId, baris);
      // Yang dilaporkan adalah jumlah baris yang benar-benar masuk sheet, BUKAN
      // jumlah baris yang diklaim -- barang tanpa satuan dasar dilewati oleh
      // barisMutasiTim/barisLogTim dan tidak boleh dihitung terkirim.
      return NextResponse.json({ ok: true, terkirim: baris.length, dilewati });
    }
  } catch {
    // Penulisan ke Sheets gagal: klaim WAJIB dibatalkan, kalau tidak baris hilang
    // dari layar staf (sudah diklaim) sekaligus tidak pernah masuk spreadsheet.
    try {
      const batalPath = parsed.jenis === 'ENTRI' ? '/entri/batalklaim' : '/mutasi/batalklaim';
      await stub.fetch(`https://do${batalPath}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
    } catch {
      // Batal-klaim pun gagal -- tidak ada lagi yang bisa dilakukan di sini,
      // baris tetap berstatus klaim di DO dan perlu ditinjau manual.
    }
    return NextResponse.json({ ok: false, pesan: 'Gagal mengirim ke spreadsheet, coba lagi.' }, { status: 502 });
  }
}
