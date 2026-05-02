'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronRight } from 'lucide-react';
import { SOItemInputDialog } from './SOItemInputDialog';
import { SOItemApprovalDialog } from './SOItemApprovalDialog';

const ITEM_STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'bg-stone-100 text-stone-600' },
  COUNTED: { label: 'Counted', color: 'bg-blue-100 text-blue-700' },
  NEEDS_RECOUNT: { label: 'Re-count', color: 'bg-red-100 text-red-700' },
  PENDING_APPROVAL: { label: 'Approve?', color: 'bg-amber-100 text-amber-700' },
  AUTO_APPROVED: { label: 'Auto OK', color: 'bg-green-100 text-green-600' },
  APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-600' },
};

export interface SOItem {
  id: string;
  productId: string;
  productName: string;
  categoryL1: string;
  qtySystemBase: string;
  qtyPhysicalBase: string | null;
  differenceBase: string | null;
  differencePercent: string | null;
  differenceValueRp: string | null;
  status: string;
  notes: string | null;
  approvalReason: string | null;
  rejectionReason: string | null;
  recountCount: number;
}

interface Props {
  sessionId: string;
  items: SOItem[];
  totalPages: number;
  total: number;
  currentPage: number;
  sessionEditable: boolean;
  sessionStatus: string;
  userRole: string;
  thresholds: { lowPct: number; highPct: number };
}

export function SOItemList(props: Props) {
  const { items, sessionEditable, userRole, sessionId, total, currentPage, totalPages } =
    props;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [activeItem, setActiveItem] = useState<SOItem | null>(null);
  const [activeApproval, setActiveApproval] = useState<SOItem | null>(null);

  // Debounce search
  useEffect(() => {
    const handle = setTimeout(() => {
      const np = new URLSearchParams(searchParams.toString());
      if (search) np.set('search', search);
      else np.delete('search');
      np.delete('page');
      const next = np.toString();
      const current = searchParams.toString();
      if (next !== current) {
        router.push(`?${next}`);
      }
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function applyStatusFilter(status: string | null) {
    const np = new URLSearchParams(searchParams.toString());
    if (status) np.set('status', status);
    else np.delete('status');
    np.delete('page');
    router.push(`?${np.toString()}`);
  }

  function goPage(page: number) {
    const np = new URLSearchParams(searchParams.toString());
    np.set('page', String(page));
    router.push(`?${np.toString()}`);
  }

  return (
    <Card className="border-stone-200 shadow-soft-sm">
      {/* Filters */}
      <div className="p-4 border-b border-stone-100 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => applyStatusFilter(null)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${
              !searchParams.get('status')
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Semua ({total})
          </button>
          {(['PENDING', 'NEEDS_RECOUNT', 'PENDING_APPROVAL'] as const).map((s) => {
            const meta = ITEM_STATUS_META[s];
            return (
              <button
                key={s}
                onClick={() => applyStatusFilter(s)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                  searchParams.get('status') === s
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {meta?.label}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="search"
            placeholder="Cari produk..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-stone-50 border-0 text-sm placeholder:text-stone-400 outline-none focus:bg-white focus:ring-2 focus:ring-kartini-green/20"
          />
        </div>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div className="p-8 text-center text-sm text-stone-500">
          Tidak ada item yang cocok dengan filter
        </div>
      ) : (
        <div className="divide-y divide-stone-100">
          {items.map((item) => {
            const meta = ITEM_STATUS_META[item.status] ?? {
              label: item.status,
              color: 'bg-stone-100',
            };
            const isClickable = sessionEditable
              ? ['PENDING', 'COUNTED', 'NEEDS_RECOUNT'].includes(item.status)
              : item.status === 'PENDING_APPROVAL' &&
                ['OWNER', 'ADMIN', 'SUPERVISOR'].includes(userRole);

            return (
              <button
                key={item.id}
                disabled={!isClickable}
                onClick={() => {
                  if (sessionEditable) setActiveItem(item);
                  else if (item.status === 'PENDING_APPROVAL') setActiveApproval(item);
                }}
                className={`w-full p-4 text-left transition flex items-center gap-3 ${
                  isClickable
                    ? 'hover:bg-stone-50 cursor-pointer'
                    : 'cursor-default opacity-90'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge
                      className={`${meta.color} hover:${meta.color} border-0 text-[10px] px-2`}
                    >
                      {meta.label}
                    </Badge>
                    <span className="text-xs text-stone-400">{item.categoryL1}</span>
                    {item.recountCount > 0 && (
                      <span className="text-[10px] text-red-600 font-semibold">
                        recount #{item.recountCount}
                      </span>
                    )}
                  </div>
                  <div className="font-medium text-sm text-stone-900">
                    {item.productName}
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-3 flex-wrap">
                    <span>
                      Sistem:{' '}
                      <span className="font-semibold text-stone-700">
                        {Number(item.qtySystemBase).toLocaleString('id-ID')}
                      </span>
                    </span>
                    {item.qtyPhysicalBase !== null && (
                      <>
                        <span>
                          Fisik:{' '}
                          <span className="font-semibold text-stone-700">
                            {Number(item.qtyPhysicalBase).toLocaleString('id-ID')}
                          </span>
                        </span>
                        <span
                          className={`font-semibold ${
                            Number(item.differenceBase ?? 0) < 0
                              ? 'text-red-600'
                              : Number(item.differenceBase ?? 0) > 0
                                ? 'text-green-600'
                                : 'text-stone-400'
                          }`}
                        >
                          {Number(item.differenceBase ?? 0) > 0 ? '+' : ''}
                          {Number(item.differenceBase ?? 0).toLocaleString('id-ID')} (
                          {Number(item.differencePercent ?? 0).toFixed(1)}%)
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {isClickable && (
                  <ChevronRight className="w-4 h-4 text-stone-300 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
          <span>
            Page {currentPage} / {totalPages} ({total} items)
          </span>
          <div className="flex gap-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => goPage(currentPage - 1)}
              className="px-3 py-1 rounded-md bg-stone-100 hover:bg-stone-200 disabled:opacity-40 transition"
            >
              ← Prev
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => goPage(currentPage + 1)}
              className="px-3 py-1 rounded-md bg-stone-100 hover:bg-stone-200 disabled:opacity-40 transition"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Input dialog */}
      {activeItem && (
        <SOItemInputDialog
          item={activeItem}
          sessionId={sessionId}
          onClose={() => setActiveItem(null)}
        />
      )}

      {/* Approval dialog */}
      {activeApproval && (
        <SOItemApprovalDialog
          item={activeApproval}
          onClose={() => setActiveApproval(null)}
        />
      )}
    </Card>
  );
}
