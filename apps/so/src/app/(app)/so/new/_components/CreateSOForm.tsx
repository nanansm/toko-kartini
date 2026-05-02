'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Calendar, MapPin, Tag } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createSOSession } from '@/lib/inventory/so-actions';

interface Location {
  id: string;
  name: string;
  code: string;
  type: string;
}

const TYPE_OPTIONS = [
  { value: 'HARIAN', label: 'Harian', desc: 'Untuk Display Toko (cycle harian)' },
  { value: 'MINGGUAN', label: 'Mingguan', desc: 'Per gudang, kategori bergilir' },
  { value: 'BULANAN', label: 'Bulanan', desc: 'Full count semua + valuasi' },
] as const;

type SOType = 'HARIAN' | 'MINGGUAN' | 'BULANAN';

export function CreateSOForm({
  locations,
  categories,
}: {
  locations: Location[];
  categories: string[];
}) {
  const router = useRouter();
  const [type, setType] = useState<SOType>('MINGGUAN');
  const [locationId, setLocationId] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!locationId) {
      toast.error('Pilih lokasi dulu');
      return;
    }

    setSubmitting(true);
    const result = await createSOSession({
      type,
      locationId,
      scopeFilter: categoryFilter !== 'all' ? { categoryL1: categoryFilter } : undefined,
      notes: notes.trim() || undefined,
    });
    setSubmitting(false);

    if (result.ok) {
      toast.success(`SO berhasil dibuat (${result.itemCount} produk)`);
      router.push(`/so/${result.sessionId}`);
    } else {
      toast.error(result.error ?? 'Gagal');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Type */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-stone-700 flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-stone-400" />
          Tipe SO <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setType(opt.value)}
              className={`p-3 rounded-lg border-2 text-left transition ${
                type === opt.value
                  ? 'border-kartini-green bg-kartini-green-light'
                  : 'border-stone-200 hover:border-stone-300 bg-white'
              }`}
            >
              <div className="font-semibold text-sm text-stone-900">{opt.label}</div>
              <div className="text-xs text-stone-500 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Location */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-stone-700 flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-stone-400" />
          Lokasi <span className="text-red-500">*</span>
        </label>
        <Select value={locationId} onValueChange={setLocationId}>
          <SelectTrigger className="h-10">
            <SelectValue placeholder="Pilih lokasi..." />
          </SelectTrigger>
          <SelectContent>
            {locations.map((loc) => (
              <SelectItem key={loc.id} value={loc.id}>
                <span className="font-mono text-xs text-stone-400 mr-2">{loc.code}</span>
                {loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category Filter */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-stone-700 flex items-center gap-1.5">
          <Tag className="w-4 h-4 text-stone-400" />
          Scope Kategori{' '}
          <span className="text-stone-400 font-normal">(opsional)</span>
        </label>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-10">
            <SelectValue placeholder="Semua kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua kategori (full count)</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-stone-400">
          Pilih kategori spesifik untuk cycle count (mis. cuma Plastik HD), atau biarkan
          untuk full count.
        </p>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-stone-700">
          Catatan <span className="text-stone-400 font-normal">(opsional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Misal: SO mingguan minggu ke-3..."
          className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:border-kartini-green focus:ring-2 focus:ring-kartini-green/20 text-sm outline-none resize-none"
        />
      </div>

      {/* Submit */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting || !locationId}
          className="px-6 h-11 rounded-lg bg-kartini-green hover:bg-kartini-green-dark text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Generate SO Items
        </button>
      </div>
    </form>
  );
}
