import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, MapPin } from 'lucide-react';
import { db, locations } from '@kartini/db';
import { asc } from 'drizzle-orm';
import { getSOReport } from '@/lib/queries/reports';
import { requireAuth } from '@/lib/session';
import { SOReportFilters } from './_components/SOReportFilters';

function formatRp(value: number | null): string {
  if (!value) return '-';
  const abs = Math.abs(value);
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(abs);
  return value < 0 ? `-${formatted}` : formatted;
}

export default async function SOReportPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string; month?: string; page?: string }>;
}) {
  await requireAuth();
  const sp = await searchParams;

  const [allLocations, data] = await Promise.all([
    db.select().from(locations).orderBy(asc(locations.id)),
    getSOReport({
      locationId: sp.locationId,
      month: sp.month,
      page: parseInt(sp.page ?? '1', 10),
    }),
  ]);

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-kartini-green" />
          Laporan SO
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          {data.total} SO session sudah diapprove.
        </p>
      </div>

      <Card className="border-stone-200 shadow-soft-sm p-4">
        <SOReportFilters locations={allLocations} />
      </Card>

      {data.items.length === 0 ? (
        <Card className="border-stone-200 p-12 text-center">
          <p className="text-stone-500">Belum ada SO yang diapprove.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.items.map((session) => {
            const s = session as Record<string, unknown>;
            const sessionId = String(s.session_id);
            const diffValue = Number(s.total_difference_value_rp ?? 0);

            return (
              <Link key={sessionId} href={`/reports/so/${sessionId}`}>
                <Card className="border-stone-200 shadow-soft-sm hover:shadow-soft-md transition p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0 text-xs">
                          Selesai
                        </Badge>
                        <span className="text-xs text-stone-500">SO {String(s.type)}</span>
                        <span className="text-xs font-mono text-stone-400">{sessionId}</span>
                      </div>
                      <h3 className="font-semibold text-stone-900 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-stone-400" />
                        {String(s.location_name)}
                      </h3>
                      <div className="text-xs text-stone-400 mt-0.5">
                        Approved:{' '}
                        {s.approved_at
                          ? new Date(s.approved_at as string).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric',
                            })
                          : '-'}
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`text-lg font-bold tabular-nums ${
                          diffValue < 0
                            ? 'text-red-600'
                            : diffValue > 0
                              ? 'text-green-600'
                              : 'text-stone-400'
                        }`}
                      >
                        {formatRp(diffValue)}
                      </div>
                      <div className="text-xs text-stone-500">Selisih nilai</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3 pt-3 border-t border-stone-100 text-xs">
                    <div>
                      <div className="text-stone-500">Total Item</div>
                      <div className="font-semibold text-stone-900 mt-0.5">
                        {Number(s.total_items_count ?? 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-stone-500">Ada Selisih</div>
                      <div
                        className={`font-semibold mt-0.5 ${
                          Number(s.total_differences) > 0 ? 'text-amber-700' : 'text-stone-900'
                        }`}
                      >
                        {Number(s.total_differences ?? 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-stone-500">Kurang</div>
                      <div className="font-semibold text-red-600 mt-0.5">
                        {Number(s.shortage_count ?? 0)} item
                      </div>
                    </div>
                    <div>
                      <div className="text-stone-500">Lebih</div>
                      <div className="font-semibold text-green-600 mt-0.5">
                        {Number(s.surplus_count ?? 0)} item
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
