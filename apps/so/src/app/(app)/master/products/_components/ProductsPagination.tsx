'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ProductsPagination({
  currentPage,
  totalPages,
  total,
}: {
  currentPage: number;
  totalPages: number;
  total: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page === 1) params.delete('page');
    else params.set('page', String(page));
    router.push(`?${params.toString()}`);
  }

  const startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const endPage = Math.min(totalPages, startPage + 4);
  const pageNumbers: number[] = [];
  for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);

  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="text-xs text-stone-500">
        Halaman <span className="font-semibold text-stone-700">{currentPage}</span> dari{' '}
        <span className="font-semibold text-stone-700">{totalPages}</span> ·{' '}
        <span className="font-semibold text-stone-700">{total.toLocaleString('id-ID')}</span> total
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-stone-500 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
          aria-label="Sebelumnya"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {pageNumbers.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => goToPage(p)}
            className={cn(
              'h-8 min-w-8 px-2 rounded-lg text-xs font-medium transition tabular-nums',
              p === currentPage
                ? 'bg-kartini-green text-white'
                : 'text-stone-600 hover:bg-stone-100',
            )}
          >
            {p}
          </button>
        ))}

        <button
          type="button"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-stone-500 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
          aria-label="Berikutnya"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
