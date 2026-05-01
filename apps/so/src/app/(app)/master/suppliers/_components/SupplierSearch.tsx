'use client';

import { Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export function SupplierSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = searchParams.get('q') ?? '';
  const [search, setSearch] = useState(initial);

  useEffect(() => {
    if (search === initial) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (search) params.set('q', search);
      else params.delete('q');
      params.delete('page');
      router.push(`?${params.toString()}`);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="relative max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
      <input
        type="search"
        placeholder="Cari supplier..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full h-10 pl-9 pr-9 rounded-lg bg-white border border-stone-200 focus:border-kartini-green focus:ring-2 focus:ring-kartini-green/20 text-sm placeholder:text-stone-400 outline-none transition"
      />
      {search && (
        <button
          type="button"
          onClick={() => setSearch('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 rounded"
          aria-label="Clear"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
