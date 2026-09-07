'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type KodeLokasi, LABEL_LOKASI, LOKASI_NYATA, isKodeLokasi } from '@/lib/lokasi';
import { cariLokal, katalogSiap, segarkanKatalogLokal, type ProdukRingkas } from '@/lib/katalog-lokal';
import { formatNumber, formatWaktuWIB } from '@/lib/format';

interface BarisHitung {
  productId: string;
  nama: string;
  satuanInput: string;
  qtyInput: number;
}

interface SesiBerjalan {
  id: number;
  lokasi: string;
  waktuMulai: string;
  waktuSaldo: string | null;
}

interface HasilKirim {
  diterapkan: number;
  takBerubah: number;
  ditinjau: number;
  ditolak: { productId: string; pesan: string }[];
}

const BATAS_BARIS = 300;

// Hitungan disimpan di peramban, bukan di server: satu sesi bisa memakan
// berjam-jam di gudang yang sinyalnya putus-nyambung, dan kalau HP terkunci
// atau halaman termuat ulang di tengah jalan, angka yang sudah dihitung tidak
// boleh ikut hilang. Kunci memakai id sesi supaya dua sesi tidak tertukar.
function kunciDraf(sesiId: number): string {
  return `kartini.hitung.${sesiId}`;
}

function bacaDraf(sesiId: number): BarisHitung[] {
  try {
    const mentah = window.localStorage.getItem(kunciDraf(sesiId));
    if (!mentah) return [];
    const parsed: unknown = JSON.parse(mentah);
    if (!Array.isArray(parsed)) return [];
    const hasil: BarisHitung[] = [];
    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) continue;
      const r = item as Record<string, unknown>;
      if (
        typeof r.productId === 'string' &&
        typeof r.nama === 'string' &&
        typeof r.satuanInput === 'string' &&
        typeof r.qtyInput === 'number' &&
        Number.isFinite(r.qtyInput)
      ) {
        hasil.push({
          productId: r.productId,
          nama: r.nama,
          satuanInput: r.satuanInput,
          qtyInput: r.qtyInput,
        });
      }
    }
    return hasil;
  } catch {
    return [];
  }
}

function simpanDraf(sesiId: number, baris: BarisHitung[]): void {
  try {
    window.localStorage.setItem(kunciDraf(sesiId), JSON.stringify(baris));
  } catch {
    // Kuota penuh atau mode privat. Hitungan tetap ada di memori halaman;
    // yang hilang cuma pemulihannya setelah muat ulang.
  }
}

function hapusDraf(sesiId: number): void {
  try {
    window.localStorage.removeItem(kunciDraf(sesiId));
  } catch {
    // sama seperti di atas — kegagalan menghapus tidak boleh menahan kiriman
  }
}

async function panggil(
  path: string,
  init: RequestInit,
): Promise<{ status: number; data: Record<string, unknown> | null }> {
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  let data: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = await res.json();
    if (typeof parsed === 'object' && parsed !== null) {
      data = parsed as Record<string, unknown>;
    }
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

function pesanDari(data: Record<string, unknown> | null, baku: string): string {
  const pesan = data?.pesan;
  return typeof pesan === 'string' && pesan !== '' ? pesan : baku;
}

export function FormHitung(): React.JSX.Element {
  const [memuat, setMemuat] = React.useState(true);
  const [sesi, setSesi] = React.useState<SesiBerjalan | null>(null);
  const [baris, setBaris] = React.useState<BarisHitung[]>([]);
  const [galat, setGalat] = React.useState<string | null>(null);
  const [sibuk, setSibuk] = React.useState(false);
  const [hasil, setHasil] = React.useState<HasilKirim | null>(null);

  const [lokasiPilihan, setLokasiPilihan] = React.useState<KodeLokasi | null>(null);

  const [katalogAda, setKatalogAda] = React.useState(false);
  const [kataKunci, setKataKunci] = React.useState('');
  const [hasilCari, setHasilCari] = React.useState<ProdukRingkas[]>([]);
  const [produkTerpilih, setProdukTerpilih] = React.useState<ProdukRingkas | null>(null);
  const [satuanTerpilih, setSatuanTerpilih] = React.useState('');
  const [jumlahTeks, setJumlahTeks] = React.useState('0');

  // ---------- muat sesi berjalan ----------
  React.useEffect(() => {
    let dibatalkan = false;
    void (async () => {
      const { status, data } = await panggil('/api/hitung', { method: 'GET' });
      if (dibatalkan) return;
      if (status !== 200 || data?.ok !== true) {
        setGalat(pesanDari(data, 'Gagal membaca sesi yang sedang berjalan.'));
        setMemuat(false);
        return;
      }
      const s = data.sesi;
      if (s && typeof s === 'object') {
        const r = s as Record<string, unknown>;
        if (typeof r.id === 'number' && typeof r.lokasi === 'string') {
          const sesiBaru: SesiBerjalan = {
            id: r.id,
            lokasi: r.lokasi,
            waktuMulai: typeof r.waktuMulai === 'string' ? r.waktuMulai : '',
            waktuSaldo: typeof r.waktuSaldo === 'string' ? r.waktuSaldo : null,
          };
          setSesi(sesiBaru);
          setBaris(bacaDraf(sesiBaru.id));
        }
      }
      setMemuat(false);
    })();
    return () => {
      dibatalkan = true;
    };
  }, []);

  // ---------- katalog lokal ----------
  React.useEffect(() => {
    let dibatalkan = false;
    void katalogSiap().then((siap) => {
      if (!dibatalkan) setKatalogAda(siap);
    });
    void segarkanKatalogLokal().then(() => {
      if (dibatalkan) return;
      void katalogSiap().then((siap) => setKatalogAda(siap));
    });
    return () => {
      dibatalkan = true;
    };
  }, []);

  React.useEffect(() => {
    if (!sesi || !katalogAda) return;
    let dibatalkan = false;
    const tunda = window.setTimeout(() => {
      void cariLokal(kataKunci).then((produk) => {
        if (!dibatalkan) setHasilCari(produk);
      });
    }, 150);
    return () => {
      dibatalkan = true;
      window.clearTimeout(tunda);
    };
  }, [kataKunci, katalogAda, sesi]);

  const simpanBaris = React.useCallback(
    (sesiId: number, berikutnya: BarisHitung[]) => {
      setBaris(berikutnya);
      simpanDraf(sesiId, berikutnya);
    },
    [],
  );

  // ---------- aksi ----------
  async function mulaiSesi(): Promise<void> {
    if (!lokasiPilihan || sibuk) return;
    setSibuk(true);
    setGalat(null);
    setHasil(null);
    const { status, data } = await panggil('/api/hitung', {
      method: 'POST',
      body: JSON.stringify({ aksi: 'mulai', lokasi: lokasiPilihan }),
    });
    setSibuk(false);
    if (status !== 200 || data?.ok !== true || typeof data.sesiId !== 'number') {
      setGalat(pesanDari(data, 'Sesi gagal dibuka. Coba lagi.'));
      return;
    }
    const sesiBaru: SesiBerjalan = {
      id: data.sesiId,
      lokasi: lokasiPilihan,
      waktuMulai: new Date().toISOString(),
      waktuSaldo: typeof data.waktuSaldo === 'string' ? data.waktuSaldo : null,
    };
    setSesi(sesiBaru);
    setBaris(bacaDraf(sesiBaru.id));
  }

  async function batalkanSesi(): Promise<void> {
    if (!sesi || sibuk) return;
    setSibuk(true);
    setGalat(null);
    const { status, data } = await panggil('/api/hitung', {
      method: 'POST',
      body: JSON.stringify({ aksi: 'batal', sesiId: sesi.id }),
    });
    setSibuk(false);
    if (status !== 200 || data?.ok !== true) {
      setGalat(pesanDari(data, 'Sesi gagal dibatalkan.'));
      return;
    }
    hapusDraf(sesi.id);
    setSesi(null);
    setBaris([]);
    setProdukTerpilih(null);
    setKataKunci('');
  }

  async function kirimHitungan(): Promise<void> {
    if (!sesi || sibuk || baris.length === 0) return;
    setSibuk(true);
    setGalat(null);
    setHasil(null);
    const { status, data } = await panggil('/api/hitung', {
      method: 'POST',
      body: JSON.stringify({
        aksi: 'kirim',
        sesiId: sesi.id,
        baris: baris.map((b) => ({
          productId: b.productId,
          qtyInput: b.qtyInput,
          satuanInput: b.satuanInput,
        })),
      }),
    });
    setSibuk(false);

    if (status !== 200 || data?.ok !== true) {
      // Sesi TIDAK ditutup dan draf TIDAK dihapus — kalau kiriman gagal separuh,
      // angka yang sudah dihitung staf adalah satu-satunya salinan yang ada.
      setGalat(pesanDari(data, 'Hitungan belum tersimpan. Coba kirim lagi.'));
      return;
    }

    const ditolak: { productId: string; pesan: string }[] = [];
    if (Array.isArray(data.ditolak)) {
      for (const item of data.ditolak) {
        if (typeof item !== 'object' || item === null) continue;
        const r = item as Record<string, unknown>;
        if (typeof r.productId === 'string' && typeof r.pesan === 'string') {
          ditolak.push({ productId: r.productId, pesan: r.pesan });
        }
      }
    }

    setHasil({
      diterapkan: typeof data.diterapkan === 'number' ? data.diterapkan : 0,
      takBerubah: typeof data.takBerubah === 'number' ? data.takBerubah : 0,
      ditinjau: typeof data.ditinjau === 'number' ? data.ditinjau : 0,
      ditolak,
    });

    hapusDraf(sesi.id);
    setSesi(null);
    // Baris yang ditolak dipertahankan di layar lewat `hasil`, bukan di daftar
    // hitungan — sesinya sudah ditutup server, jadi tidak bisa dikirim ulang.
    setBaris([]);
    setProdukTerpilih(null);
    setKataKunci('');
  }

  function pilihProduk(produk: ProdukRingkas): void {
    setProdukTerpilih(produk);
    const sudahAda = baris.find((b) => b.productId === produk.id);
    const satuanTerkecil = produk.satuan.reduce<{ nama: string; pengali: number } | null>(
      (kecil, s) => (kecil === null || s.pengali < kecil.pengali ? s : kecil),
      null,
    );
    setSatuanTerpilih(sudahAda?.satuanInput ?? satuanTerkecil?.nama ?? '');
    setJumlahTeks(sudahAda ? String(sudahAda.qtyInput) : '0');
  }

  function tambahBaris(): void {
    if (!sesi || !produkTerpilih) return;
    const jumlah = Number(jumlahTeks.replace(',', '.'));
    if (!Number.isFinite(jumlah) || jumlah < 0) {
      setGalat('Jumlah harus angka nol atau lebih.');
      return;
    }
    if (satuanTerpilih === '') {
      setGalat('Satuan wajib dipilih.');
      return;
    }
    const tanpaProduk = baris.filter((b) => b.productId !== produkTerpilih.id);
    if (tanpaProduk.length >= BATAS_BARIS) {
      setGalat(`Satu sesi maksimal ${BATAS_BARIS} barang. Kirim dulu yang sudah dihitung.`);
      return;
    }
    setGalat(null);
    simpanBaris(sesi.id, [
      ...tanpaProduk,
      {
        productId: produkTerpilih.id,
        nama: produkTerpilih.nama,
        satuanInput: satuanTerpilih,
        qtyInput: jumlah,
      },
    ]);
    setProdukTerpilih(null);
    setKataKunci('');
  }

  function hapusBaris(productId: string): void {
    if (!sesi) return;
    simpanBaris(
      sesi.id,
      baris.filter((b) => b.productId !== productId),
    );
  }

  function geserJumlah(delta: number): void {
    const sekarang = Number(jumlahTeks.replace(',', '.'));
    const dasar = Number.isFinite(sekarang) ? sekarang : 0;
    setJumlahTeks(String(Math.max(0, dasar + delta)));
  }

  // ---------- tampilan ----------
  if (memuat) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const lokasiSesi = sesi && isKodeLokasi(sesi.lokasi) ? LABEL_LOKASI[sesi.lokasi] : sesi?.lokasi;

  return (
    <div className="space-y-4">
      {galat !== null && (
        <Alert variant="destructive">
          <AlertDescription>{galat}</AlertDescription>
        </Alert>
      )}

      {hasil !== null && (
        <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-2">
          <div className="font-semibold text-stone-900">Hitungan terkirim</div>
          <ul className="text-sm text-stone-600 space-y-1 tabular-nums">
            <li>{formatNumber(hasil.diterapkan)} barang stoknya disesuaikan</li>
            <li>{formatNumber(hasil.takBerubah)} barang sudah cocok, tidak diubah</li>
            <li>{formatNumber(hasil.ditinjau)} barang ditahan untuk ditinjau</li>
          </ul>
          {hasil.ditinjau > 0 && (
            <p className="text-sm text-stone-600">
              Ada mutasi yang masuk saat kamu menghitung, jadi stoknya belum diubah.{' '}
              <Link href="/tinjau" className="font-semibold text-[#0f7a3e] underline">
                Buka halaman tinjau
              </Link>
              .
            </p>
          )}
          {hasil.ditolak.length > 0 && (
            <div className="text-sm text-stone-700">
              <div className="font-semibold">Ditolak, tidak ikut terkirim:</div>
              <ul className="mt-1 space-y-1">
                {hasil.ditolak.map((d) => (
                  <li key={d.productId}>
                    <span className="font-mono text-xs">{d.productId}</span> — {d.pesan}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {sesi === null ? (
        <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-4">
          <div>
            <div className="font-semibold text-stone-900">Mulai hitung stok</div>
            <p className="text-sm text-stone-500 mt-1">
              Satu sesi untuk satu lokasi. Angka sistem sengaja tidak ditampilkan saat
              menghitung supaya hasilnya benar-benar dari barang di rak.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Lokasi</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {LOKASI_NYATA.map((kode) => {
                const aktif = lokasiPilihan === kode;
                return (
                  <button
                    key={kode}
                    type="button"
                    onClick={() => setLokasiPilihan(kode)}
                    aria-pressed={aktif}
                    className={
                      aktif
                        ? 'h-14 rounded-xl border-2 border-[#0f7a3e] bg-[#0f7a3e]/5 px-4 text-left font-semibold text-[#0f7a3e]'
                        : 'h-14 rounded-xl border border-stone-300 bg-white px-4 text-left font-medium text-stone-700 hover:bg-stone-50'
                    }
                  >
                    {LABEL_LOKASI[kode]}
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            type="button"
            className="h-12 w-full"
            disabled={lokasiPilihan === null || sibuk}
            onClick={() => void mulaiSesi()}
          >
            {sibuk ? 'Membuka…' : 'Mulai Hitung'}
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-stone-500">
                  Sesi #{sesi.id}
                </div>
                <div className="text-lg font-semibold text-stone-900">{lokasiSesi}</div>
                <div className="text-xs text-stone-500 mt-1">
                  Dibuka {formatWaktuWIB(sesi.waktuMulai)}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                disabled={sibuk}
                onClick={() => void batalkanSesi()}
              >
                Batalkan sesi
              </Button>
            </div>
            {sesi.waktuSaldo === null && (
              <p className="mt-3 text-sm text-stone-600">
                Angka pembanding sesi ini sudah kedaluwarsa. Batalkan sesi lalu mulai lagi
                supaya hasilnya dibandingkan dengan stok terbaru.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="cari-hitung">Cari barang</Label>
              <Input
                id="cari-hitung"
                value={kataKunci}
                onChange={(e) => setKataKunci(e.target.value)}
                placeholder="Ketik nama barang…"
                autoComplete="off"
              />
              {!katalogAda && (
                <p className="text-xs text-stone-500">
                  Katalog belum tersalin ke HP ini. Sambungkan jaringan sebentar supaya
                  pencarian bisa jalan tanpa sinyal.
                </p>
              )}
            </div>

            {produkTerpilih === null ? (
              <ul className="divide-y divide-stone-200">
                {hasilCari.map((produk) => (
                  <li key={produk.id}>
                    <button
                      type="button"
                      onClick={() => pilihProduk(produk)}
                      className="flex w-full items-center justify-between gap-3 py-3 text-left"
                    >
                      <span>
                        <span className="block font-medium text-stone-900">{produk.nama}</span>
                        <span className="block font-mono text-xs text-stone-500">
                          {produk.id}
                        </span>
                      </span>
                      {baris.some((b) => b.productId === produk.id) && (
                        <span className="shrink-0 rounded-full bg-[#0f7a3e] px-2 py-0.5 text-xs font-semibold text-white">
                          sudah
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="space-y-3 rounded-lg bg-stone-50 p-3">
                <div>
                  <div className="font-medium text-stone-900">{produkTerpilih.nama}</div>
                  <div className="font-mono text-xs text-stone-500">{produkTerpilih.id}</div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="satuan-hitung">Satuan</Label>
                  <Select value={satuanTerpilih} onValueChange={setSatuanTerpilih}>
                    <SelectTrigger id="satuan-hitung">
                      <SelectValue placeholder="Pilih satuan" />
                    </SelectTrigger>
                    <SelectContent>
                      {produkTerpilih.satuan.map((s) => (
                        <SelectItem key={s.nama} value={s.nama}>
                          {s.nama}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jumlah-hitung">Jumlah dihitung</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 w-12 shrink-0 text-lg"
                      aria-label="Kurangi satu"
                      onClick={() => geserJumlah(-1)}
                    >
                      −
                    </Button>
                    <Input
                      id="jumlah-hitung"
                      value={jumlahTeks}
                      onChange={(e) => setJumlahTeks(e.target.value)}
                      inputMode="decimal"
                      className="h-12 text-center text-lg tabular-nums"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 w-12 shrink-0 text-lg"
                      aria-label="Tambah satu"
                      onClick={() => geserJumlah(1)}
                    >
                      +
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="button" className="h-12 flex-1" onClick={tambahBaris}>
                    Simpan hitungan
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12"
                    onClick={() => setProdukTerpilih(null)}
                  >
                    Batal
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
            <div className="font-semibold text-stone-900">
              Sudah dihitung ({formatNumber(baris.length)})
            </div>
            {baris.length === 0 ? (
              <p className="text-sm text-stone-500">
                Belum ada. Barang yang tidak kamu hitung stoknya tidak akan diubah.
              </p>
            ) : (
              <ul className="divide-y divide-stone-200">
                {baris.map((b) => (
                  <li key={b.productId} className="flex items-center justify-between gap-3 py-3">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-stone-900">{b.nama}</span>
                      <span className="block font-mono text-xs text-stone-500">{b.productId}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-semibold tabular-nums text-stone-900">
                        {formatNumber(b.qtyInput)}
                      </span>
                      <span className="block text-xs text-stone-500">{b.satuanInput}</span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      className="shrink-0 text-destructive"
                      onClick={() => hapusBaris(b.productId)}
                    >
                      Hapus
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Button
            type="button"
            className="h-14 w-full text-base"
            disabled={baris.length === 0 || sibuk}
            onClick={() => void kirimHitungan()}
          >
            {sibuk ? 'Mengirim…' : `Kirim ${formatNumber(baris.length)} barang`}
          </Button>
        </>
      )}
    </div>
  );
}
