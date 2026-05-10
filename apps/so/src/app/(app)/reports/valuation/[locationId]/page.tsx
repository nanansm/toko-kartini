import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { db, locations } from '@kartini/db';
import { eq } from 'drizzle-orm';
import { getStockValuationByCategory } from '@/lib/queries/reports';
import { requireAuth } from '@/lib/session';

function formatRp(value: number): string {
  if (!value || value === 0) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function ValuationDetailPage({
  params,
}: {
  params: Promise<{ locationId: string }>;
}) {
  await requireAuth();
  const { locationId } = await params;

  const [location] = await db
    .select()
    .from(locations)
    .where(eq(locations.id, locationId));
  if (!location) notFound();

  const categories = await getStockValuationByCategory(locationId);
  const totalValue = categories.reduce((sum, c) => sum + Number(c.total_value_rp ?? 0), 0);

  return (
    <div className="space-y-5 max-w-4xl">
      <Link
        href="/reports/valuation"
        className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-stone-900">{location.name}</h1>
        <p className="text-sm text-stone-500 mt-1">Valuasi per kategori</p>
      </div>

      <Card className="border-kartini-green/20 bg-kartini-green-light p-5">
        <div className="text-sm text-stone-600">Total Nilai Stok</div>
        <div className="text-3xl font-bold text-stone-900 mt-1">{formatRp(totalValue)}</div>
        <div className="text-xs text-stone-500 mt-1">{categories.length} kategori</div>
      </Card>

      <Card className="border-stone-200 shadow-soft-sm overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide">
                Kategori
              </th>
              <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide text-right">
                SKU
              </th>
              <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide text-right">
                Nilai Stok
              </th>
              <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide text-right hidden md:table-cell">
                % Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {categories.map((cat) => {
              const pct =
                totalValue > 0
                  ? ((Number(cat.total_value_rp) / totalValue) * 100).toFixed(1)
                  : '0';
              return (
                <tr key={cat.category_l1} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-stone-900">{cat.category_l1}</div>
                    {Number(cat.products_no_hpp) > 0 && (
                      <div className="text-xs text-amber-600">
                        {cat.products_no_hpp} tanpa HPP
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-stone-600 tabular-nums">
                    {cat.total_products}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-stone-900 tabular-nums">
                    {formatRp(Number(cat.total_value_rp))}
                  </td>
                  <td className="px-4 py-3 text-right text-stone-500 tabular-nums hidden md:table-cell">
                    {pct}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
