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
  type SatuanTingkat,
  LABEL_JENIS,
  LABEL_SEBAB,
  ARAH_SAH,
} from '@/lib/mutasi';

// Opname (hitung stok) punya jalur sendiri yang belum dibangun — jangan ditampilkan di sini.
type TabJenis = Exclude<JenisMutasi, 'OPNAME'>;
const TAB_JENIS: readonly TabJenis[] = ['DATANG', 'ISI_DISPLAY', 'PINDAH', 'RUSAK'];

function isTabJenis(nilai: string): nilai is TabJenis {
  return (TAB_JENIS as readonly string[]).includes(nilai);
}

interface ProdukHasil {
  id: string;
  nama: string;
  kategori: string;
  satuan: SatuanTingkat[];
}

interface ResponCari {
  ok: boolean;
  produk?: ProdukHasil[];
}

interface ResponCatat {
  ok: boolean;
  diterima?: string[];
  duplikat?: string[];
  tertunda?: string[];
  ditolak?: { clientId: string; pesan: string }[];
  pesan?: string;
}

type StatusBaris = 'tersimpan' | 'menunggu' | 'gagal';

interface BarisTercatat {
  clientId: string;
  namaBarang: string;
  qtyInput: number;
  satuanInput: string;
  dari: KodeLokasi;
  ke: KodeLokasi;
  status: StatusBaris;
  pesan: string | null;
}

const LABEL_STATUS: Record<StatusBaris, string> = {
  tersimpan: 'Tersimpan',
  menunggu: 'Menunggu',
  gagal: 'Gagal',
};

// Badge bawaan cuma punya default/secondary/destructive/outline — tak ada hijau/kuning,
// jadi warna status ditimpa lewat className di atas variant "outline".
const KELAS_STATUS: Record<StatusBaris, string> = {
  tersimpan: 'border-transparent bg-green-600 text-white',
  menunggu: 'border-transparent bg-yellow-500 text-black',
  gagal: 'border-transparent bg-destructive text-white',
};

export function FormCatat(): React.JSX.Element {
  const [jenis, setJenis] = React.useState<TabJenis>('DATANG');

  const [kataKunci, setKataKunci] = React.useState('');
  const [hasilCari, setHasilCari] = React.useState<ProdukHasil[]>([]);
  const [mencari, setMencari] = React.useState(false);
  const [errorCari, setErrorCari] = React.useState<string | null>(null);
  const [produkTerpilih, setProdukTerpilih] = React.useState<ProdukHasil | null>(null);

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

  const [mengirim, setMengirim] = React.useState(false);
  const [tercatat, setTercatat] = React.useState<BarisTercatat[]>([]);

  // clientId dibuat SEKALI per percobaan simpan dan dipakai ulang saat retry —
  // kalau dibuat ulang, baris kembar mendarat di spreadsheet.
  const pendingClientIdRef = React.useRef<string | null>(null);

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
    pendingClientIdRef.current = null;
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
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setMencari(true);
      fetch(`/api/cari?q=${encodeURIComponent(kata)}`, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) {
            setErrorCari('Gagal mencari barang.');
            setHasilCari([]);
            return;
          }
          const data = (await res.json()) as ResponCari;
          if (!data.ok) {
            setErrorCari('Gagal mencari barang.');
            setHasilCari([]);
            return;
          }
          setErrorCari(null);
          setHasilCari(data.produk ?? []);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return; // dibatalkan karena ketikan baru
          setErrorCari('Gagal mencari barang.');
          setHasilCari([]);
        })
        .finally(() => setMencari(false));
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [kataKunci, produkTerpilih]);

  function pilihProduk(p: ProdukHasil): void {
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
    !mengirim &&
    produkTerpilih !== null &&
    dari !== null &&
    ke !== null &&
    satuanTerpilih !== '' &&
    jumlahSah &&
    (jenis !== 'RUSAK' || sebab !== '') &&
    (jenis !== 'PINDAH' || dari !== ke);

  async function simpan(): Promise<void> {
    if (!bisaSimpan || !produkTerpilih || dari === null || ke === null) return;
    setMengirim(true);

    const clientId = pendingClientIdRef.current ?? crypto.randomUUID();
    pendingClientIdRef.current = clientId;

    // Nilai dikunci ke const: penyempitan tipe dari penjaga di atas tidak ikut
    // masuk ke dalam closure `upsert`, dan React bisa merender ulang di tengah
    // pengiriman — baris yang dilaporkan harus yang dikirim, bukan yang terbaru
    // di layar.
    const produk = produkTerpilih;
    const asal = dari;
    const tujuan = ke;

    const baris = {
      clientId,
      jenis,
      productId: produk.id,
      namaSaatItu: produk.nama,
      satuanInput: satuanTerpilih,
      qtyInput: jumlah,
      dari: asal,
      ke: tujuan,
      sebab: jenis === 'RUSAK' ? sebab : null,
      catatan: catatan.trim() === '' ? null : catatan.trim(),
    };

    function upsert(status: StatusBaris, pesan: string | null): void {
      setTercatat((prev) => [
        {
          clientId,
          namaBarang: produk.nama,
          qtyInput: jumlah,
          satuanInput: satuanTerpilih,
          dari: asal,
          ke: tujuan,
          status,
          pesan,
        },
        ...prev.filter((b) => b.clientId !== clientId),
      ]);
    }

    try {
      const res = await fetch('/api/catat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baris: [baris] }),
      });

      if (res.status === 401) {
        upsert('gagal', 'Sesi berakhir, masuk lagi.');
        setMengirim(false);
        return;
      }
      if (res.status === 502 || res.status === 503) {
        upsert('menunggu', null);
        setMengirim(false);
        return;
      }

      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        upsert('gagal', 'Server memberi jawaban tak terduga.');
        setMengirim(false);
        return;
      }

      let data: ResponCatat;
      try {
        data = (await res.json()) as ResponCatat;
      } catch {
        upsert('gagal', 'Gagal membaca jawaban server.');
        setMengirim(false);
        return;
      }

      if (!data.ok) {
        upsert('gagal', data.pesan ?? 'Ditolak server.');
        setMengirim(false);
        return;
      }

      const ditolak = data.ditolak?.find((d) => d.clientId === clientId);
      if (ditolak) {
        upsert('gagal', ditolak.pesan);
      } else if (data.tertunda?.includes(clientId)) {
        upsert('menunggu', null);
      } else if (data.diterima?.includes(clientId) || data.duplikat?.includes(clientId)) {
        upsert('tersimpan', null);
        pendingClientIdRef.current = null;
        setJumlah(1);
        setSebab('');
        setCatatan('');
      } else {
        upsert('gagal', 'Status tidak diketahui dari server.');
      }
    } catch {
      // Jaringan putus dianggap sementara, sama seperti 502/503 — boleh dicoba lagi.
      upsert('menunggu', null);
    } finally {
      setMengirim(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
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

      <div className="sticky bottom-0 -mx-4 border-t border-border bg-background p-4">
        <Button className="h-12 w-full text-base" disabled={!bisaSimpan} onClick={simpan}>
          {mengirim ? 'Menyimpan...' : 'Simpan'}
        </Button>
      </div>

      {tercatat.length > 0 && (
        <div className="space-y-2">
          <Label>Tercatat sesi ini</Label>
          <div className="flex flex-col divide-y divide-border rounded-md border border-border">
            {tercatat.map((b) => (
              <div key={b.clientId} className="flex items-center justify-between gap-2 p-3">
                <div>
                  <div className="font-semibold">{b.namaBarang}</div>
                  <div className="text-xs text-muted-foreground">
                    {b.qtyInput} {b.satuanInput} · {LABEL_LOKASI[b.dari]} → {LABEL_LOKASI[b.ke]}
                  </div>
                  {b.pesan && <div className="text-xs text-destructive">{b.pesan}</div>}
                </div>
                <Badge variant="outline" className={KELAS_STATUS[b.status]}>
                  {LABEL_STATUS[b.status]}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
