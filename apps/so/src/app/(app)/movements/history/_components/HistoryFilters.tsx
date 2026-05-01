'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MOVEMENT_TYPE_META, type MovementTypeFilter } from '@/lib/inventory/movement-meta';

const MOVEMENT_TYPES = Object.keys(MOVEMENT_TYPE_META) as MovementTypeFilter[];

interface Location {
  id: string;
  name: string;
  code: string;
}

export function HistoryFilters({ locations }: { locations: Location[] }) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string | null) {
    const np = new URLSearchParams(params.toString());
    if (value && value !== 'all') np.set(key, value);
    else np.delete(key);
    np.delete('page');
    router.push(`?${np.toString()}`);
  }

  function clear() {
    router.push(window.location.pathname);
  }

  const hasFilter = ['type', 'loc', 'from', 'to'].some((k) => params.get(k));

  return (
    <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
      <Select
        value={params.get('type') ?? 'all'}
        onValueChange={(v) => setParam('type', v)}
      >
        <SelectTrigger className="w-full sm:w-48 h-10">
          <SelectValue placeholder="Tipe Movement" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua tipe</SelectItem>
          {MOVEMENT_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {MOVEMENT_TYPE_META[t].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={params.get('loc') ?? 'all'}
        onValueChange={(v) => setParam('loc', v)}
      >
        <SelectTrigger className="w-full sm:w-56 h-10">
          <SelectValue placeholder="Lokasi" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua lokasi</SelectItem>
          {locations.map((loc) => (
            <SelectItem key={loc.id} value={loc.id}>
              <span className="font-mono text-xs text-stone-400 mr-2">{loc.code}</span>
              {loc.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <input
        type="date"
        value={params.get('from') ?? ''}
        onChange={(e) => setParam('from', e.target.value || null)}
        className="h-10 px-3 rounded-lg border border-stone-200 focus:border-kartini-green focus:ring-2 focus:ring-kartini-green/20 text-sm outline-none"
        aria-label="Dari tanggal"
      />
      <input
        type="date"
        value={params.get('to') ?? ''}
        onChange={(e) => setParam('to', e.target.value || null)}
        className="h-10 px-3 rounded-lg border border-stone-200 focus:border-kartini-green focus:ring-2 focus:ring-kartini-green/20 text-sm outline-none"
        aria-label="Sampai tanggal"
      />

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
