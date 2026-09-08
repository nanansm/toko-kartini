import * as React from 'react';
import Link from 'next/link';
import { ROLE_LABEL } from '@/lib/roles';
import { canAccess, PERMISSIONS, requireAuth } from '@/lib/session';
import { ambilMetaKatalog } from '@/lib/katalog';
import { ambilNilai } from '@/lib/nilai';
import { LABEL_LOKASI, isKodeLokasi } from '@/lib/lokasi';
import { formatRupiah, formatNumber, formatWaktuWIB } from '@/lib/format';
import { MODE_LAPORAN } from '@/lib/mode';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  PackagePlus,
  Truck,
  ArrowLeftRight,
  AlertTriangle,
  ClipboardCheck,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface TombolTugasProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  judul: string;
  keterangan: string;
  aksen?: boolean;
}

function TombolTugas({ href, icon: Icon, judul, keterangan, aksen }: TombolTugasProps) {
  return (
    <Link href={href} className="block">
      <Card
        className={
          aksen
            ? 'border-2 border-kartini-green hover:bg-kartini-green/5 transition-colors'
            : 'hover:bg-stone-50 transition-colors'
        }
      >
        <CardContent className="flex items-center gap-4 py-5">
          <Icon
            className={aksen ? 'h-8 w-8 shrink-0 text-kartini-green' : 'h-6 w-6 shrink-0 text-kartini-orange'}
          />
          <div>
            <div className={aksen ? 'text-lg font-bold text-stone-900' : 'font-bold text-stone-900'}>
              {judul}
            </div>
            <div className="text-xs text-stone-500">{keterangan}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function HomePage() {
  const user = await requireAuth();
  const [meta, nilai] = await Promise.all([ambilMetaKatalog(), ambilNilai()]);

  const bisaCatat = canAccess(user.peran, PERMISSIONS.CATAT_MUTASI);
  const bisaSO = canAccess(user.peran, PERMISSIONS.MULAI_SO);

  return (
    <main className="p-4 lg:p-6 space-y-6 max-w-5xl">
      <p className="text-sm text-stone-500">
        Masuk sebagai <span className="font-semibold text-stone-700">{user.nama}</span> ·{' '}
        {ROLE_LABEL[user.peran]}
      </p>

      {/* MODE_LAPORAN mematikan seluruh rute tulis (lihat lib/mode.ts). Menu
          yang mengantar staf ke rute mati lebih buruk daripada menu pendek,
          jadi seluruh blok tugas disembunyikan sekaligus lewat satu saklar. */}
      {!MODE_LAPORAN && (bisaCatat || bisaSO) && (
        <div className="space-y-6">
          {bisaCatat && (
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-stone-700">Pekerjaan hari ini</h2>
              <TombolTugas
                href="/catat?jenis=ISI_DISPLAY"
                icon={PackagePlus}
                judul="Isi Ulang Display"
                keterangan="Gudang ke Area Display"
                aksen
              />
            </div>
          )}

          {bisaCatat && (
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-stone-700">Lebih jarang</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <TombolTugas
                  href="/catat?jenis=DATANG"
                  icon={Truck}
                  judul="Barang Datang"
                  keterangan="Terima kiriman supplier"
                />
                <TombolTugas
                  href="/catat?jenis=PINDAH"
                  icon={ArrowLeftRight}
                  judul="Pindah Gudang"
                  keterangan="Antar gudang"
                />
                <TombolTugas
                  href="/catat?jenis=RUSAK"
                  icon={AlertTriangle}
                  judul="Barang Rusak"
                  keterangan="Rusak, kadaluarsa, dipakai toko"
                />
              </div>
            </div>
          )}

          {bisaSO && (
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-stone-700">Bulanan</h2>
              <TombolTugas
                href="/hitung"
                icon={ClipboardCheck}
                judul="Hitung Stok"
                keterangan="Stok opname per gudang"
              />
            </div>
          )}
        </div>
      )}

      {nilai ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent>
                <div className="text-xs uppercase tracking-wide text-stone-500">Total barang</div>
                <div className="text-3xl font-bold text-stone-900">{formatNumber(nilai.totalQty)}</div>
                <div className="text-xs text-stone-500 mt-1">satuan terkecil</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <div className="text-xs uppercase tracking-wide text-stone-500">Nilai stok</div>
                <div className="text-3xl font-bold text-stone-900">{formatRupiah(nilai.totalNilai)}</div>
                <div className="text-xs text-stone-500 mt-1">harga beli</div>
              </CardContent>
            </Card>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gudang</TableHead>
                  <TableHead className="text-right">Jumlah barang</TableHead>
                  <TableHead className="text-right">Nilai (harga beli)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nilai.lokasi.map((baris) => (
                  <TableRow key={baris.lokasi}>
                    <TableCell>
                      {isKodeLokasi(baris.lokasi) ? LABEL_LOKASI[baris.lokasi] : baris.lokasi}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${baris.qty < 0 ? 'text-destructive' : ''}`}
                    >
                      {formatNumber(baris.qty)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatRupiah(baris.nilai)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${nilai.totalQty < 0 ? 'text-destructive' : ''}`}
                  >
                    {formatNumber(nilai.totalQty)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatRupiah(nilai.totalNilai)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {nilai.qtyTanpaHarga !== 0 && (
            <Alert>
              <AlertDescription>
                {formatNumber(nilai.qtyTanpaHarga)} barang dari {formatNumber(nilai.produkTanpaHarga)}{' '}
                jenis belum punya harga beli di Master Pricelist, jadi tidak ikut dihitung ke nilai stok.
              </AlertDescription>
            </Alert>
          )}

          <p className="text-xs text-stone-400">
            Angka per {formatWaktuWIB(nilai.waktuSaldo)}. Stok aplikasi tim ditarik tiap 10 menit,
            catatan dari aplikasi ini dijumlahkan di atasnya.
          </p>
        </>
      ) : (
        <Alert>
          <AlertDescription>
            Nilai stok belum dihitung. Angka ini akan terisi otomatis oleh penyegar berkala.
          </AlertDescription>
        </Alert>
      )}

      <div className="text-xs text-stone-500">
        Katalog:{' '}
        {meta ? (
          <>
            {formatNumber(meta.jumlahProduk)} barang · {formatNumber(meta.jumlahPincang)} barang pincang
            disembunyikan · segar {formatWaktuWIB(meta.waktu)}
          </>
        ) : (
          'Belum disegarkan. Katalog terisi otomatis oleh penyegar berkala.'
        )}
      </div>

      {canAccess(user.peran, PERMISSIONS.KELOLA_PENGGUNA) && (
        <div className="text-xs flex gap-4">
          <Link href="/admin/pengguna" className="underline text-stone-500 hover:text-stone-800">
            Kelola Pengguna
          </Link>
          <Link href="/admin/data-pincang" className="underline text-stone-500 hover:text-stone-800">
            Data Pincang
          </Link>
        </div>
      )}
    </main>
  );
}
