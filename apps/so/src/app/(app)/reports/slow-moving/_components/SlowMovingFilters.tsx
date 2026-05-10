'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DAY_OPTIONS = [
  { value: '14', label: '14 hari' },
  { value: '30', label: '30 hari' },
  { value: '60', label: '60 hari' },
  { value: '90', label: '90 hari' },
];

interface LocationOption {
  id: string;
  name: string;
}

export function SlowMovingFilters({ locations }: { locations: LocationOption[] }) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const np = new URLSearchParams(params.toString());
    if (value && value !== 'all') np.set(key, value);
    else np.delete(key);
    np.delete('page');
    router.push(`?${np.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Select
        value={params.get('locationId') ?? 'all'}
        onValueChange={(v) => update('locationId', v)}
      >
        <SelectTrigger className="w-48 h-9">
          <SelectValue placeholder="Semua Lokasi" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua Lokasi</SelectItem>
          {locations.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              {l.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={params.get('days') ?? '30'} onValueChange={(v) => update('days', v)}>
        <SelectTrigger className="w-36 h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DAY_OPTIONS.map((d) => (
            <SelectItem key={d.value} value={d.value}>
              {d.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
