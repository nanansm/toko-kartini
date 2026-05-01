import Link from 'next/link';
import { db, locations } from '@kartini/db';
import { eq, asc } from 'drizzle-orm';
import { Card } from '@/components/ui/card';
import { ArrowLeft, History } from 'lucide-react';
import { requireAuth } from '@/lib/session';
import {
  getMovements,
  type MovementTypeFilter,
  MOVEMENT_TYPE_META,
} from '@/lib/queries/movements';
import { MovementRow } from '../_components/MovementRow';
import { HistoryFilters } from './_components/HistoryFilters';
import { HistoryPagination } from './_components/HistoryPagination';

const VALID_TYPES = new Set(Object.keys(MOVEMENT_TYPE_META));

function parseDate(s: string | undefined, endOfDay: boolean): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
}

interface PageProps {
  searchParams: Promise<{
    type?: string;
    loc?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

export default async function MovementsHistoryPage({ searchParams }: PageProps) {
  await requireAuth();
  const sp = await searchParams;

  const allLocations = await db
    .select()
    .from(locations)
    .where(eq(locations.isActive, true))
    .orderBy(asc(locations.id));

  const movementType =
    sp.type && VALID_TYPES.has(sp.type) ? (sp.type as MovementTypeFilter) : undefined;

  const data = await getMovements({
    movementType,
    locationId: sp.loc,
    fromDate: parseDate(sp.from, false),
    toDate: parseDate(sp.to, true),
    page: Math.max(1, parseInt(sp.page ?? '1') || 1),
    pageSize: 50,
  });

  return (
    <div className="space-y-5">
      <Link
        href="/movements"
        className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali ke Movement Hub
      </Link>

      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 flex items-center gap-2">
          <History className="w-6 h-6 text-kartini-green" />
          Riwayat Movement
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          {data.total.toLocaleString('id-ID')} record
        </p>
      </div>

      <Card className="border-stone-200 shadow-soft-sm py-4">
        <div className="px-4">
          <HistoryFilters locations={allLocations} />
        </div>
      </Card>

      <Card className="border-stone-200 shadow-soft-sm overflow-hidden p-0 gap-0">
        {data.items.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-3xl mb-2">📋</div>
            <p className="text-sm text-stone-500">
              Tidak ada movement yang cocok dengan filter
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-stone-100">
              {data.items.map((m) => (
                <MovementRow key={m.id} movement={m} />
              ))}
            </div>
            {data.totalPages > 1 && (
              <div className="border-t border-stone-200 px-4 py-3">
                <HistoryPagination
                  currentPage={data.page}
                  totalPages={data.totalPages}
                  total={data.total}
                />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
