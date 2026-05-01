'use client';

import { Plus, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface ProductUnitForInput {
  unitName: string;
  unitLevel: number;
  qtyInBaseUnit: number;
  isBaseUnit: boolean;
}

export interface MixedUnitRow {
  unitName: string;
  qty: number;
}

interface Props {
  units: ProductUnitForInput[];
  value: MixedUnitRow[];
  onChange: (rows: MixedUnitRow[]) => void;
  baseUnitName?: string;
}

export function MixedUnitInput({ units, value, onChange, baseUnitName }: Props) {
  const sortedUnits = [...units].sort((a, b) => a.unitLevel - b.unitLevel);
  const baseUnit = sortedUnits.find((u) => u.isBaseUnit);
  const baseUnitLabel = baseUnitName ?? baseUnit?.unitName ?? 'unit';

  const totalBase = value.reduce((acc, row) => {
    const unit = units.find((u) => u.unitName === row.unitName);
    if (!unit) return acc;
    return acc + row.qty * unit.qtyInBaseUnit;
  }, 0);

  function addRow() {
    const defaultUnit = sortedUnits[0]?.unitName ?? '';
    onChange([...value, { unitName: defaultUnit, qty: 0 }]);
  }

  function updateRow(index: number, field: 'unitName' | 'qty', val: string | number) {
    const newRows = value.map((row, i) =>
      i === index
        ? field === 'unitName'
          ? { ...row, unitName: String(val) }
          : { ...row, qty: Number(val) || 0 }
        : row,
    );
    onChange(newRows);
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      {value.length === 0 ? (
        <button
          type="button"
          onClick={addRow}
          className="w-full p-4 border-2 border-dashed border-stone-200 rounded-lg text-sm text-stone-500 hover:border-kartini-green hover:text-kartini-green transition flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Tambah qty
        </button>
      ) : (
        <>
          {value.map((row, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                type="number"
                min="0"
                step="any"
                value={row.qty || ''}
                onChange={(e) => updateRow(idx, 'qty', e.target.value)}
                placeholder="0"
                className="w-24 h-10 px-3 rounded-lg border border-stone-200 focus:border-kartini-green focus:ring-2 focus:ring-kartini-green/20 text-sm outline-none tabular-nums"
              />
              <Select
                value={row.unitName}
                onValueChange={(v) => updateRow(idx, 'unitName', v)}
              >
                <SelectTrigger className="flex-1 h-10">
                  <SelectValue placeholder="Pilih unit" />
                </SelectTrigger>
                <SelectContent>
                  {sortedUnits.map((u) => (
                    <SelectItem key={u.unitName} value={u.unitName}>
                      {u.unitName}
                      <span className="text-stone-400 text-xs ml-1">
                        (= {u.qtyInBaseUnit.toLocaleString('id-ID')} {baseUnitLabel})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="w-10 h-10 rounded-lg flex items-center justify-center text-stone-400 hover:text-red-600 hover:bg-red-50 transition"
                aria-label="Hapus baris"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addRow}
            className="text-sm text-kartini-green hover:text-kartini-green-dark font-medium flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah baris
          </button>
        </>
      )}

      {totalBase > 0 && (
        <div className="mt-3 p-3 rounded-lg bg-kartini-green-light border border-kartini-green/20">
          <div className="text-xs text-stone-600">Total dalam unit terkecil:</div>
          <div className="font-bold text-stone-900 tabular-nums">
            {totalBase.toLocaleString('id-ID')} {baseUnitLabel}
          </div>
        </div>
      )}
    </div>
  );
}
