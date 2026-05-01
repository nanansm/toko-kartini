'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function ProductsFilters({ categories }: { categories: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const initialQ = searchParams.get('q') ?? '';

  useEffect(() => {
    if (search === initialQ) return;
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

  function setCategory(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') params.set('cat', value);
    else params.delete('cat');
    params.delete('page');
    router.push(`?${params.toString()}`);
  }

  function clear() {
    setSearch('');
    router.push(window.location.pathname);
  }

  const hasFilter = Boolean(search || searchParams.get('cat'));

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          type="search"
          placeholder="Cari nama produk atau ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-3 rounded-lg bg-white border border-stone-200 focus:border-kartini-green focus:ring-2 focus:ring-kartini-green/20 text-sm placeholder:text-stone-400 outline-none transition"
        />
      </div>

      <Select value={searchParams.get('cat') ?? 'all'} onValueChange={setCategory}>
        <SelectTrigger className="w-full sm:w-56 h-10">
          <SelectValue placeholder="Semua Kategori" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua Kategori</SelectItem>
          {categories.map((cat) => (
            <SelectItem key={cat} value={cat}>
              {cat}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilter && (
        <button
          type="button"
          onClick={clear}
          className="h-10 px-4 rounded-lg text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition flex items-center gap-2"
        >
          <X className="w-4 h-4" />
          Reset
        </button>
      )}
    </div>
  );
}
