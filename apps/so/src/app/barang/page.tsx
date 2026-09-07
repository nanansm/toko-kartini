import Link from 'next/link';
import { requireRole, PERMISSIONS } from '@/lib/session';
import { cariProduk } from '@/lib/katalog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function BarangPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireRole(PERMISSIONS.LIHAT_KATALOG);

  const { q } = await searchParams;
  const kataKunci = q ?? '';
  const hasil = await cariProduk(kataKunci, 30);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Kartu Stok</h1>
        <p className="text-sm text-stone-500 mt-1">
          Cari barang untuk melihat saldo per lokasi dan riwayat mutasinya.
        </p>
      </div>

      <form method="get" className="flex gap-2">
        <Input
          name="q"
          defaultValue={kataKunci}
          placeholder="Ketik nama atau kode barang…"
        />
        <Button type="submit">Cari</Button>
      </form>

      <div className="rounded-xl border border-stone-200 bg-white">
        {hasil.length === 0 ? (
          <div className="p-4 text-sm text-stone-500">Tidak ada barang yang cocok.</div>
        ) : (
          <ul className="divide-y divide-stone-200">
            {hasil.map((produk) => (
              <li key={produk.id}>
                <Link
                  href={`/barang/${produk.id}`}
                  className="flex items-center justify-between gap-4 p-4 hover:bg-stone-50"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-stone-900 truncate">{produk.nama}</div>
                    <div className="text-xs font-mono text-stone-500">{produk.id}</div>
                  </div>
                  <div className="shrink-0 text-xs text-stone-500">{produk.kategori}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
