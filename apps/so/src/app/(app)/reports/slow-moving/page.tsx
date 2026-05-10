import { Card } from '@/components/ui/card';
import { TrendingDown, MapPin } from 'lucide-react';
import { db, locations } from '@kartini/db';
import { asc } from 'drizzle-orm';
import { getSlowMovingProducts } from '@/lib/queries/reports';
import { requireAuth } from '@/lib/session';
import { SlowMovingFilters } from './_components/SlowMovingFilters';

function formatRp(value: number | null): string {
  if (!value) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function SlowMovingPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string; days?: string; page?: string }>;
}) {
  await requireAuth();
  const sp = await searchParams;
  const thresholdDays = parseInt(sp.days ?? '30', 10);

  const [allLocations, data] = await Promise.all([
    db.select().from(locations).orderBy(asc(locations.id)),
    getSlowMovingProducts({
      locationId: sp.locationId,
      thresholdDays,
      page: parseInt(sp.page ?? '1', 10),
    }),
  ]);

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 flex items-center gap-2">
          <TrendingDown className="w-6 h-6 text-amber-600" />
          Slow Moving
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          {data.total} produk tidak bergerak lebih dari {thresholdDays} hari.
        </p>
      </div>

      <Card className="border-stone-200 shadow-soft-sm p-4">
        <SlowMovingFilters locations={allLocations} />
      </Card>

      {data.items.length === 0 ? (
        <Card className="border-stone-200 p-12 text-center">
          <p className="font-semibold text-stone-900">Tidak ada slow moving</p>
          <p className="text-sm text-stone-500 mt-1">
            Semua produk bergerak dalam {thresholdDays} hari terakhir.
          </p>
        </Card>
      ) : (
        <Card className="border-stone-200 shadow-soft-sm overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide">
                    Produk
                  </th>
                  <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide">
                    Lokasi
                  </th>
                  <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide text-right">
                    Qty Stok
                  </th>
                  <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide text-right">
                    Tidak Bergerak
                  </th>
                  <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide text-right hidden md:table-cell">
                    Est. Nilai
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {data.items.map((row, idx) => {
                  const item = row as Record<string, unknown>;
                  const days = Math.round(
                    Number(item.days_since_movement ?? thresholdDays),
                  );
                  const isVeryOld = days > 60;

                  return (
                    <tr
                      key={`${String(item.product_id)}-${String(item.location_code)}-${idx}`}
                      className="hover:bg-stone-50"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-stone-900">
                          {String(item.product_name)}
                        </div>
                        <div className="text-xs text-stone-400">
                          {String(item.category_l1)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-stone-600 text-xs">
                          <MapPin className="w-3 h-3" />
                          {String(item.location_code)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-stone-700 tabular-nums font-semibold">
                        {Number(item.qty_in_base).toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-semibold tabular-nums ${
                            isVeryOld ? 'text-red-600' : 'text-amber-600'
                          }`}
                        >
                          {days} hari
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-stone-600 tabular-nums hidden md:table-cell">
                        {formatRp(Number(item.estimated_value_rp))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {data.totalPages > 1 && (
            <div className="border-t border-stone-200 px-4 py-3 text-xs text-stone-500">
              Halaman {data.page} dari {data.totalPages} · {data.total} total produk
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
