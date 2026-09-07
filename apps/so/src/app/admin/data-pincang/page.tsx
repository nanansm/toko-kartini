import { requireRole, PERMISSIONS } from '@/lib/session';
import { ambilPincang, ambilMetaKatalog, ambilErrorKatalog } from '@/lib/katalog';
import { formatNumber, formatWaktuWIB } from '@/lib/format';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

export const dynamic = 'force-dynamic';

export default async function DataPincangPage() {
  await requireRole(PERMISSIONS.KELOLA_PENGGUNA);

  const [pincang, meta, error] = await Promise.all([
    ambilPincang(),
    ambilMetaKatalog(),
    ambilErrorKatalog(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Data Pincang</h1>
        <p className="text-sm text-stone-500 mt-1">
          Barang di sini disembunyikan dari layar pencatatan karena datanya belum lengkap di
          spreadsheet. Betulkan dulu baris yang disebut, lalu tunggu katalog disegarkan ulang.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Penyegaran terakhir dibatalkan — {formatWaktuWIB(error.waktu)}</AlertTitle>
          <AlertDescription>{error.pesan}</AlertDescription>
        </Alert>
      )}

      {!pincang ? (
        <Alert>
          <AlertTitle>Katalog belum disegarkan</AlertTitle>
          <AlertDescription>
            Belum ada data katalog yang tersimpan. Tunggu proses penyegaran berjalan, lalu buka
            halaman ini kembali.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {meta && (
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg border border-stone-200 bg-white p-3">
                <div className="text-stone-500">Produk sehat</div>
                <div className="text-xl font-semibold text-stone-900">{formatNumber(meta.jumlahProduk)}</div>
              </div>
              <div className="rounded-lg border border-stone-200 bg-white p-3">
                <div className="text-stone-500">Produk pincang</div>
                <div className="text-xl font-semibold text-stone-900">{formatNumber(meta.jumlahPincang)}</div>
              </div>
              <div className="rounded-lg border border-stone-200 bg-white p-3">
                <div className="text-stone-500">Segar terakhir</div>
                <div className="text-sm font-medium text-stone-900">{formatWaktuWIB(meta.waktu)}</div>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-stone-200 bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Baris Sheet</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Alasan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pincang.produk.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-stone-500">
                      Tidak ada barang pincang saat ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  pincang.produk.map((produk) => (
                    <TableRow key={produk.productId}>
                      <TableCell>{produk.barisSheet}</TableCell>
                      <TableCell>{produk.productId}</TableCell>
                      <TableCell className="whitespace-normal">{produk.nama}</TableCell>
                      <TableCell>{produk.kategori}</TableCell>
                      <TableCell className="whitespace-normal">
                        {produk.alasanPincang.map((alasan) => (
                          <div key={alasan}>{alasan}</div>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
