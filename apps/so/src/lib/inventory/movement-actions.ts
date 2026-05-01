'use server';

import { db, stockBalances, stockMovements, products, productUnits } from '@kartini/db';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { createId } from '@paralleldrive/cuid2';
import { requireAuth, requireRole } from '@/lib/session';
import {
  getProductUnitsForProduct,
  convertMixedToBaseUnit,
  type MixedUnitInput,
} from './unit-conversion';

type MovementType =
  | 'OPENING_BALANCE'
  | 'PURCHASE_IN'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'SALE_OUT'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'WASTE';

interface CreateMovementInput {
  productId: string;
  locationId: string;
  movementType: MovementType;
  qtyInBase: number;
  unitNameUsed: string;
  qtyInUnitUsed: number;
  hppAtMovement?: number;
  referenceMovementId?: string;
  sourceType?: string;
  sourceId?: string;
  notes?: string;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Atomic insert movement + upsert balance. Validates non-negative for non-OPENING.
async function applyMovementInTx(
  tx: Tx,
  input: CreateMovementInput,
  userId: string,
): Promise<string> {
  const movementId = createId();

  await tx.insert(stockMovements).values({
    id: movementId,
    productId: input.productId,
    locationId: input.locationId,
    movementType: input.movementType,
    qtyInBase: input.qtyInBase.toString(),
    unitNameUsed: input.unitNameUsed,
    qtyInUnitUsed: input.qtyInUnitUsed.toString(),
    hppAtMovement: input.hppAtMovement?.toString(),
    totalValueRp: input.hppAtMovement
      ? (Math.abs(input.qtyInBase) * input.hppAtMovement).toString()
      : null,
    referenceMovementId: input.referenceMovementId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    notes: input.notes,
    createdBy: userId,
  });

  const [existing] = await tx
    .select()
    .from(stockBalances)
    .where(
      and(
        eq(stockBalances.productId, input.productId),
        eq(stockBalances.locationId, input.locationId),
      ),
    )
    .limit(1);

  if (existing) {
    const newQty = Number(existing.qtyInBase) + input.qtyInBase;
    if (newQty < 0 && input.movementType !== 'OPENING_BALANCE') {
      throw new Error(
        `Stok tidak cukup. Stok saat ini: ${existing.qtyInBase}, dikurangi ${Math.abs(input.qtyInBase)}, hasilnya negatif.`,
      );
    }
    await tx
      .update(stockBalances)
      .set({
        qtyInBase: newQty.toString(),
        avgHpp: input.hppAtMovement?.toString() ?? existing.avgHpp,
        lastMovementAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(stockBalances.id, existing.id));
  } else {
    if (input.qtyInBase < 0) {
      throw new Error('Stok di lokasi tujuan masih 0, tidak bisa dikurangi.');
    }
    await tx.insert(stockBalances).values({
      id: createId(),
      productId: input.productId,
      locationId: input.locationId,
      qtyInBase: input.qtyInBase.toString(),
      avgHpp: input.hppAtMovement?.toString() ?? null,
      lastMovementAt: new Date(),
    });
  }

  return movementId;
}

function revalidateInventoryPaths() {
  revalidatePath('/inventory');
  revalidatePath('/movements');
  revalidatePath('/movements/history');
  revalidatePath('/dashboard');
}

// 1. OPENING BALANCE — OWNER only
export async function createOpeningBalance(input: {
  productId: string;
  locationId: string;
  mixed: MixedUnitInput[];
  hppPerBase?: number;
  notes?: string;
}) {
  const user = await requireRole(['OWNER']);

  if (input.mixed.length === 0) {
    return { ok: false as const, error: 'Mohon isi minimal 1 unit dengan qty > 0' };
  }

  try {
    const units = await getProductUnitsForProduct(input.productId);
    if (units.length === 0) {
      return { ok: false as const, error: 'Produk ini belum punya konfigurasi unit' };
    }

    const { totalBase, breakdown } = convertMixedToBaseUnit(input.mixed, units);
    if (totalBase <= 0) {
      return { ok: false as const, error: 'Total qty harus > 0' };
    }

    const breakdownStr = breakdown.map((b) => `${b.qty} ${b.unitName}`).join(' + ');
    const movementId = await db.transaction(async (tx) =>
      applyMovementInTx(
        tx,
        {
          productId: input.productId,
          locationId: input.locationId,
          movementType: 'OPENING_BALANCE',
          qtyInBase: totalBase,
          unitNameUsed: breakdownStr,
          qtyInUnitUsed: totalBase,
          hppAtMovement: input.hppPerBase,
          notes: input.notes ?? `Opening balance: ${breakdownStr}`,
        },
        user.id,
      ),
    );

    revalidateInventoryPaths();
    return { ok: true as const, movementId, totalBase };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// 2. TRANSFER — auto-commit, all roles
export async function createTransfer(input: {
  productId: string;
  fromLocationId: string;
  toLocationId: string;
  mixed: MixedUnitInput[];
  notes?: string;
}) {
  const user = await requireAuth();

  if (input.fromLocationId === input.toLocationId) {
    return { ok: false as const, error: 'Lokasi asal dan tujuan tidak boleh sama' };
  }
  if (input.mixed.length === 0) {
    return { ok: false as const, error: 'Mohon isi minimal 1 unit dengan qty > 0' };
  }

  try {
    const units = await getProductUnitsForProduct(input.productId);
    if (units.length === 0) {
      return { ok: false as const, error: 'Produk ini belum punya konfigurasi unit' };
    }

    const { totalBase, breakdown } = convertMixedToBaseUnit(input.mixed, units);
    if (totalBase <= 0) {
      return { ok: false as const, error: 'Total qty harus > 0' };
    }
    const breakdownStr = breakdown.map((b) => `${b.qty} ${b.unitName}`).join(' + ');

    // HPP per base: prefer currentAvgHpp; fallback ke hppPerL1 / qtyInBaseUnit unit level 1
    const [product] = await db
      .select({
        hppPerL1: products.hppPerL1,
        currentAvgHpp: products.currentAvgHpp,
      })
      .from(products)
      .where(eq(products.id, input.productId));

    const l1Unit = units.find((u) => u.unitLevel === 1);
    const hpp = product?.currentAvgHpp
      ? Number(product.currentAvgHpp)
      : product?.hppPerL1 && l1Unit
        ? Number(product.hppPerL1) / l1Unit.qtyInBaseUnit
        : undefined;

    const transferGroupId = createId();

    const result = await db.transaction(async (tx) => {
      const outId = await applyMovementInTx(
        tx,
        {
          productId: input.productId,
          locationId: input.fromLocationId,
          movementType: 'TRANSFER_OUT',
          qtyInBase: -totalBase,
          unitNameUsed: breakdownStr,
          qtyInUnitUsed: totalBase,
          hppAtMovement: hpp,
          referenceMovementId: transferGroupId,
          sourceType: 'TRANSFER',
          sourceId: transferGroupId,
          notes: input.notes ?? 'Transfer keluar',
        },
        user.id,
      );

      const inId = await applyMovementInTx(
        tx,
        {
          productId: input.productId,
          locationId: input.toLocationId,
          movementType: 'TRANSFER_IN',
          qtyInBase: totalBase,
          unitNameUsed: breakdownStr,
          qtyInUnitUsed: totalBase,
          hppAtMovement: hpp,
          referenceMovementId: outId,
          sourceType: 'TRANSFER',
          sourceId: transferGroupId,
          notes: input.notes ?? 'Transfer masuk',
        },
        user.id,
      );

      return { outId, inId };
    });

    revalidateInventoryPaths();
    return {
      ok: true as const,
      transferId: transferGroupId,
      totalBase,
      outId: result.outId,
      inId: result.inId,
    };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// 3. PURCHASE IN — OWNER/ADMIN/SUPERVISOR
export async function createPurchaseIn(input: {
  productId: string;
  locationId: string;
  supplierId?: string;
  mixed: MixedUnitInput[];
  hppPerBase?: number;
  invoiceRef?: string;
  notes?: string;
}) {
  const user = await requireRole(['OWNER', 'ADMIN', 'SUPERVISOR']);

  if (input.mixed.length === 0) {
    return { ok: false as const, error: 'Mohon isi minimal 1 unit dengan qty > 0' };
  }

  try {
    const units = await getProductUnitsForProduct(input.productId);
    if (units.length === 0) {
      return { ok: false as const, error: 'Produk ini belum punya konfigurasi unit' };
    }

    const { totalBase, breakdown } = convertMixedToBaseUnit(input.mixed, units);
    if (totalBase <= 0) {
      return { ok: false as const, error: 'Total qty harus > 0' };
    }
    const breakdownStr = breakdown.map((b) => `${b.qty} ${b.unitName}`).join(' + ');

    const movementId = await db.transaction(async (tx) =>
      applyMovementInTx(
        tx,
        {
          productId: input.productId,
          locationId: input.locationId,
          movementType: 'PURCHASE_IN',
          qtyInBase: totalBase,
          unitNameUsed: breakdownStr,
          qtyInUnitUsed: totalBase,
          hppAtMovement: input.hppPerBase,
          sourceType: 'PURCHASE',
          sourceId: input.invoiceRef ?? input.supplierId,
          notes:
            input.notes ??
            `Pembelian (ref: ${input.invoiceRef ?? '-'}, supplier: ${input.supplierId ?? '-'})`,
        },
        user.id,
      ),
    );

    revalidateInventoryPaths();
    return { ok: true as const, movementId, totalBase };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// 4. ADJUSTMENT — OWNER/ADMIN/SUPERVISOR (auto-commit at this stage)
export async function createAdjustment(input: {
  productId: string;
  locationId: string;
  adjustmentType: 'INCREASE' | 'DECREASE' | 'WASTE';
  mixed: MixedUnitInput[];
  reason: string;
}) {
  const user = await requireRole(['OWNER', 'ADMIN', 'SUPERVISOR']);

  if (!input.reason || input.reason.trim().length < 5) {
    return { ok: false as const, error: 'Alasan adjustment wajib diisi (minimal 5 karakter)' };
  }
  if (input.mixed.length === 0) {
    return { ok: false as const, error: 'Mohon isi minimal 1 unit dengan qty > 0' };
  }

  try {
    const units = await getProductUnitsForProduct(input.productId);
    if (units.length === 0) {
      return { ok: false as const, error: 'Produk ini belum punya konfigurasi unit' };
    }

    const { totalBase, breakdown } = convertMixedToBaseUnit(input.mixed, units);
    if (totalBase <= 0) {
      return { ok: false as const, error: 'Total qty harus > 0' };
    }
    const breakdownStr = breakdown.map((b) => `${b.qty} ${b.unitName}`).join(' + ');

    const movementType: MovementType =
      input.adjustmentType === 'WASTE'
        ? 'WASTE'
        : input.adjustmentType === 'INCREASE'
          ? 'ADJUSTMENT_IN'
          : 'ADJUSTMENT_OUT';

    const signedQty = movementType === 'ADJUSTMENT_IN' ? totalBase : -totalBase;

    const movementId = await db.transaction(async (tx) =>
      applyMovementInTx(
        tx,
        {
          productId: input.productId,
          locationId: input.locationId,
          movementType,
          qtyInBase: signedQty,
          unitNameUsed: breakdownStr,
          qtyInUnitUsed: totalBase,
          notes: `${movementType}: ${input.reason.trim()}`,
        },
        user.id,
      ),
    );

    revalidateInventoryPaths();
    return { ok: true as const, movementId, totalBase, movementType };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// Suppress unused warning — productUnits is re-exported indirectly via unit-conversion.
void productUnits;
