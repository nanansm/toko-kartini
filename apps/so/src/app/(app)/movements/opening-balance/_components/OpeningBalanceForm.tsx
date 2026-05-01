'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProductPicker } from '@/components/inventory/ProductPicker';
import {
  MixedUnitInput,
  type MixedUnitRow,
  type ProductUnitForInput,
} from '@/components/inventory/MixedUnitInput';
import { createOpeningBalance } from '@/lib/inventory/movement-actions';

interface Location {
  id: string;
  name: string;
  code: string;
}

export function OpeningBalanceForm({ locations }: { locations: Location[] }) {
  const [productId, setProductId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [units, setUnits] = useState<ProductUnitForInput[]>([]);
  const [mixedRows, setMixedRows] = useState<MixedUnitRow[]>([]);
  const [hppPerBase, setHppPerBase] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!productId) {
      setUnits([]);
      setMixedRows([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/products/${productId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.units) {
          setUnits(data.units);
          setMixedRows([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) return toast.error('Pilih produk dulu');
    if (!locationId) return toast.error('Pilih lokasi dulu');
    if (mixedRows.length === 0 || mixedRows.every((r) => r.qty === 0)) {
      return toast.error('Isi qty minimal 1 unit');
    }

    setSubmitting(true);
    const result = await createOpeningBalance({
      productId,
      locationId,
      mixed: mixedRows.filter((r) => r.qty > 0),
      hppPerBase: hppPerBase ? parseFloat(hppPerBase) : undefined,
      notes: notes.trim() || undefined,
    });
    setSubmitting(false);

    if (result.ok) {
      toast.success(
        `Opening balance tersimpan (${result.totalBase.toLocaleString('id-ID')} unit terkecil)`,
      );
      setProductId('');
      setLocationId('');
      setUnits([]);
      setMixedRows([]);
      setHppPerBase('');
      setNotes('');
    } else {
      toast.error(result.error ?? 'Terjadi kesalahan');
    }
  }

  const baseUnit = units.find((u) => u.isBaseUnit);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-stone-700">
          Produk <span className="text-red-500">*</span>
        </label>
        <ProductPicker value={productId} onChange={(id) => setProductId(id)} />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-stone-700">
          Lokasi <span className="text-red-500">*</span>
        </label>
        <Select value={locationId} onValueChange={setLocationId}>
          <SelectTrigger className="h-10 w-full">
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

      {productId && units.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-stone-700">
            Qty Stok Awal <span className="text-red-500">*</span>
          </label>
          <MixedUnitInput
            units={units}
            value={mixedRows}
            onChange={setMixedRows}
            baseUnitName={baseUnit?.unitName}
          />
        </div>
      )}

      {productId && units.length === 0 && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
          ⚠ Produk ini belum punya konfigurasi unit. Lengkapi di Sheet ProductUnits dulu.
        </div>
      )}

      {productId && units.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-stone-700">
            HPP per Unit Terkecil{' '}
            <span className="text-stone-400 font-normal">(opsional)</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">
              Rp
            </span>
            <input
              type="number"
              min="0"
              step="any"
              value={hppPerBase}
              onChange={(e) => setHppPerBase(e.target.value)}
              placeholder="0"
              className="w-full h-10 pl-10 pr-3 rounded-lg border border-stone-200 focus:border-kartini-green focus:ring-2 focus:ring-kartini-green/20 text-sm outline-none tabular-nums"
            />
          </div>
          <p className="text-xs text-stone-400">
            HPP per {baseUnit?.unitName ?? 'unit terkecil'}. Untuk valuasi stok awal.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-stone-700">
          Catatan <span className="text-stone-400 font-normal">(opsional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Catatan untuk audit log..."
          className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:border-kartini-green focus:ring-2 focus:ring-kartini-green/20 text-sm outline-none resize-none"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting || !productId || !locationId || mixedRows.length === 0}
          className="px-6 h-11 rounded-lg bg-kartini-green hover:bg-kartini-green-dark text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Simpan Opening Balance
        </button>
      </div>
    </form>
  );
}
