'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export interface SatuanTingkat {
  nama: string;
  pengali: number;
}

export interface LembarQtyProps {
  /** Terbuka/tidak. Ditutup lewat onBatal. */
  terbuka: boolean;
  namaProduk: string;
  satuan: readonly SatuanTingkat[];
  /** Isi awal per nama satuan. Kosong = lembar baru; terisi = sedang mengubah
   *  baris keranjang yang sudah ada. */
  nilaiAwal?: Record<string, number>;
  onSimpan: (qtySatuan: Record<string, number>, totalPokok: number) => void;
  onBatal: () => void;
}

/**
 * Lembar bawah untuk mengisi qty satu produk. Semua satuan produk tampil
 * berbaris sekaligus (bukan satu dropdown), boleh diisi lebih dari satu
 * satuan sekaligus, dan total dalam satuan terkecil terhitung otomatis.
 */
export function LembarQty({
  terbuka,
  namaProduk,
  satuan,
  nilaiAwal,
  onSimpan,
  onBatal,
}: LembarQtyProps): React.JSX.Element {
  // Nilai kotak per nama satuan, disimpan sebagai string supaya kotak
  // kosong bisa dibedakan dari "0" saat ditampilkan.
  const [nilai, setNilai] = React.useState<Record<string, string>>({});

  const satuanUrut = React.useMemo(
    () => [...satuan].sort((a, b) => b.pengali - a.pengali),
    [satuan],
  );

  // Reset kotak dari nilaiAwal cuma saat lembar BARU dibuka (tepi naik
  // terbuka false→true). Tanpa penjaga tepi ini, produk kedua bisa
  // mewarisi angka produk sebelumnya kalau parent me-render ulang props
  // saat lembar masih terbuka.
  const terbukaSebelumnya = React.useRef(false);
  React.useEffect(() => {
    if (terbuka && !terbukaSebelumnya.current) {
      const awal: Record<string, string> = {};
      for (const s of satuan) {
        const v = nilaiAwal?.[s.nama];
        if (v !== undefined && v > 0) awal[s.nama] = String(Math.floor(v));
      }
      setNilai(awal);
    }
    terbukaSebelumnya.current = terbuka;
  }, [terbuka, satuan, nilaiAwal]);

  function ubahQty(nama: string, mentah: string): void {
    if (mentah.trim() === '') {
      setNilai((prev) => {
        const salinan = { ...prev };
        delete salinan[nama];
        return salinan;
      });
      return;
    }
    const n = Number(mentah);
    if (!Number.isFinite(n)) return; // bukan angka — abaikan ketikan
    // Qty barang tidak pernah negatif atau pecahan di layar pencatatan.
    const bulat = Math.max(0, Math.floor(n));
    setNilai((prev) => ({ ...prev, [nama]: String(bulat) }));
  }

  const total = React.useMemo(() => {
    let jumlah = 0;
    for (const s of satuanUrut) {
      const n = Number(nilai[s.nama] ?? '');
      if (Number.isFinite(n) && n > 0) jumlah += Math.floor(n) * s.pengali;
    }
    return jumlah;
  }, [satuanUrut, nilai]);

  function simpan(): void {
    const qtySatuan: Record<string, number> = {};
    for (const s of satuanUrut) {
      const n = Number(nilai[s.nama] ?? '');
      if (Number.isFinite(n) && n > 0) qtySatuan[s.nama] = Math.floor(n);
    }
    onSimpan(qtySatuan, total);
  }

  return (
    <Sheet
      open={terbuka}
      onOpenChange={(buka) => {
        if (!buka) onBatal();
      }}
    >
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{namaProduk}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-2 px-4">
          {satuanUrut.map((s) => (
            <div
              key={s.nama}
              className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
            >
              <div>
                {/* Nama satuan dari Pricelist SUDAH memuat isinya, mis.
                    "Krtn (12 Pcs)" -- menambah anotasi isi di sini membuatnya
                    tercetak dua kali. Cukup pengalinya yang ditambahkan. */}
                <div className="font-semibold">{s.nama}</div>
                <div className="text-xs text-muted-foreground">×{s.pengali}</div>
              </div>
              <Input
                inputMode="numeric"
                placeholder="0"
                value={nilai[s.nama] ?? ''}
                onChange={(e) => ubahQty(s.nama, e.target.value)}
                className="w-24 text-center text-lg"
              />
            </div>
          ))}
        </div>

        <Separator />

        <div className="flex items-center justify-between px-4">
          <span className="text-sm font-semibold text-muted-foreground">TOTAL</span>
          <span className="text-3xl font-bold tabular-nums">{total}</span>
        </div>

        <SheetFooter className="flex-row gap-2">
          <Button type="button" variant="outline" className="min-h-12 flex-1" onClick={onBatal}>
            Batal
          </Button>
          <Button
            type="button"
            className="min-h-12 flex-1"
            disabled={total === 0}
            onClick={simpan}
          >
            Simpan
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
