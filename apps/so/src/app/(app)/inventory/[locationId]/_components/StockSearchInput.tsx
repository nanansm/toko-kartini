'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';

export function StockSearchInput() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get('q') ?? '';
  const [search, setSearch] = useState(initial);

  useEffect(() => {
    if (search === initial) return;
    const t = setTimeout(() => {
      const np = new URLSearchParams(params.toString());
      if (search) np.set('q', search);
      else np.delete('q');
      np.delete('page');
      router.push(`?${np.toString()}`);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
      <input
        type="search"
        placeholder="Cari produk..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full h-10 pl-9 pr-3 rounded-lg bg-white border border-stone-200 focus:border-kartini-green focus:ring-2 focus:ring-kartini-green/20 text-sm placeholder:text-stone-400 outline-none transition"
      />
    </div>
  );
}
