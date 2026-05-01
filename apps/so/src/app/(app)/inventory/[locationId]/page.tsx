import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db, locations } from '@kartini/db';
import { eq } from 'drizzle-orm';
import { ArrowLeft, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { getStockByLocation, getUnitsForProducts } from '@/lib/queries/stock';
import { formatBaseToLargestUnit, type ProductUnit } from '@/lib/inventory/unit-conversion';
import { StockSearchInput } from './_components/StockSearchInput';
import { requireAuth } from '@/lib/session';

interface PageProps {
  params: Promise<{ locationId: string }>;
  searchParams: Promise<{ q?: string; page?: string; hideZero?: string }>;
}

export default async function StockByLocationPage({ params, searchParams }: PageProps) {
  await requireAuth();
  const { locationId } = await params;
  const sp = await searchParams;

  const [location] = await db.select().from(locations).where(eq(locations.id, locationId));
  if (!location) notFound();

  const stockData = await getStockByLocation(locationId, {
    search: sp.q,
    page: Math.max(1, parseInt(sp.page ?? '1') || 1),
    hideZeroStock: sp.hideZero === '1',
  });

  const productIds = stockData.items.map((item) => item.productId);
  const unitsByProduct = await getUnitsForProducts(productIds);

  return (
    <div className="space-y-5">
      <Link
        href="/inventory"
        className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali ke daftar lokasi
      </Link>

      <div>
        <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
          <MapPin className="w-3 h-3" />
          {location.code}
        </div>
        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900">{location.name}</h1>
        <p className="text-sm text-stone-500 mt-1">
          {stockData.total.toLocaleString('id-ID')} produk dengan stok
        </p>
      </div>

      <Card className="border-stone-200 shadow-soft-sm py-4">
        <div className="px-4">
          <StockSearchInput />
        </div>
      </Card>

      <Card className="border-stone-200 shadow-soft-sm overflow-hidden p-0 gap-0">
        {stockData.items.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-3xl mb-2">📦</div>
            <p className="text-sm text-stone-500">
              {sp.q ? 'Tidak ada produk yang cocok' : 'Belum ada stok di lokasi ini'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide">
                    Produk
                  </th>
                  <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide">
                    Kategori
                  </th>
                  <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide text-right">
                    Qty Stok
                  </th>
                  <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide hidden md:table-cell">
                    Update Terakhir
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {stockData.items.map((item) => {
                  const rawUnits = unitsByProduct.get(item.productId) ?? [];
                  const formattedUnits: ProductUnit[] = rawUnits.map((u) => ({
                    id: u.id,
                    productId: u.productId,
                    unitName: u.unitName,
                    unitLevel: u.unitLevel,
                    qtyInBaseUnit: Number(u.qtyInBaseUnit),
                    isBaseUnit: u.isBaseUnit,
                    isDefaultPurchase: u.isDefaultPurchase,
                    isDefaultSell: u.isDefaultSell,
                  }));

                  const display = formatBaseToLargestUnit(
                    Number(item.qtyInBase),
                    formattedUnits,
                  );
                  const baseUnit = formattedUnits.find((u) => u.isBaseUnit);

                  return (
                    <tr key={item.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/master/products/${item.productId}`}
                          className="font-medium text-stone-900 hover:text-kartini-green"
                        >
                          {item.productName}
                        </Link>
                        <div className="text-xs font-mono text-stone-400 mt-0.5">
                          {item.productId}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-stone-600">{item.categoryL1}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-semibold text-stone-900 tabular-nums">{display}</div>
                        {baseUnit && (
                          <div className="text-xs text-stone-400 tabular-nums">
                            ({Number(item.qtyInBase).toLocaleString('id-ID')} {baseUnit.unitName})
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-stone-500 text-xs hidden md:table-cell">
                        {item.lastMovementAt
                          ? new Date(item.lastMovementAt).toLocaleString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
