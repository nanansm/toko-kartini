'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LABEL_LOKASI, isKodeLokasi } from '@/lib/lokasi';

// Ditulis ulang lokal, sengaja tidak impor dari @kartini/sheets sesuai batas paket app ini.
interface BarisTinjau {
  id: number;
  sesiId: number;
  productId: string;
  nama: string;
  lokasi: string;
  qtyHitung: number | null;
  qtyTerlihat: number | null;
  qtySistem: number | null;
  mutasiMenyelip: string;
  status: string;
}

type Keputusan = 'MUTLAK' | 'SELISIH' | 'BATAL';

function labelLokasi(kode: string): string {
  return isKodeLokasi(kode) ? LABEL_LOKASI[kode] : kode;
}

function tampilAngka(nilai: number | null): string {
  return nilai === null ? '—' : String(nilai);
}

function kalimatSelisih(qtyHitung: number | null, qtyTerlihat: number | null, qtySistem: number | null): string {
  if (qtyHitung === null || qtyTerlihat === null || qtySistem === null) {
    return 'Barang yang menyelip belum terhitung staf. Stok jadi disesuaikan.';
  }
  const hasil = qtySistem + (qtyHitung - qtyTerlihat);
  return `Barang yang menyelip belum terhitung staf. Stok jadi ${hasil}.`;
}

export function DaftarTinjau(): React.JSX.Element {
  const [memuat, setMemuat] = React.useState(true);
  const [baris, setBaris] = React.useState<BarisTinjau[]>([]);
  const [errorMuat, setErrorMuat] = React.useState<string | null>(null);
  const [mengirimId, setMengirimId] = React.useState<number | null>(null);
  const [keputusanDikirim, setKeputusanDikirim] = React.useState<Keputusan | null>(null);
  const [pesanSukses, setPesanSukses] = React.useState<string | null>(null);
  const [pesanGagal, setPesanGagal] = React.useState<string | null>(null);

  React.useEffect(() => {
    let dibatalkan = false;
    async function muat(): Promise<void> {
      try {
        const res = await fetch('/api/tinjau');
        const data: unknown = await res.json().catch(() => null);
        if (dibatalkan) return;
        if (res.status === 401) {
          setErrorMuat('Sesi berakhir, masuk lagi.');
          return;
        }
        if (
          data &&
          typeof data === 'object' &&
          'ok' in data &&
          (data as { ok: boolean }).ok === true &&
          'baris' in data
        ) {
          setBaris((data as { baris: BarisTinjau[] }).baris);
        } else if (data && typeof data === 'object' && 'pesan' in data) {
          setErrorMuat(String((data as { pesan: unknown }).pesan));
        } else {
          setErrorMuat('Jawaban server tidak dikenali. Coba lagi.');
        }
      } catch {
        if (!dibatalkan) setErrorMuat('Gagal memuat daftar. Coba lagi.');
      } finally {
        if (!dibatalkan) setMemuat(false);
      }
    }
    void muat();
    return () => {
      dibatalkan = true;
    };
  }, []);

  async function kirimKeputusan(tinjauId: number, keputusan: Keputusan): Promise<void> {
    setPesanSukses(null);
    setPesanGagal(null);
    setMengirimId(tinjauId);
    setKeputusanDikirim(keputusan);
    try {
      const res = await fetch('/api/tinjau', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tinjauId, keputusan }),
      });
      const data: unknown = await res.json().catch(() => null);

      if (res.status === 401) {
        setPesanGagal('Sesi berakhir, masuk lagi.');
        return;
      }

      if (!data || typeof data !== 'object' || !('ok' in data)) {
        setPesanGagal('Jawaban server tidak dikenali. Coba lagi.');
        return;
      }

      if ((data as { ok: boolean }).ok !== true) {
        const pesan = 'pesan' in data ? String((data as { pesan: unknown }).pesan) : 'Gagal menyimpan. Coba lagi.';
        setPesanGagal(pesan);
        return;
      }

      // Baris dihapus dari state lokal, bukan muat ulang seluruh daftar —
      // baris lain yang sedang dilihat supervisor tidak boleh berubah/berkedip.
      setBaris((prev) => prev.filter((b) => b.id !== tinjauId));
      setPesanSukses(`Tinjauan #${tinjauId} diputus.`);
    } catch {
      setPesanGagal('Gagal terhubung ke server. Coba lagi.');
    } finally {
      setMengirimId(null);
      setKeputusanDikirim(null);
    }
  }

  if (memuat) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (errorMuat) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{errorMuat}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {pesanSukses && (
        <p className="text-sm font-medium text-green-700">{pesanSukses}</p>
      )}
      {pesanGagal && (
        <Alert variant="destructive">
          <AlertDescription>{pesanGagal}</AlertDescription>
        </Alert>
      )}

      {/* Keadaan kosong dirender DI SINI, bukan sebagai pengembalian awal:
          baris terakhir yang diputus mengosongkan daftar, dan pengembalian awal
          ikut membuang konfirmasi keputusannya. */}
      {baris.length === 0 && (
        <Card>
          <CardContent>
            <p className="text-sm text-stone-500">Tidak ada hasil hitung yang perlu ditinjau.</p>
          </CardContent>
        </Card>
      )}

      {baris.map((b) => {
        const sedangDikirim = mengirimId === b.id;
        const daftarMutasi = b.mutasiMenyelip.trim() === '' ? [] : b.mutasiMenyelip.split('; ');

        return (
          <Card key={b.id}>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-stone-900">{b.nama}</div>
                  <div className="text-xs text-stone-500">{b.productId}</div>
                </div>
                <span className="text-xs text-stone-500">{labelLokasi(b.lokasi)}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xs text-stone-500">Dihitung staf</div>
                  <div className="tabular-nums text-lg font-semibold">{tampilAngka(b.qtyHitung)}</div>
                </div>
                <div>
                  <div className="text-xs text-stone-500">Angka sistem saat sesi dibuka</div>
                  <div className="tabular-nums text-lg font-semibold">{tampilAngka(b.qtyTerlihat)}</div>
                </div>
                <div>
                  <div className="text-xs text-stone-500">Angka sistem sekarang</div>
                  <div className="tabular-nums text-lg font-semibold">{tampilAngka(b.qtySistem)}</div>
                </div>
              </div>

              <div>
                <div className="text-xs text-stone-500">Mutasi yang menyelip</div>
                {daftarMutasi.length === 0 ? (
                  <div className="text-sm">—</div>
                ) : (
                  <ul className="list-disc pl-5">
                    {daftarMutasi.map((baris1, idx) => (
                      <li key={idx} className="tabular-nums text-sm">
                        {baris1}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Button
                    variant="default"
                    className="h-12 flex-1 w-full"
                    disabled={sedangDikirim}
                    onClick={() => void kirimKeputusan(b.id, 'MUTLAK')}
                  >
                    {sedangDikirim && keputusanDikirim === 'MUTLAK' ? 'Menyimpan…' : 'Sudah termasuk'}
                  </Button>
                  <p className="text-xs text-stone-500">
                    Barang yang menyelip sudah ikut terhitung staf. Stok jadi {tampilAngka(b.qtyHitung)}.
                  </p>
                </div>
                <div className="flex-1 space-y-1">
                  <Button
                    variant="outline"
                    className="h-12 flex-1 w-full"
                    disabled={sedangDikirim}
                    onClick={() => void kirimKeputusan(b.id, 'SELISIH')}
                  >
                    {sedangDikirim && keputusanDikirim === 'SELISIH' ? 'Menyimpan…' : 'Belum termasuk'}
                  </Button>
                  <p className="text-xs text-stone-500">
                    {kalimatSelisih(b.qtyHitung, b.qtyTerlihat, b.qtySistem)}
                  </p>
                </div>
              </div>

              <div>
                <Button
                  variant="ghost"
                  className="text-red-600 hover:text-red-700"
                  disabled={sedangDikirim}
                  onClick={() => void kirimKeputusan(b.id, 'BATAL')}
                >
                  {sedangDikirim && keputusanDikirim === 'BATAL' ? 'Menyimpan…' : 'Batalkan tinjauan'}
                </Button>
                <p className="text-xs text-stone-500">Stok tidak diubah.</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
