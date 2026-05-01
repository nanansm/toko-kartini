'use client';

import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductOption {
  id: string;
  name: string;
  categoryL1: string;
}

interface Props {
  value: string;
  onChange: (productId: string, product: ProductOption | null) => void;
  disabled?: boolean;
}

export function ProductPicker({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ProductOption[]>([]);
  const [selected, setSelected] = useState<ProductOption | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch search results when open or search changes
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/products/search?q=${encodeURIComponent(search)}&limit=20`,
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.items ?? []);
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [search, open]);

  // Resolve selected product detail when value changes
  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/products/${value}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.product) setSelected(data.product);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full h-10 px-3 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 focus:border-kartini-green focus:ring-2 focus:ring-kartini-green/20 text-sm outline-none flex items-center justify-between gap-2 text-left disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={cn('truncate', !selected && 'text-stone-400')}>
          {selected ? selected.name : 'Pilih produk...'}
        </span>
        <ChevronsUpDown className="w-4 h-4 text-stone-400 flex-shrink-0" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute z-40 mt-1 w-full bg-white border border-stone-200 rounded-lg shadow-lg max-h-80 overflow-hidden">
            <div className="p-2 border-b border-stone-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="search"
                  placeholder="Cari nama atau ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-lg bg-stone-50 text-sm placeholder:text-stone-400 outline-none focus:bg-white focus:ring-2 focus:ring-kartini-green/20"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto p-1">
              {loading ? (
                <div className="p-4 text-sm text-stone-500 text-center">Mencari...</div>
              ) : results.length === 0 ? (
                <div className="p-4 text-sm text-stone-500 text-center">
                  {search ? 'Tidak ada produk yang cocok' : 'Mengetik untuk mencari'}
                </div>
              ) : (
                results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onChange(p.id, p);
                      setSelected(p);
                      setOpen(false);
                      setSearch('');
                    }}
                    className="w-full p-2 rounded-md hover:bg-stone-50 text-left text-sm flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-stone-900 truncate">{p.name}</div>
                      <div className="text-xs text-stone-500">
                        <span className="font-mono">{p.id}</span> · {p.categoryL1}
                      </div>
                    </div>
                    {value === p.id && (
                      <Check className="w-4 h-4 text-kartini-green flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
