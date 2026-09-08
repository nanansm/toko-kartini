'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { LembarQty } from '@/components/catat/lembar-qty';
import { type KodeLokasi, LABEL_LOKASI, LOKASI_NYATA, isKodeLokasi } from '@/lib/lokasi';
import { cariLokal, katalogSiap, segarkanKatalogLokal, type ProdukRingkas } from '@/lib/katalog-lokal';
import { formatNumber, formatWaktuWIB } from '@/lib/format';

interface BarisHitung {
  productId: string;
  nama: string;
  satuanInput: string;
  qtyInput: number;
  // Rincian qty per satuan dari LembarQty, mis. {"Krtn (12 Pcs)": 3, "Pcs": 1}.
  // WAJIB opsional: draf LAMA di localStorage HP staf (sebelum lembar ini ada)
  // tidak punya field ini, dan sesi hitung bisa berjalan berhari-hari — draf
  // lama tidak boleh ditolak cuma karena field baru belum ada.
  qtySatuan?: Record<string, number>;
  // Siapa yang menghitung baris ini. Semua baris yang KITA BUAT di berkas ini
  // selalu milik pemakai sendiri — satu sesi di /api/hitung terkunci ke satu
  // username (lihat handleMulai), jadi field ini sengaja dibiarkan kosong
  // saat menambah baris baru. Tetap disiapkan di sini supaya penanda "sudah
  // dihitung rekan" di hasil cari langsung punya data dipakai tanpa mengubah
  // bentuk BarisHitung lagi kalau nanti baris rekan pernah ikut termuat.
  pengguna?: string;
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

// Draf lama (sebelum qtySatuan ada) tidak punya field ini sama sekali —
// undefined di sini artinya "baris lama", bukan "rusak".
function bacaQtySatuan(v: unknown): Record<string, number> | undefined {
  if (typeof v !== 'object' || v === null) return undefined;
  const hasil: Record<string, number> = {};
  for (const [nama, n] of Object.entries(v as Record<string, unknown>)) {
    if (typeof n === 'number' && Number.isFinite(n)) hasil[nama] = n;
  }
  return Object.keys(hasil).length > 0 ? hasil : undefined;
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
          qtySatuan: bacaQtySatuan(r.qtySatuan),
          pengguna: typeof r.pengguna === 'string' ? r.pengguna : undefined,
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

const KUNCI_RAK_TERAKHIR = 'kartini-rak-terakhir';

// Lokasi terakhir yang dipilih staf, supaya sesi berikutnya tidak mulai dari
// kosong lagi. Dibungkus try/catch: di peramban yang memblokir penyimpanan
// situs (mode privat ketat dll), akses localStorage MELEMPAR — dan gagal
// mengingat rak terakhir bukan alasan buat mematikan seluruh halaman.
function bacaRakTerakhir(): KodeLokasi | null {
  try {
    const v = window.localStorage.getItem(KUNCI_RAK_TERAKHIR);
    if (v !== null && isKodeLokasi(v) && LOKASI_NYATA.includes(v)) return v;
    return null;
  } catch {
    return null;
  }
}

function simpanRakTerakhir(kode: KodeLokasi): void {
  try {
    window.localStorage.setItem(KUNCI_RAK_TERAKHIR, kode);
  } catch {
    // gagal mengingat bukan galat fatal — staf cuma memilih ulang manual
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

// Urutan Object.entries mengikuti urutan penulisan LembarQty.simpan() (besar
// ke kecil), jadi rincian tampil "3 Krtn (12 Pcs) + 1 Pcs", bukan acak.
function rincianQtySatuan(qtySatuan: Record<string, number>): string {
  return Object.entries(qtySatuan)
    .map(([nama, qty]) => `${formatNumber(qty)} ${nama}`)
    .join(' + ');
}

export function FormHitung(): React.JSX.Element {
  const [memuat, setMemuat] = React.useState(true);
  const [sesi, setSesi] = React.useState<SesiBerjalan | null>(null);
  const [baris, setBaris] = React.useState<BarisHitung[]>([]);
  const [galat, setGalat] = React.useState<string | null>(null);
  const [sibuk, setSibuk] = React.useState(false);
  const [hasil, setHasil] = React.useState<HasilKirim | null>(null);
  const [pesanSukses, setPesanSukses] = React.useState<string | null>(null);
  // Default true supaya render pertama (termasuk SSR) tidak menampilkan
  // peringatan "menunggu sinyal" secara keliru — status jaringan sungguhan
  // baru dibaca lewat effect di bawah, setelah komponen sudah di peramban.
  const [online, setOnline] = React.useState(true);

  const [lokasiPilihan, setLokasiPilihan] = React.useState<KodeLokasi | null>(null);

  const [katalogAda, setKatalogAda] = React.useState(false);
  const [kataKunci, setKataKunci] = React.useState('');
  const [hasilCari, setHasilCari] = React.useState<ProdukRingkas[]>([]);
  const [produkTerpilih, setProdukTerpilih] = React.useState<ProdukRingkas | null>(null);

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

  // ---------- lokasi terakhir & status sinyal ----------
  React.useEffect(() => {
    const rak = bacaRakTerakhir();
    if (rak) setLokasiPilihan(rak);
  }, []);

  React.useEffect(() => {
    setOnline(window.navigator.onLine);
    const tandai = () => setOnline(window.navigator.onLine);
    window.addEventListener('online', tandai);
    window.addEventListener('offline', tandai);
    return () => {
      window.removeEventListener('online', tandai);
      window.removeEventListener('offline', tandai);
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
    setPesanSukses(null);
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

  // "Ganti rak" secara teknis SAMA dengan batalkan sesi: satu sesi di server
  // terkunci ke satu lokasi (lihat handleMulai di app/api/hitung/route.ts),
  // jadi pindah rak wajib menutup sesi lama dulu sebelum memilih lokasi baru.
  // Namanya sengaja dipisah dari "Batalkan sesi" supaya niat staf yang
  // menekannya jelas dari labelnya.
  async function gantiRak(): Promise<void> {
    await batalkanSesi();
  }

  async function kirimHitungan(): Promise<void> {
    if (!sesi || sibuk || baris.length === 0) return;
    if (!online) {
      // Mengunggah separuh isi rak membuat rak itu terlihat selesai padahal
      // belum, dan sisanya tidak akan pernah punya kesempatan naik — jadi
      // kiriman ditolak total selama sinyal belum ada, bukan dikirim sebagian.
      setGalat(
        `Masih ada ${formatNumber(baris.length)} hitungan menunggu sinyal — upload ditunda.`,
      );
      return;
    }
    const jumlahDikirim = baris.length;
    setSibuk(true);
    setGalat(null);
    setHasil(null);
    setPesanSukses(null);
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

    setPesanSukses(`${formatNumber(jumlahDikirim)} entri tersinkron ke pusat ✓`);
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
  }

  // Barang lama dari katalog lokal bisa lenyap (dihapus/diganti id) sebelum
  // stafnya kembali membuka baris ini — cariLokal dengan kata kunci id
  // persis dipakai supaya kita dapat data satuan yang masih berlaku.
  async function bukaKembali(productId: string): Promise<void> {
    const hasil = await cariLokal(productId, 50);
    const produk = hasil.find((p) => p.id === productId);
    if (!produk) {
      setGalat('Barang ini tidak ada lagi di katalog lokal, jadi tidak bisa dibuka ulang.');
      return;
    }
    setGalat(null);
    pilihProduk(produk);
  }

  function simpanLembarQty(qtySatuan: Record<string, number>, totalPokok: number): void {
    if (!sesi || !produkTerpilih) return;
    const tanpaProduk = baris.filter((b) => b.productId !== produkTerpilih.id);
    if (tanpaProduk.length >= BATAS_BARIS) {
      setGalat(`Satu sesi maksimal ${BATAS_BARIS} barang. Kirim dulu yang sudah dihitung.`);
      return;
    }
    // OPNAME adalah angka mutlak per produk × lokasi, jadi tidak boleh dipecah
    // jadi beberapa baris seperti layar Catat — dua baris untuk produk yang
    // sama akan saling menimpa di server. Karena itu baris lama diGANTI di
    // atas (tanpaProduk), bukan ditambah.
    //
    // satuanInput dikirim sebagai satuan dengan pengali TERKECIL milik
    // produk ini. Pengali satuan terkecil selalu 1, jadi mengirim totalPokok
    // (sudah dalam satuan terkecil) di satuan itu membuat konversi di server
    // menghasilkan angka yang sama persis — server tetap menerima bentuk
    // satuanInput + qtyInput seperti sekarang, tidak ada yang berubah di sana.
    const satuanTerkecil = produkTerpilih.satuan.reduce<{ nama: string; pengali: number } | null>(
      (kecil, s) => (kecil === null || s.pengali < kecil.pengali ? s : kecil),
      null,
    );
    setGalat(null);
    simpanBaris(sesi.id, [
      ...tanpaProduk,
      {
        productId: produkTerpilih.id,
        nama: produkTerpilih.nama,
        satuanInput: satuanTerkecil?.nama ?? produkTerpilih.satuan[0]?.nama ?? '',
        qtyInput: totalPokok,
        qtySatuan,
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

  // Nilai awal LembarQty: kalau baris lama sudah punya qtySatuan pakai apa
  // adanya; kalau draf LAMA (belum punya qtySatuan), bentuk dari
  // satuanInput+qtyInput supaya baris itu tetap bisa dibuka dan diperbaiki.
  const barisAktif = produkTerpilih
    ? baris.find((b) => b.productId === produkTerpilih.id)
    : undefined;
  const nilaiAwalLembar = barisAktif
    ? (barisAktif.qtySatuan ?? { [barisAktif.satuanInput]: barisAktif.qtyInput })
    : undefined;

  // Kiriman tidak boleh jalan separuh saat sinyal putus — lihat guard yang
  // sama di kirimHitungan().
  const menungguSinyal = !online && baris.length > 0;

  return (
    <div className="space-y-4">
      {galat !== null && (
        <Alert variant="destructive">
          <AlertDescription>{galat}</AlertDescription>
        </Alert>
      )}

      {pesanSukses !== null && (
        <Alert className="border-[#0f7a3e]/30 bg-[#0f7a3e]/5">
          <AlertDescription className="text-[#0f7a3e] font-medium">{pesanSukses}</AlertDescription>
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
                    onClick={() => {
                      setLokasiPilihan(kode);
                      simpanRakTerakhir(kode);
                    }}
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
            {sibuk ? 'Membuka…' : 'Mulai Hitung →'}
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
              <div className="flex flex-col items-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive"
                  disabled={sibuk}
                  onClick={() => void batalkanSesi()}
                >
                  Batalkan sesi
                </Button>
                {/* Kecil & terpisah dari alur utama, BUKAN dropdown — mengganti
                    rak di tengah hitungan mudah bikin barang tercatat di rak
                    yang salah kalau tombolnya gampang tersenggol tak sengaja. */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-stone-500"
                  disabled={sibuk}
                  onClick={() => void gantiRak()}
                >
                  Ganti rak
                </Button>
              </div>
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
                placeholder="Cari produk…"
                autoComplete="off"
              />
              {!katalogAda && (
                <p className="text-xs text-stone-500">
                  Katalog belum tersalin ke HP ini. Sambungkan jaringan sebentar supaya
                  pencarian bisa jalan tanpa sinyal.
                </p>
              )}
            </div>

            <ul className="divide-y divide-stone-200">
              {hasilCari.map((produk) => {
                const sudah = baris.find((b) => b.productId === produk.id);
                return (
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
                        {/* Tanpa penanda ini, dua orang yang menghitung rak yang
                            sama saling menimpa pekerjaan tanpa sadar — sudah
                            siapa dan berapa harus kelihatan sebelum diketik ulang. */}
                        {sudah && (
                          <span className="block text-xs text-[#0f7a3e] mt-0.5">
                            {sudah.pengguna
                              ? `sudah dihitung ${sudah.pengguna}: `
                              : 'sudah dihitung: '}
                            {formatNumber(sudah.qtyInput)}{' '}
                            {sudah.qtySatuan ? rincianQtySatuan(sudah.qtySatuan) : sudah.satuanInput}
                          </span>
                        )}
                      </span>
                      {sudah && (
                        <span className="shrink-0 rounded-full bg-[#0f7a3e] px-2 py-0.5 text-xs font-semibold text-white">
                          sudah
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <LembarQty
            terbuka={produkTerpilih !== null}
            namaProduk={produkTerpilih?.nama ?? ''}
            satuan={produkTerpilih?.satuan ?? []}
            nilaiAwal={nilaiAwalLembar}
            onSimpan={simpanLembarQty}
            onBatal={() => setProdukTerpilih(null)}
          />

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
                    <button
                      type="button"
                      onClick={() => void bukaKembali(b.productId)}
                      className="flex min-h-12 min-w-0 flex-1 items-center justify-between gap-3 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-stone-900">{b.nama}</span>
                        <span className="block font-mono text-xs text-stone-500">
                          {b.productId}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-semibold tabular-nums text-stone-900">
                          {formatNumber(b.qtyInput)}
                        </span>
                        <span className="block text-xs text-stone-500">
                          {b.qtySatuan ? rincianQtySatuan(b.qtySatuan) : b.satuanInput}
                        </span>
                      </span>
                    </button>
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

          {menungguSinyal ? (
            <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
              Masih ada {formatNumber(baris.length)} hitungan menunggu sinyal — upload ditunda.
            </p>
          ) : (
            <Button
              type="button"
              className="h-14 w-full text-base"
              disabled={baris.length === 0 || sibuk}
              onClick={() => void kirimHitungan()}
            >
              {sibuk ? 'Mengirim…' : `Upload ${formatNumber(baris.length)} entri`}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
