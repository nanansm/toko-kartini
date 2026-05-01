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
import { createAdjustment } from '@/lib/inventory/movement-actions';

interface Location {
  id: string;
  name: string;
  code: string;
}

type AdjustmentType = 'INCREASE' | 'DECREASE' | 'WASTE';

const ADJUSTMENT_LABELS: Record<AdjustmentType, { label: string; hint: string }> = {
  INCREASE: { label: 'Adjustment + (Tambah)', hint: 'Stok bertambah karena temuan, retur, dll' },
  DECREASE: { label: 'Adjustment - (Kurang)', hint: 'Stok berkurang karena hilang, salah catat' },
  WASTE: { label: 'Waste (Rusak / Kadaluarsa)', hint: 'Barang rusak atau expired' },
};

export function AdjustmentForm({ locations }: { locations: Location[] }) {
  const [productId, setProductId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('DECREASE');
  const [units, setUnits] = useState<ProductUnitForInput[]>([]);
  const [mixedRows, setMixedRows] = useState<MixedUnitRow[]>([]);
  const [reason, setReason] = useState('');
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
    if (!locationId) return toast.error('Pilih lokasi');
    if (mixedRows.length === 0 || mixedRows.every((r) => r.qty === 0)) {
      return toast.error('Isi qty');
    }
    if (reason.trim().length < 5) return toast.error('Alasan minimal 5 karakter');

    setSubmitting(true);
    const result = await createAdjustment({
      productId,
      locationId,
      adjustmentType,
      mixed: mixedRows.filter((r) => r.qty > 0),
      reason: reason.trim(),
    });
    setSubmitting(false);

    if (result.ok) {
      toast.success(
        `Adjustment tersimpan (${result.totalBase.toLocaleString('id-ID')} unit terkecil, tipe ${result.movementType})`,
      );
      setProductId('');
      setMixedRows([]);
      setReason('');
    } else {
      toast.error(result.error ?? 'Gagal');
    }
  }

  const baseUnit = units.find((u) => u.isBaseUnit);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-stone-700">
          Tipe Adjustment <span className="text-red-500">*</span>
        </label>
        <Select
          value={adjustmentType}
          onValueChange={(v) => setAdjustmentType(v as AdjustmentType)}
        >
          <SelectTrigger className="h-10 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ADJUSTMENT_LABELS) as AdjustmentType[]).map((t) => (
              <SelectItem key={t} value={t}>
                {ADJUSTMENT_LABELS[t].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-stone-400">{ADJUSTMENT_LABELS[adjustmentType].hint}</p>
      </div>

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
            Qty <span className="text-red-500">*</span>
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
          Alasan <span className="text-red-500">*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Misal: Tepung kena bocor air hujan, kena tikus, salah hitung SO sebelumnya..."
          required
          minLength={5}
          className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:border-kartini-green focus:ring-2 focus:ring-kartini-green/20 text-sm outline-none resize-none"
        />
        <p className="text-xs text-stone-400">Minimal 5 karakter. Wajib untuk audit.</p>
      </div>

      <button
        type="submit"
        disabled={
          submitting || !productId || !locationId || mixedRows.length === 0 || reason.trim().length < 5
        }
        className="px-6 h-11 rounded-lg bg-kartini-green hover:bg-kartini-green-dark text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Simpan Adjustment
      </button>
    </form>
  );
}
