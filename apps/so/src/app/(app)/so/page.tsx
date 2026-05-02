import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, Plus, MapPin, Calendar } from 'lucide-react';
import { getSOSessions } from '@/lib/queries/so-sessions';
import { requireAuth } from '@/lib/session';

const STATUS_META: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'bg-stone-100 text-stone-700' },
  IN_PROGRESS: { label: 'Sedang Berjalan', color: 'bg-blue-100 text-blue-700' },
  SUBMITTED: { label: 'Menunggu Approval', color: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Selesai', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Ditolak', color: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-stone-100 text-stone-500' },
};

const TYPE_LABEL: Record<string, string> = {
  HARIAN: 'Harian',
  MINGGUAN: 'Mingguan',
  BULANAN: 'Bulanan',
};

function formatRupiah(value: string | number | null): string {
  if (value === null || value === undefined) return 'Rp 0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num) || num === 0) return 'Rp 0';
  const sign = num < 0 ? '-' : '';
  return (
    sign +
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(Math.abs(num))
  );
}

export default async function SOHubPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await requireAuth();
  const sp = await searchParams;

  const sessions = await getSOSessions({
    status: sp.status,
    page: parseInt(sp.page ?? '1', 10),
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-kartini-green" />
            Stock Opname
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Pencatatan dan validasi stok fisik vs sistem.
          </p>
        </div>

        <Link
          href="/so/new"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-kartini-green hover:bg-kartini-green-dark text-white font-semibold text-sm transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          SO Baru
        </Link>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/so"
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            !sp.status
              ? 'bg-kartini-green text-white'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          Semua ({sessions.total})
        </Link>
        {(['IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const).map((s) => (
          <Link
            key={s}
            href={`/so?status=${s}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              sp.status === s
                ? 'bg-kartini-green text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {STATUS_META[s]?.label}
          </Link>
        ))}
      </div>

      {/* Sessions list */}
      {sessions.items.length === 0 ? (
        <Card className="border-stone-200 shadow-soft-sm p-12 text-center">
          <ClipboardCheck className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <h3 className="font-semibold text-stone-900">Belum ada SO Session</h3>
          <p className="text-sm text-stone-500 mt-1">
            Mulai SO baru untuk hitung stok per lokasi.
          </p>
          <Link
            href="/so/new"
            className="inline-flex items-center gap-2 mt-4 text-sm font-semibold text-kartini-green hover:underline"
          >
            <Plus className="w-4 h-4" />
            Buat SO Pertama
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.items.map((s) => {
            const meta = STATUS_META[s.status] ?? {
              label: s.status,
              color: 'bg-stone-100',
            };
            const diffValue = Number(s.totalDifferenceValueRp ?? 0);
            const hasDiff = diffValue !== 0;

            return (
              <Link key={s.id} href={`/so/${s.id}`} className="block">
                <Card className="border-stone-200 shadow-soft-sm hover:shadow-soft-md hover:border-kartini-green/20 transition">
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge
                            className={`${meta.color} hover:${meta.color} border-0 text-xs`}
                          >
                            {meta.label}
                          </Badge>
                          <span className="text-xs text-stone-500">
                            SO {TYPE_LABEL[s.type] ?? s.type}
                          </span>
                        </div>
                        <h3 className="font-semibold text-stone-900 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-stone-400" />
                          {s.locationName}
                        </h3>
                        <div className="text-xs font-mono text-stone-400 mt-0.5">
                          {s.id}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-stone-100 text-xs">
                      <div>
                        <div className="text-stone-500">Total Item</div>
                        <div className="font-semibold text-stone-900 mt-0.5">
                          {(s.totalItems ?? 0).toLocaleString('id-ID')}
                        </div>
                      </div>
                      <div>
                        <div className="text-stone-500">Selisih</div>
                        <div
                          className={`font-semibold mt-0.5 ${
                            (s.totalDifferences ?? 0) > 0
                              ? 'text-amber-700'
                              : 'text-stone-900'
                          }`}
                        >
                          {s.totalDifferences ?? 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-stone-500">Selisih Nilai</div>
                        <div
                          className={`font-semibold mt-0.5 tabular-nums ${
                            diffValue < 0
                              ? 'text-red-700'
                              : diffValue > 0
                                ? 'text-green-700'
                                : 'text-stone-900'
                          }`}
                        >
                          {hasDiff ? formatRupiah(s.totalDifferenceValueRp) : '-'}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-stone-400 mt-2 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Dibuat:{' '}
                      {s.startedAt
                        ? new Date(s.startedAt).toLocaleString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'}
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
