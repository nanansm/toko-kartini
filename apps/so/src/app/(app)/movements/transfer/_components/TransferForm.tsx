'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, ArrowRight } from 'lucide-react';
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
import { createTransfer } from '@/lib/inventory/movement-actions';

interface Location {
  id: string;
  name: string;
  code: string;
}

export function TransferForm({ locations }: { locations: Location[] }) {
  const [productId, setProductId] = useState('');
  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [units, setUnits] = useState<ProductUnitForInput[]>([]);
  const [mixedRows, setMixedRows] = useState<MixedUnitRow[]>([]);
  const [stockAvailable, setStockAvailable] = useState<number | null>(null);
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

  useEffect(() => {
    if (!productId || !fromLocationId) {
      setStockAvailable(null);
      return;
    }
    let cancelled = false;
    fetch(
      `/api/inventory/balance?productId=${encodeURIComponent(productId)}&locationId=${encodeURIComponent(fromLocationId)}`,
    )
      .then((r) => (r.ok ? r.json() : { qty: 0 }))
      .then((data) => {
        if (!cancelled) setStockAvailable(data.qty);
      });
    return () => {
      cancelled = true;
    };
  }, [productId, fromLocationId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) return toast.error('Pilih produk');
    if (!fromLocationId || !toLocationId) return toast.error('Pilih kedua lokasi');
    if (fromLocationId === toLocationId) {
      return toast.error('Lokasi asal dan tujuan harus berbeda');
    }
    if (mixedRows.length === 0 || mixedRows.every((r) => r.qty === 0)) {
      return toast.error('Isi qty');
    }

    setSubmitting(true);
    const result = await createTransfer({
      productId,
      fromLocationId,
      toLocationId,
      mixed: mixedRows.filter((r) => r.qty > 0),
      notes: notes.trim() || undefined,
    });
    setSubmitting(false);

    if (result.ok) {
      toast.success(
        `Transfer berhasil (${result.totalBase.toLocaleString('id-ID')} unit terkecil)`,
      );
      setProductId('');
      setMixedRows([]);
      setStockAvailable(null);
      setNotes('');
    } else {
      toast.error(result.error ?? 'Gagal');
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

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 md:items-end">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-stone-700">
            Dari Lokasi <span className="text-red-500">*</span>
          </label>
          <Select value={fromLocationId} onValueChange={setFromLocationId}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="Lokasi asal..." />
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

        <div className="hidden md:flex items-center justify-center pb-2">
          <div className="w-10 h-10 rounded-full bg-kartini-green-light flex items-center justify-center">
            <ArrowRight className="w-4 h-4 text-kartini-green" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-stone-700">
            Ke Lokasi <span className="text-red-500">*</span>
          </label>
          <Select value={toLocationId} onValueChange={setToLocationId}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="Lokasi tujuan..." />
            </SelectTrigger>
            <SelectContent>
              {locations.map((loc) => (
                <SelectItem
                  key={loc.id}
                  value={loc.id}
                  disabled={loc.id === fromLocationId}
                >
                  <span className="font-mono text-xs text-stone-400 mr-2">{loc.code}</span>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {stockAvailable !== null && (
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-900">
          📦 Stok tersedia di lokasi asal:{' '}
          <strong>
            {stockAvailable.toLocaleString('id-ID')} {baseUnit?.unitName ?? 'unit'}
          </strong>
        </div>
      )}

      {productId && units.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-stone-700">
            Qty Transfer <span className="text-red-500">*</span>
          </label>
          <MixedUnitInput
            units={units}
            value={mixedRows}
            onChange={setMixedRows}
            baseUnitName={baseUnit?.unitName}
          />
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
          placeholder="Misal: refill display, restock pagi..."
          className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:border-kartini-green focus:ring-2 focus:ring-kartini-green/20 text-sm outline-none resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={
          submitting ||
          !productId ||
          !fromLocationId ||
          !toLocationId ||
          mixedRows.length === 0
        }
        className="px-6 h-11 rounded-lg bg-kartini-green hover:bg-kartini-green-dark text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Submit Transfer
      </button>
    </form>
  );
}
