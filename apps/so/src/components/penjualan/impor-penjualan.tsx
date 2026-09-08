'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { formatRupiah, formatNumber } from '@/lib/format';
import { parsePenjualan, type BarisPos, type RingkasPos } from '@/lib/penjualan/xlsx';

const PESAN_JARINGAN = 'Tidak bisa menghubungi server. Periksa sinyal, lalu coba lagi.';

type Tab = 'Penjualan' | 'Penjualan Uji';

type Langkah = 'pilih' | 'pratinjau' | 'selesai';

// Bentuk balasan pencocokan dari POST /api/penjualan (konfirmasi:false/true).
interface RingkasSusun {
  baris: number;
  cocok: number;
  tanpaSku: number;
  skuAsing: number;
  omzetCocok: number;
  omzetGagal: number;
  piutang: number;
}

interface BalasanImporSukses {
  ok: true;
  ditulis: boolean;
  tab: string;
  ringkas: RingkasSusun;
}

interface BalasanImporGagal {
  ok: false;
  pesan: string;
}

// Uraikan balasan fetch dengan hati-hati: cek status dulu, dan JANGAN percaya
// begitu isinya bukan JSON — sesi kedaluwarsa bisa membalas 302/HTML, dan itu
// harus dihitung gagal, bukan sukses diam-diam.
async function baca(res: Response): Promise<BalasanImporSukses | BalasanImporGagal> {
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, pesan: PESAN_JARINGAN };
  }
  if (typeof data !== 'object' || data === null) {
    return { ok: false, pesan: PESAN_JARINGAN };
  }
  const r = data as Record<string, unknown>;
  if (res.ok && r.ok === true && typeof r.tab === 'string' && typeof r.ditulis === 'boolean') {
    return { ok: true, ditulis: r.ditulis, tab: r.tab, ringkas: r.ringkas as RingkasSusun };
  }
  const pesan = typeof r.pesan === 'string' ? r.pesan : PESAN_JARINGAN;
  return { ok: false, pesan };
}

// Badan API tidak menerima `order_no` maupun `cara_bayar` — dua field itu
// dibuang di sini, bukan di server.
function keBadan(baris: BarisPos[]) {
  return baris.map((b) => ({
    tanggal: b.tanggal,
    sku: b.sku,
    produk: b.produk,
    qty: b.qty,
    omzet: b.omzet,
    lunas: b.lunas,
    pelanggan: b.pelanggan,
  }));
}

export function ImporPenjualan() {
  const [langkah, setLangkah] = React.useState<Langkah>('pilih');
  const [sibuk, setSibuk] = React.useState(false);
  const [errorPilih, setErrorPilih] = React.useState<string | null>(null);
  const [errorPratinjau, setErrorPratinjau] = React.useState<string | null>(null);

  const [hasil, setHasil] = React.useState<{ baris: BarisPos[]; ringkas: RingkasPos } | null>(null);
  const [tab, setTab] = React.useState<Tab>('Penjualan');
  const [ringkasSusun, setRingkasSusun] = React.useState<RingkasSusun | null>(null);
  const [ditulis, setDitulis] = React.useState<{ baris: number; tab: string } | null>(null);

  const inputRef = React.useRef<HTMLInputElement>(null);

  // Minta pratinjau pencocokan (konfirmasi:false) tiap kali tab tujuan berganti,
  // supaya angka cocok/asing yang ditampilkan selalu untuk tab yang dipilih.
  const ambilPratinjau = React.useCallback(async (baris: BarisPos[], tujuan: Tab) => {
    setSibuk(true);
    setErrorPratinjau(null);
    try {
      const res = await fetch('/api/penjualan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ baris: keBadan(baris), tab: tujuan, konfirmasi: false }),
      });
      const balasan = await baca(res);
      if (!balasan.ok) {
        setErrorPratinjau(balasan.pesan);
        return;
      }
      setRingkasSusun(balasan.ringkas);
    } catch {
      setErrorPratinjau(PESAN_JARINGAN);
    } finally {
      setSibuk(false);
    }
  }, []);

  async function handlePilihBerkas(e: React.ChangeEvent<HTMLInputElement>) {
    const berkas = e.target.files?.[0];
    if (!berkas) return;
    setErrorPilih(null);
    setSibuk(true);
    try {
      const buf = await berkas.arrayBuffer();
      // Diurai di peramban, bukan dikirim mentah: export POS ini punya ~69
      // kolom termasuk email karyawan, nomor HP + alamat pelanggan, HPP,
      // profit, dan komisi. Cuma 9 kolom yang dipakai hitungan stok yang
      // boleh berangkat ke server.
      const dibaca = parsePenjualan(buf);
      setHasil(dibaca);
      setLangkah('pratinjau');
      await ambilPratinjau(dibaca.baris, tab);
    } catch (err) {
      setErrorPilih(err instanceof Error ? err.message : PESAN_JARINGAN);
    } finally {
      setSibuk(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function pilihTab(t: Tab) {
    if (sibuk || t === tab) return;
    setTab(t);
    if (hasil) void ambilPratinjau(hasil.baris, t);
  }

  function gantiBerkas() {
    setLangkah('pilih');
    setHasil(null);
    setRingkasSusun(null);
    setErrorPilih(null);
    setErrorPratinjau(null);
  }

  async function konfirmasiImpor() {
    if (!hasil || sibuk) return;
    setSibuk(true);
    setErrorPratinjau(null);
    try {
      const res = await fetch('/api/penjualan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ baris: keBadan(hasil.baris), tab, konfirmasi: true }),
      });
      const balasan = await baca(res);
      if (!balasan.ok) {
        setErrorPratinjau(balasan.pesan);
        return;
      }
      setDitulis({ baris: balasan.ringkas.baris, tab: balasan.tab });
      setLangkah('selesai');
    } catch {
      setErrorPratinjau(PESAN_JARINGAN);
    } finally {
      setSibuk(false);
    }
  }

  function imporLagi() {
    setLangkah('pilih');
    setHasil(null);
    setRingkasSusun(null);
    setDitulis(null);
    setErrorPilih(null);
    setErrorPratinjau(null);
  }

  return (
    <div className="space-y-6">
      {langkah === 'pilih' && (
        <Card>
          <CardHeader>
            <CardTitle>Impor Penjualan dari POS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="berkas-pos">Berkas export POS (.xlsx)</Label>
              <Input
                id="berkas-pos"
                ref={inputRef}
                type="file"
                accept=".xlsx"
                disabled={sibuk}
                onChange={(e) => void handlePilihBerkas(e)}
              />
              <p className="text-sm text-muted-foreground">
                Export &quot;Item Penjualan berdasarkan Tanggal&quot; dari POS. Dibaca langsung di
                HP ini — kolom yang tidak dipakai hitungan stok tidak ikut terkirim.
              </p>
            </div>

            {errorPilih && (
              <Alert variant="destructive">
                <AlertDescription>{errorPilih}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {langkah === 'pratinjau' && hasil && (
        <Card>
          <CardHeader>
            <CardTitle>Pratinjau Impor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>
                <p>
                  Impor ini MENGGANTI SELURUH isi tab {tab}, bukan menambah. Baris yang tidak ada
                  di berkas ini akan hilang dari tab.
                </p>
                <p>
                  Sesudah impor lewat sini, <code>import_penjualan.py</code> milik tim JANGAN
                  dijalankan lagi — skrip itu menulis ulang tab Penjualan dari Supabase, dan
                  Supabase tidak ikut terisi oleh impor ini, jadi hasilnya akan menimpa balik
                  dengan data lama.
                </p>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <p className="text-sm font-medium">Isi berkas</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  Rentang tanggal: {hasil.ringkas.tanggalAwal || '-'} s/d{' '}
                  {hasil.ringkas.tanggalAkhir || '-'}
                </div>
                <div>
                  Baris dipakai: {formatNumber(hasil.ringkas.dipakai)} / {formatNumber(hasil.ringkas.total)}
                </div>
                <div>Tanpa tanggal: {formatNumber(hasil.ringkas.tanpaTanggal)}</div>
                <div>Tanpa SKU: {formatNumber(hasil.ringkas.tanpaSku)}</div>
                <div>Omzet: {formatRupiah(hasil.ringkas.omzet)}</div>
                <div>Piutang: {formatRupiah(hasil.ringkas.piutang)}</div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-sm font-medium">Tab tujuan</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={tab === 'Penjualan' ? 'default' : 'outline'}
                  disabled={sibuk}
                  onClick={() => pilihTab('Penjualan')}
                >
                  Penjualan
                </Button>
                <Button
                  type="button"
                  variant={tab === 'Penjualan Uji' ? 'default' : 'outline'}
                  disabled={sibuk}
                  onClick={() => pilihTab('Penjualan Uji')}
                >
                  Penjualan Uji
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                &quot;Penjualan Uji&quot; dipakai kalau cuma mau membandingkan hasil tanpa
                menyentuh angka yang sedang dipakai.
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-sm font-medium">Pencocokan ke master katalog</p>
              {ringkasSusun ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Cocok: {formatNumber(ringkasSusun.cocok)}</div>
                  <div>Tanpa SKU: {formatNumber(ringkasSusun.tanpaSku)}</div>
                  <div>SKU asing: {formatNumber(ringkasSusun.skuAsing)}</div>
                  <div>Omzet cocok: {formatRupiah(ringkasSusun.omzetCocok)}</div>
                  <div>Omzet gagal: {formatRupiah(ringkasSusun.omzetGagal)}</div>
                  <div>Piutang: {formatRupiah(ringkasSusun.piutang)}</div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {sibuk ? 'Memuat pencocokan...' : '-'}
                </p>
              )}
            </div>

            {errorPratinjau && (
              <Alert variant="destructive">
                <AlertDescription>{errorPratinjau}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={sibuk} onClick={gantiBerkas}>
                Ganti berkas
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="flex-1"
                disabled={sibuk}
                onClick={() => void konfirmasiImpor()}
              >
                {sibuk ? 'Memproses...' : `Ganti isi tab ${tab}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {langkah === 'selesai' && ditulis && (
        <Card>
          <CardHeader>
            <CardTitle>Impor Selesai</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                {formatNumber(ditulis.baris)} baris ditulis ke tab {ditulis.tab}.
              </AlertDescription>
            </Alert>
            <Button type="button" onClick={imporLagi}>
              Impor berkas lain
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
