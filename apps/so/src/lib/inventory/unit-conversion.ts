import { db, productUnits } from '@kartini/db';
import { eq, asc } from 'drizzle-orm';

export interface ProductUnit {
  id: string;
  productId: string;
  unitName: string;
  unitLevel: number;
  qtyInBaseUnit: number;
  isBaseUnit: boolean;
  isDefaultPurchase: boolean;
  isDefaultSell: boolean;
}

export interface MixedUnitInput {
  unitName: string;
  qty: number;
}

export async function getProductUnitsForProduct(productId: string): Promise<ProductUnit[]> {
  const rows = await db
    .select()
    .from(productUnits)
    .where(eq(productUnits.productId, productId))
    .orderBy(asc(productUnits.unitLevel));

  return rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    unitName: r.unitName,
    unitLevel: r.unitLevel,
    qtyInBaseUnit: Number(r.qtyInBaseUnit),
    isBaseUnit: r.isBaseUnit,
    isDefaultPurchase: r.isDefaultPurchase,
    isDefaultSell: r.isDefaultSell,
  }));
}

// Convert mixed input ke total dalam BASE UNIT.
// Throws kalau unitName tidak ada di units.
export function convertMixedToBaseUnit(
  mixed: MixedUnitInput[],
  units: ProductUnit[],
): {
  totalBase: number;
  breakdown: Array<{ unitName: string; qty: number; equivalentBase: number }>;
} {
  let totalBase = 0;
  const breakdown: Array<{ unitName: string; qty: number; equivalentBase: number }> = [];

  for (const item of mixed) {
    if (!item.unitName || item.qty <= 0) continue;
    const unit = units.find((u) => u.unitName === item.unitName);
    if (!unit) {
      throw new Error(`Unit "${item.unitName}" tidak ditemukan untuk produk ini`);
    }
    const equivalentBase = item.qty * unit.qtyInBaseUnit;
    totalBase += equivalentBase;
    breakdown.push({ unitName: item.unitName, qty: item.qty, equivalentBase });
  }

  return { totalBase, breakdown };
}

// Format base qty ke breakdown readable: "2 Bal + 3 Pack"
export function formatBaseUnitToReadable(
  baseQty: number,
  units: ProductUnit[],
): { display: string; breakdown: Array<{ unitName: string; qty: number }> } {
  if (baseQty === 0) {
    const baseUnit = units.find((u) => u.isBaseUnit);
    return { display: `0 ${baseUnit?.unitName ?? ''}`.trim(), breakdown: [] };
  }

  const sorted = [...units].sort((a, b) => b.qtyInBaseUnit - a.qtyInBaseUnit);
  const breakdown: Array<{ unitName: string; qty: number }> = [];
  let remaining = baseQty;

  for (const unit of sorted) {
    const qty = Math.floor(remaining / unit.qtyInBaseUnit);
    if (qty > 0) {
      breakdown.push({ unitName: unit.unitName, qty });
      remaining -= qty * unit.qtyInBaseUnit;
    }
  }

  if (remaining > 0 && sorted.length > 0) {
    const baseUnit = sorted[sorted.length - 1]!;
    breakdown.push({ unitName: baseUnit.unitName, qty: remaining });
  }

  const display = breakdown
    .map((b) => `${b.qty.toLocaleString('id-ID')} ${b.unitName}`)
    .join(' + ');

  return { display, breakdown };
}

// Tampilkan dalam unit terbesar yang qty >= 1, dengan desimal.
export function formatBaseToLargestUnit(baseQty: number, units: ProductUnit[]): string {
  if (units.length === 0) return baseQty.toLocaleString('id-ID');
  if (baseQty === 0) {
    const baseUnit = units.find((u) => u.isBaseUnit);
    return `0 ${baseUnit?.unitName ?? ''}`.trim();
  }

  const sorted = [...units].sort((a, b) => b.qtyInBaseUnit - a.qtyInBaseUnit);
  for (const unit of sorted) {
    const qty = baseQty / unit.qtyInBaseUnit;
    if (qty >= 1) {
      return `${qty.toLocaleString('id-ID', { maximumFractionDigits: 2 })} ${unit.unitName}`;
    }
  }

  const baseUnit = sorted[sorted.length - 1]!;
  return `${baseQty.toLocaleString('id-ID')} ${baseUnit.unitName}`;
}
