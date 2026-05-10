'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface LocationOption {
  id: string;
  name: string;
}

export function SOReportFilters({ locations }: { locations: LocationOption[] }) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const np = new URLSearchParams(params.toString());
    if (value && value !== 'all') np.set(key, value);
    else np.delete(key);
    np.delete('page');
    router.push(`?${np.toString()}`);
  }

  const months: { value: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    months.push({ value, label });
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

      <Select
        value={params.get('month') ?? 'all'}
        onValueChange={(v) => update('month', v)}
      >
        <SelectTrigger className="w-48 h-9">
          <SelectValue placeholder="Semua Bulan" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua Bulan</SelectItem>
          {months.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
