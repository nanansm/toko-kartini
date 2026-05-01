import Link from 'next/link';
import { db, locations } from '@kartini/db';
import { eq, asc } from 'drizzle-orm';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, ArrowRight, Package } from 'lucide-react';
import { getStockSummary } from '@/lib/queries/stock';
import { requireAuth } from '@/lib/session';
import { formatRupiah } from '@/lib/format';

export default async function InventoryPage() {
  await requireAuth();

  const [allLocations, summary] = await Promise.all([
    db
      .select()
      .from(locations)
      .where(eq(locations.isActive, true))
      .orderBy(asc(locations.id)),
    getStockSummary(),
  ]);

  const summaryMap = new Map(summary.map((s) => [s.locationId, s]));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 flex items-center gap-2">
          <Package className="w-6 h-6 text-kartini-green" />
          Stok per Lokasi
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Stok aktual di setiap lokasi fisik. Update otomatis dari setiap movement.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {allLocations.map((loc) => {
          const sum = summaryMap.get(loc.id);
          const hasStock = sum && Number(sum.totalQtyBase) > 0;

          return (
            <Link key={loc.id} href={`/inventory/${loc.id}`} className="group">
              <Card className="border-stone-200 shadow-soft-sm group-hover:shadow-soft-md group-hover:border-kartini-green/30 transition h-full py-5 gap-3">
                <CardContent className="px-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-lg bg-kartini-green-light flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-kartini-green" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-kartini-green group-hover:translate-x-1 transition" />
                  </div>

                  <div className="text-xs font-mono text-stone-400 mb-1">{loc.code}</div>
                  <h3 className="font-semibold text-stone-900 line-clamp-2">{loc.name}</h3>

                  <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-stone-100">
                    <div>
                      <div className="text-xs text-stone-500 mb-0.5">Produk</div>
                      <div className="text-lg font-bold text-stone-900 tabular-nums">
                        {(sum?.totalProducts ?? 0).toLocaleString('id-ID')}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-stone-500 mb-0.5">Nilai Stok</div>
                      <div className="text-sm font-semibold text-stone-700 tabular-nums truncate">
                        {hasStock ? formatRupiah(sum.totalValueRp) : 'Rp 0'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {summary.length === 0 && (
        <Card className="border-amber-200 bg-amber-50 py-5 gap-2">
          <CardContent className="px-5">
            <div className="flex items-start gap-3">
              <div className="text-2xl">📦</div>
              <div>
                <h3 className="font-semibold text-amber-900">Belum ada data stok</h3>
                <p className="text-sm text-amber-800 mt-1">
                  Mulai dengan input <strong>Opening Balance</strong> (stok awal). Hanya OWNER yang
                  bisa input opening balance.
                </p>
                <Link
                  href="/movements/opening-balance"
                  className="inline-block mt-3 text-sm font-semibold text-amber-900 hover:underline"
                >
                  Input Opening Balance →
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
