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
import { createPurchaseIn } from '@/lib/inventory/movement-actions';

interface Location {
  id: string;
  name: string;
  code: string;
}

interface Supplier {
  id: string;
  name: string;
}

export function PurchaseForm({
  locations,
  suppliers,
}: {
  locations: Location[];
  suppliers: Supplier[];
}) {
  const [productId, setProductId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [units, setUnits] = useState<ProductUnitForInput[]>([]);
  const [mixedRows, setMixedRows] = useState<MixedUnitRow[]>([]);
  const [hppPerBase, setHppPerBase] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
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
    if (!productId) return toast.error('Pilih produk');
    if (!locationId) return toast.error('Pilih lokasi penerimaan');
    if (mixedRows.length === 0 || mixedRows.every((r) => r.qty === 0)) {
      return toast.error('Isi qty');
    }

    setSubmitting(true);
    const result = await createPurchaseIn({
      productId,
      locationId,
      supplierId: supplierId || undefined,
      mixed: mixedRows.filter((r) => r.qty > 0),
      hppPerBase: hppPerBase ? parseFloat(hppPerBase) : undefined,
      invoiceRef: invoiceRef.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setSubmitting(false);

    if (result.ok) {
      toast.success(
        `Pembelian masuk berhasil (${result.totalBase.toLocaleString('id-ID')} unit terkecil)`,
      );
      setProductId('');
      setMixedRows([]);
      setHppPerBase('');
      setInvoiceRef('');
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-stone-700">
            Lokasi Penerimaan <span className="text-red-500">*</span>
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

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-stone-700">
            Supplier <span className="text-stone-400 font-normal">(opsional)</span>
          </label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="Pilih supplier..." />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {productId && units.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-stone-700">
            Qty Diterima <span className="text-red-500">*</span>
          </label>
          <MixedUnitInput
            units={units}
            value={mixedRows}
            onChange={setMixedRows}
            baseUnitName={baseUnit?.unitName}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-stone-700">
            HPP per {baseUnit?.unitName ?? 'unit terkecil'}{' '}
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
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-stone-700">
            No. Invoice / Ref{' '}
            <span className="text-stone-400 font-normal">(opsional)</span>
          </label>
          <input
            type="text"
            value={invoiceRef}
            onChange={(e) => setInvoiceRef(e.target.value)}
            placeholder="INV-2026-001"
            className="w-full h-10 px-3 rounded-lg border border-stone-200 focus:border-kartini-green focus:ring-2 focus:ring-kartini-green/20 text-sm outline-none"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-stone-700">
          Catatan <span className="text-stone-400 font-normal">(opsional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Misal: pembelian rutin mingguan..."
          className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:border-kartini-green focus:ring-2 focus:ring-kartini-green/20 text-sm outline-none resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={submitting || !productId || !locationId || mixedRows.length === 0}
        className="px-6 h-11 rounded-lg bg-kartini-green hover:bg-kartini-green-dark text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Simpan Pembelian
      </button>
    </form>
  );
}
