import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, Calendar, AlertCircle } from 'lucide-react';
import {
  getSOSessionDetail,
  getSOSessionItems,
} from '@/lib/queries/so-sessions';
import { SOItemList } from './_components/SOItemList';
import { SOActionButtons } from './_components/SOActionButtons';
import { SOProgress } from './_components/SOProgress';
import { requireAuth } from '@/lib/session';
import { getSOThresholds } from '@/lib/inventory/settings';

interface PageProps {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ status?: string; page?: string; search?: string }>;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'bg-stone-100 text-stone-700' },
  IN_PROGRESS: { label: 'Sedang Berjalan', color: 'bg-blue-100 text-blue-700' },
  SUBMITTED: { label: 'Menunggu Approval', color: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Selesai', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Ditolak', color: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-stone-100 text-stone-500' },
};

export default async function SODetailPage({ params, searchParams }: PageProps) {
  const user = await requireAuth();
  const { sessionId } = await params;
  const sp = await searchParams;

  const [detail, thresholds] = await Promise.all([
    getSOSessionDetail(sessionId),
    getSOThresholds(),
  ]);

  if (!detail) notFound();
  const { session, statusCounts } = detail;

  const items = await getSOSessionItems(sessionId, {
    status: sp.status,
    search: sp.search,
    page: parseInt(sp.page ?? '1', 10),
  });

  const meta = STATUS_META[session.status] ?? {
    label: session.status,
    color: 'bg-stone-100',
  };
  const isEditable = ['DRAFT', 'IN_PROGRESS'].includes(session.status);

  return (
    <div className="space-y-5">
      <Link
        href="/so"
        className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali ke daftar SO
      </Link>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <Badge className={`${meta.color} hover:${meta.color} border-0`}>
            {meta.label}
          </Badge>
          <span className="text-xs text-stone-500">SO {session.type}</span>
          <span className="text-xs font-mono text-stone-400">{session.id}</span>
        </div>
        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 flex items-center gap-2">
          <MapPin className="w-6 h-6 text-stone-400" />
          {session.locationName}
        </h1>
        <p className="text-sm text-stone-500 mt-1 flex items-center gap-1.5">
          <Calendar className="w-3 h-3" />
          {session.startedAt
            ? new Date(session.startedAt).toLocaleString('id-ID', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '-'}
        </p>
      </div>

      {/* Threshold info */}
      {isEditable && (
        <Card className="bg-blue-50 border-blue-200 p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <strong>Threshold:</strong> Selisih &lt; {thresholds.lowPct}% auto-OK ·{' '}
            {thresholds.lowPct}–{thresholds.highPct}% perlu approve · ≥
            {thresholds.highPct}% wajib re-count.
          </div>
        </Card>
      )}

      {/* Progress */}
      <SOProgress
        statusCounts={statusCounts}
        totalItems={session.totalItemsCount ?? 0}
      />

      {/* Action buttons */}
      <SOActionButtons
        session={{ id: session.id, status: session.status }}
        statusCounts={statusCounts}
        userRole={user.role}
      />

      {/* Items */}
      <SOItemList
        sessionId={sessionId}
        items={items.items}
        totalPages={items.totalPages}
        total={items.total}
        currentPage={items.page}
        sessionEditable={isEditable}
        sessionStatus={session.status}
        userRole={user.role}
        thresholds={thresholds}
      />
    </div>
  );
}
