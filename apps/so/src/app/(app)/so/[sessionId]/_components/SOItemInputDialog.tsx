'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MixedUnitInput,
  type MixedUnitRow,
  type ProductUnitForInput,
} from '@/components/inventory/MixedUnitInput';
import { inputSOItemQty } from '@/lib/inventory/so-actions';
import type { SOItem } from './SOItemList';

interface Props {
  item: SOItem;
  sessionId: string;
  onClose: () => void;
}

export function SOItemInputDialog({ item, onClose }: Props) {
  const router = useRouter();
  const [units, setUnits] = useState<ProductUnitForInput[]>([]);
  const [mixedRows, setMixedRows] = useState<MixedUnitRow[]>([]);
  const [notes, setNotes] = useState(item.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(true);

  useEffect(() => {
    setLoadingUnits(true);
    fetch(`/api/products/${item.productId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.units) {
          setUnits(data.units);
          if (item.qtyPhysicalBase) {
            const baseUnit = data.units.find((u: ProductUnitForInput) => u.isBaseUnit);
            if (baseUnit) {
              setMixedRows([
                { unitName: baseUnit.unitName, qty: Number(item.qtyPhysicalBase) },
              ]);
            }
          }
        }
      })
      .finally(() => setLoadingUnits(false));
  }, [item.productId, item.qtyPhysicalBase]);

  async function handleSubmit() {
    if (mixedRows.length === 0 || mixedRows.every((r) => r.qty === 0)) {
      toast.error('Isi qty fisik');
      return;
    }

    setSubmitting(true);
    const result = await inputSOItemQty({
      itemId: item.id,
      mixed: mixedRows.filter((r) => r.qty > 0),
      notes: notes.trim() || undefined,
    });
    setSubmitting(false);

    if (result.ok) {
      if (result.needsRecount) {
        toast.warning(
          `Selisih ${result.diffPercent}% terlalu besar. Silakan hitung ulang.`,
        );
      } else {
        toast.success(
          `Tersimpan. Selisih: ${result.diff > 0 ? '+' : ''}${result.diff} (${result.diffPercent}%)`,
        );
      }
      router.refresh();
      onClose();
    } else {
      toast.error(result.error ?? 'Gagal');
    }
  }

  const baseUnit = units.find((u) => u.isBaseUnit);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{item.productName}</DialogTitle>
          <DialogDescription className="text-xs">
            Stok sistem:{' '}
            <span className="font-semibold tabular-nums">
              {Number(item.qtySystemBase).toLocaleString('id-ID')}{' '}
              {baseUnit?.unitName ?? 'unit'}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">
              Qty Fisik <span className="text-red-500">*</span>
            </label>
            {loadingUnits ? (
              <div className="text-xs text-stone-400 py-2">Memuat unit...</div>
            ) : (
              <MixedUnitInput
                units={units}
                value={mixedRows}
                onChange={setMixedRows}
                baseUnitName={baseUnit?.unitName}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">
              Catatan <span className="text-stone-400 font-normal">(opsional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Misal: ada barang rusak..."
              className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm outline-none focus:border-kartini-green focus:ring-2 focus:ring-kartini-green/20 resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || mixedRows.length === 0 || loadingUnits}
            className="h-10 px-4 rounded-lg bg-kartini-green hover:bg-kartini-green-dark text-white font-semibold text-sm disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Simpan
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
