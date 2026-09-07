'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type KodeLokasi, LABEL_LOKASI } from '@/lib/lokasi';
import {
  type JenisMutasi,
  type SebabRusak,
  type MasukanMutasi,
  LABEL_JENIS,
  LABEL_SEBAB,
  ARAH_SAH,
} from '@/lib/mutasi';
import { cariLokal, katalogSiap, segarkanKatalogLokal, type ProdukRingkas } from '@/lib/katalog-lokal';
import { ambilSemua, tambahAntre, type ItemAntre, type StatusAntre } from '@/lib/antrean';
import { type KeadaanKirim, langgananKirim, mulaiPengirim, picuKirim } from '@/lib/pengirim';

// Opname (hitung stok) punya jalur sendiri yang belum dibangun — jangan ditampilkan di sini.
type TabJenis = Exclude<JenisMutasi, 'OPNAME'>;
const TAB_JENIS: readonly TabJenis[] = ['DATANG', 'ISI_DISPLAY', 'PINDAH', 'RUSAK'];

function isTabJenis(nilai: string): nilai is TabJenis {
  return (TAB_JENIS as readonly string[]).includes(nilai);
}

const LABEL_STATUS_ANTRE: Record<StatusAntre, string> = {
  terkirim: 'Tersimpan',
  menunggu: 'Menunggu',
  gagal: 'Gagal',
};

// Badge bawaan cuma punya default/secondary/destructive/outline — tak ada hijau/kuning,
// jadi warna status ditimpa lewat className di atas variant "outline".
const KELAS_STATUS_ANTRE: Record<StatusAntre, string> = {
  terkirim: 'border-transparent bg-green-600 text-white',
  menunggu: 'border-transparent bg-yellow-500 text-black',
  gagal: 'border-transparent bg-destructive text-white',
};

export function FormCatat(): React.JSX.Element {
  const [jenis, setJenis] = React.useState<TabJenis>('DATANG');

  const [katalogAda, setKatalogAda] = React.useState(false);
  const [kataKunci, setKataKunci] = React.useState('');
  const [hasilCari, setHasilCari] = React.useState<ProdukRingkas[]>([]);
  const [mencari, setMencari] = React.useState(false);
  const [errorCari, setErrorCari] = React.useState<string | null>(null);
  const [produkTerpilih, setProdukTerpilih] = React.useState<ProdukRingkas | null>(null);

  const arahSah = ARAH_SAH[jenis];
  const asalLocked = arahSah.dari.length === 1;
  const tujuanLocked = arahSah.ke.length === 1;

  const [dari, setDari] = React.useState<KodeLokasi | null>(
    arahSah.dari.length === 1 ? (arahSah.dari[0] ?? null) : null,
  );
  const [ke, setKe] = React.useState<KodeLokasi | null>(
    arahSah.ke.length === 1 ? (arahSah.ke[0] ?? null) : null,
  );

  const [satuanTerpilih, setSatuanTerpilih] = React.useState('');
  const [jumlah, setJumlah] = React.useState(1);
  const [sebab, setSebab] = React.useState<SebabRusak | ''>('');
  const [catatan, setCatatan] = React.useState('');

  const [errorSimpan, setErrorSimpan] = React.useState<string | null>(null);
  const [daftar, setDaftar] = React.useState<ItemAntre[]>([]);
  const [keadaan, setKeadaan] = React.useState<KeadaanKirim>({
    daring: true,
    menunggu: 0,
    sibuk: false,
    sesiHabis: false,
    terakhirGalat: null,
  });

  const muatUlangDaftar = React.useCallback(async () => {
    setDaftar(await ambilSemua());
  }, []);

  // Pengirim jalan di latar belakang selama formulir dipasang — bukan cuma
  // saat tombol Simpan ditekan, supaya antrean lama juga ikut tercicil.
  React.useEffect(() => {
    const berhentiPengirim = mulaiPengirim();
    const berhentiLanggan = langgananKirim((k) => {
      setKeadaan(k);
      void muatUlangDaftar();
    });
    void muatUlangDaftar();
    return () => {
      berhentiLanggan();
      berhentiPengirim();
    };
  }, [muatUlangDaftar]);

  // Katalog disegarkan di latar belakang — formulir tidak menunggunya supaya
  // tetap bisa dipakai walau sinyal Gudang Ciherang lagi jelek.
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

  const opsiTujuan =
    jenis === 'PINDAH' ? arahSah.ke.filter((k) => k !== dari) : arahSah.ke;

  function gantiTab(nilai: string): void {
    if (!isTabJenis(nilai)) return;
    const arahBaru = ARAH_SAH[nilai];
    setJenis(nilai);
    setKataKunci('');
    setHasilCari([]);
    setErrorCari(null);
    setProdukTerpilih(null);
    setSatuanTerpilih('');
    setJumlah(1);
    setSebab('');
    setCatatan('');
    setDari(arahBaru.dari.length === 1 ? (arahBaru.dari[0] ?? null) : null);
    setKe(arahBaru.ke.length === 1 ? (arahBaru.ke[0] ?? null) : null);
  }

  React.useEffect(() => {
    if (produkTerpilih) return; // sudah pilih barang, tak perlu cari lagi
    const kata = kataKunci.trim();
    if (kata === '') {
      setHasilCari([]);
      setErrorCari(null);
      setMencari(false);
      return;
    }
    if (!katalogAda) {
      setErrorCari('Barang belum bisa dicari. Buka aplikasi ini sekali saat ada sinyal.');
      setHasilCari([]);
      return;
    }
    const timer = setTimeout(() => {
      setMencari(true);
      cariLokal(kata, 20)
        .then((hasil) => {
          setErrorCari(null);
          setHasilCari(hasil);
        })
        .finally(() => setMencari(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [kataKunci, produkTerpilih, katalogAda]);

  function pilihProduk(p: ProdukRingkas): void {
    setProdukTerpilih(p);
    setHasilCari([]);
    const urut = [...p.satuan].sort((a, b) => b.pengali - a.pengali);
    setSatuanTerpilih(urut[0]?.nama ?? '');
  }

  function gantiProduk(): void {
    setProdukTerpilih(null);
    setKataKunci('');
    setHasilCari([]);
    setSatuanTerpilih('');
  }

  const satuanUrut = produkTerpilih
    ? [...produkTerpilih.satuan].sort((a, b) => b.pengali - a.pengali)
    : [];

  const jumlahSah = Number.isFinite(jumlah) && jumlah >= 1;
  const bisaSimpan =
    produkTerpilih !== null &&
    dari !== null &&
    ke !== null &&
    satuanTerpilih !== '' &&
    jumlahSah &&
    (jenis !== 'RUSAK' || sebab !== '') &&
    (jenis !== 'PINDAH' || dari !== ke);

  async function simpan(): Promise<void> {
    if (!bisaSimpan || !produkTerpilih || dari === null || ke === null) return;

    // clientId baru tiap simpan — pengiriman ulang & dedup jadi urusan
    // antrean/pengirim, bukan komponen ini.
    const clientId = crypto.randomUUID();
    const muatan: MasukanMutasi = {
      clientId,
      jenis,
      productId: produkTerpilih.id,
      namaSaatItu: produkTerpilih.nama,
      satuanInput: satuanTerpilih,
      qtyInput: jumlah,
      dari,
      ke,
      sebab: jenis === 'RUSAK' ? sebab : null,
      catatan: catatan.trim() === '' ? null : catatan.trim(),
    };

    const item = await tambahAntre(muatan);
    if (!item) {
      // IndexedDB tak tersedia — jangan pura-pura tersimpan.
      setErrorSimpan('Gagal menyimpan di HP ini. Coba lagi.');
      return;
    }

    setErrorSimpan(null);
    setJumlah(1);
    setSebab('');
    setCatatan('');
    await muatUlangDaftar();
    picuKirim();
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      {(keadaan.daring === false || keadaan.menunggu > 0) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {keadaan.daring === false && (
            <Badge variant="secondary">Luring — catatan disimpan di HP</Badge>
          )}
          {keadaan.menunggu > 0 && (
            <span className="text-xs text-muted-foreground">{keadaan.menunggu} menunggu terkirim</span>
          )}
        </div>
      )}
      {keadaan.sesiHabis && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          Sesi berakhir. Masuk lagi supaya catatan terkirim.{' '}
          <a href="/masuk" className="font-semibold underline">
            Masuk
          </a>
        </div>
      )}

      <Tabs value={jenis} onValueChange={gantiTab}>
        <TabsList className="grid w-full grid-cols-4">
          {TAB_JENIS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {LABEL_JENIS[t]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="space-y-2">
        <Label>Barang</Label>
        {produkTerpilih ? (
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="font-semibold">{produkTerpilih.nama}</div>
              <div className="text-xs text-muted-foreground">
                {produkTerpilih.id} · {produkTerpilih.kategori}
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={gantiProduk}>
              Ganti
            </Button>
          </div>
        ) : (
          <>
            <Input
              placeholder="Ketik nama barang..."
              value={kataKunci}
              onChange={(e) => setKataKunci(e.target.value)}
            />
            {mencari && <div className="text-xs text-muted-foreground">Mencari...</div>}
            {errorCari && <div className="text-xs text-destructive">{errorCari}</div>}
            {!errorCari && hasilCari.length > 0 && (
              <div className="flex flex-col divide-y divide-border rounded-md border border-border">
                {hasilCari.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="p-3 text-left hover:bg-accent"
                    onClick={() => pilihProduk(p)}
                  >
                    <div className="font-semibold">{p.nama}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.id} · {p.kategori}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Asal</Label>
          {asalLocked ? (
            <Badge variant="secondary">
              {dari ? LABEL_LOKASI[dari] : '-'} (terkunci)
            </Badge>
          ) : (
            <Select
              value={dari ?? undefined}
              onValueChange={(v) => {
                const nilai = v as KodeLokasi;
                setDari(nilai);
                // Tujuan yang sudah dipilih bisa jadi sama dgn asal baru — batalkan.
                setKe((prev) => (jenis === 'PINDAH' && prev === nilai ? null : prev));
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih asal" />
              </SelectTrigger>
              <SelectContent>
                {arahSah.dari.map((k) => (
                  <SelectItem key={k} value={k}>
                    {LABEL_LOKASI[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <Label>Tujuan</Label>
          {tujuanLocked ? (
            <Badge variant="secondary">{ke ? LABEL_LOKASI[ke] : '-'} (terkunci)</Badge>
          ) : (
            <Select value={ke ?? undefined} onValueChange={(v) => setKe(v as KodeLokasi)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih tujuan" />
              </SelectTrigger>
              <SelectContent>
                {opsiTujuan.map((k) => (
                  <SelectItem key={k} value={k}>
                    {LABEL_LOKASI[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {produkTerpilih && (
        <div className="space-y-2">
          <Label>Satuan</Label>
          <div className="flex flex-wrap gap-2">
            {satuanUrut.map((s) => (
              <Button
                key={s.nama}
                type="button"
                variant={satuanTerpilih === s.nama ? 'default' : 'outline'}
                onClick={() => setSatuanTerpilih(s.nama)}
              >
                {s.nama}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Jumlah</Label>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-14 w-14 shrink-0 text-2xl"
            disabled={jumlah <= 1}
            onClick={() => setJumlah((j) => Math.max(1, j - 1))}
          >
            −
          </Button>
          <div className="flex-1 text-center text-3xl font-bold tabular-nums">{jumlah}</div>
          <Button
            type="button"
            variant="outline"
            className="h-14 w-14 shrink-0 text-2xl"
            onClick={() => setJumlah((j) => j + 1)}
          >
            +
          </Button>
        </div>
        <Input
          type="number"
          min={1}
          value={jumlah}
          onChange={(e) => {
            const n = Number(e.target.value);
            setJumlah(Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1);
          }}
          className="mx-auto w-24 text-center"
        />
      </div>

      {jenis === 'RUSAK' && (
        <div className="space-y-2">
          <Label>Sebab</Label>
          <Select value={sebab} onValueChange={(v) => setSebab(v as SebabRusak)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pilih sebab" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(LABEL_SEBAB) as SebabRusak[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {LABEL_SEBAB[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label>Catatan (opsional)</Label>
        <Input value={catatan} onChange={(e) => setCatatan(e.target.value)} />
      </div>

      {errorSimpan && <div className="text-sm text-destructive">{errorSimpan}</div>}

      <div className="sticky bottom-0 -mx-4 border-t border-border bg-background p-4">
        <Button className="h-12 w-full text-base" disabled={!bisaSimpan} onClick={simpan}>
          Simpan
        </Button>
      </div>

      {daftar.length > 0 && (
        <div className="space-y-2">
          <Label>Tercatat sesi ini</Label>
          <div className="flex flex-col divide-y divide-border rounded-md border border-border">
            {daftar.slice(0, 30).map((it) => (
              <div key={it.clientId} className="flex items-center justify-between gap-2 p-3">
                <div>
                  <div className="font-semibold">{it.muatan.namaSaatItu}</div>
                  <div className="text-xs text-muted-foreground">
                    {it.muatan.qtyInput} {it.muatan.satuanInput} ·{' '}
                    {it.muatan.dari ? LABEL_LOKASI[it.muatan.dari as KodeLokasi] : '-'} →{' '}
                    {it.muatan.ke ? LABEL_LOKASI[it.muatan.ke as KodeLokasi] : '-'}
                  </div>
                  {it.pesan && <div className="text-xs text-destructive">{it.pesan}</div>}
                </div>
                <Badge variant="outline" className={KELAS_STATUS_ANTRE[it.status]}>
                  {LABEL_STATUS_ANTRE[it.status]}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
