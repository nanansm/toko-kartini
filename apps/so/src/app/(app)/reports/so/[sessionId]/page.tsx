import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, TrendingDown, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { getSOSessionTopDiscrepancies } from '@/lib/queries/reports';
import { db, stockCountSessions, locations } from '@kartini/db';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/session';

function formatRp(value: number | null): string {
  if (!value) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
}

export default async function SOReportDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  await requireAuth();
  const { sessionId } = await params;

  const [session] = await db
    .select({
      id: stockCountSessions.id,
      type: stockCountSessions.type,
      approvedAt: stockCountSessions.approvedAt,
      totalItems: stockCountSessions.totalItemsCount,
      totalDifferences: stockCountSessions.totalDifferences,
      totalDifferenceValueRp: stockCountSessions.totalDifferenceValueRp,
      locationName: locations.name,
    })
    .from(stockCountSessions)
    .innerJoin(locations, eq(stockCountSessions.locationId, locations.id))
    .where(eq(stockCountSessions.id, sessionId));

  if (!session) notFound();

  const discrepancies = await getSOSessionTopDiscrepancies(sessionId);

  return (
    <div className="space-y-5 max-w-4xl">
      <Link
        href="/reports/so"
        className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali
      </Link>

      <div>
        <div className="text-xs font-mono text-stone-400 mb-1">{session.id}</div>
        <h1 className="text-2xl font-bold text-stone-900">
          SO {session.type} — {session.locationName}
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Diapprove:{' '}
          {session.approvedAt
            ? new Date(session.approvedAt).toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })
            : '-'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="border-stone-200 shadow-soft-sm p-4">
          <div className="text-xs text-stone-500">Total Item</div>
          <div className="text-2xl font-bold text-stone-900 mt-1">
            {session.totalItems ?? 0}
          </div>
        </Card>
        <Card className="border-stone-200 shadow-soft-sm p-4">
          <div className="text-xs text-stone-500">Ada Selisih</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            {session.totalDifferences ?? 0}
          </div>
        </Card>
        <Card className="border-stone-200 shadow-soft-sm p-4">
          <div className="text-xs text-stone-500">Nilai Selisih</div>
          <div
            className={`text-xl font-bold mt-1 tabular-nums ${
              Number(session.totalDifferenceValueRp) < 0 ? 'text-red-600' : 'text-green-600'
            }`}
          >
            {formatRp(Number(session.totalDifferenceValueRp))}
          </div>
        </Card>
      </div>

      <Card className="border-stone-200 shadow-soft-sm p-0">
        <div className="p-4 border-b border-stone-100">
          <h2 className="font-semibold text-stone-900">Top 10 Selisih Terbesar</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Diurutkan berdasarkan nilai selisih
          </p>
        </div>

        {discrepancies.length === 0 ? (
          <div className="p-8 text-center text-sm text-stone-500">
            Tidak ada selisih di session ini. Perfect match!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide">
                    Produk
                  </th>
                  <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide text-right">
                    Sistem
                  </th>
                  <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide text-right">
                    Fisik
                  </th>
                  <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide text-right">
                    Selisih
                  </th>
                  <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide text-right">
                    Nilai
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {discrepancies.map((row) => {
                  const item = row as Record<string, unknown>;
                  const productId = String(item.product_id);
                  const diff = Number(item.difference_base);
                  const isShortage = diff < 0;

                  return (
                    <tr key={productId} className="hover:bg-stone-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-stone-900">
                          {String(item.product_name)}
                        </div>
                        <div className="text-xs text-stone-400">
                          {String(item.category_l1)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-stone-600 tabular-nums">
                        {Number(item.qty_system_base).toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-right text-stone-600 tabular-nums">
                        {Number(item.qty_physical_base).toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <div
                          className={`flex items-center justify-end gap-1 font-semibold ${
                            isShortage ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {isShortage ? (
                            <TrendingDown className="w-3.5 h-3.5" />
                          ) : (
                            <TrendingUp className="w-3.5 h-3.5" />
                          )}
                          {diff > 0 ? '+' : ''}
                          {diff.toLocaleString('id-ID')}
                          <span className="text-xs font-normal">
                            ({Number(item.difference_percent).toFixed(1)}%)
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span
                          className={
                            isShortage
                              ? 'text-red-600 font-semibold'
                              : 'text-green-600 font-semibold'
                          }
                        >
                          {isShortage ? '-' : '+'}
                          {formatRp(Number(item.difference_value_rp))}
                        </span>
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
