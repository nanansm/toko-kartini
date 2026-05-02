'use server';

import {
  db,
  olseraImportLogs,
  olseraImportStaging,
  stockMovements,
  stockBalances,
  products,
} from '@kartini/db';
import { eq, and, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { createId } from '@paralleldrive/cuid2';
import crypto from 'crypto';
import { requireRole } from '@/lib/session';
import { getOlseraDefaultLocation } from './settings';

// Tipe baris Olsera longgar — key-nya sudah dinormalisasi (lowercase, trimmed) di sisi client.
export interface OlseraRow {
  [key: string]: string | number | null | undefined;
}

interface PreviewResult {
  totalRows: number;
  movementsCreated: number;
  rowsSkipped: number;
  rowsError: number;
  totalValueRp: number;
  importLogId: string;
  errors?: string[];
  duplicates?: number;
}

function pick(row: OlseraRow, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v).trim();
    }
  }
  return '';
}

function pickNum(row: OlseraRow, keys: string[]): number {
  const v = pick(row, keys);
  if (!v) return 0;
  // Toleransi pemisah ribuan dari Excel (1.234,56 → 1234.56)
  const cleaned = v.replace(/\./g, '').replace(/,/g, '.').replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  return isFinite(n) ? n : 0;
}

export async function previewOlseraImport(input: {
  fileName: string;
  fileSize: number;
  rows: OlseraRow[];
}) {
  const user = await requireRole(['OWNER', 'ADMIN']);

  try {
    const importLogId = createId();
    const fileMd5 = crypto
      .createHash('md5')
      .update(JSON.stringify(input.rows))
      .digest('hex');

    const defaultLocationId = await getOlseraDefaultLocation();

    // Index produk berdasarkan olsera_sku dan name (case-insensitive)
    const allProducts = await db
      .select({
        id: products.id,
        name: products.name,
        olseraSku: products.olseraSku,
        currentAvgHpp: products.currentAvgHpp,
        hppPerL1: products.hppPerL1,
      })
      .from(products);

    const skuMap = new Map<string, (typeof allProducts)[number]>();
    const nameMap = new Map<string, (typeof allProducts)[number]>();
    for (const p of allProducts) {
      if (p.olseraSku) skuMap.set(p.olseraSku.toLowerCase(), p);
      nameMap.set(p.name.toLowerCase(), p);
    }

    // Cek duplicate: sourceId yang sudah pernah di-commit dari Olsera
    const existingMovements = await db
      .select({ sourceId: stockMovements.sourceId })
      .from(stockMovements)
      .where(eq(stockMovements.sourceType, 'OLSERA_SALES'));
    const existingKeys = new Set<string>(
      existingMovements
        .map((m) => m.sourceId)
        .filter((s): s is string => !!s),
    );

    let movementsCreated = 0;
    let rowsSkipped = 0;
    let rowsError = 0;
    let totalValueRp = 0;
    const errors: string[] = [];
    const seenInBatch = new Set<string>();
    const stagingRows: Array<typeof olseraImportStaging.$inferInsert> = [];

    for (let i = 0; i < input.rows.length; i++) {
      const row = input.rows[i]!;
      const orderNo = pick(row, ['order no', 'order_no', 'orderno', 'no order', 'no']);
      if (!orderNo) {
        rowsError++;
        if (errors.length < 10)
          errors.push(`Row ${i + 1}: tanpa order no`);
        continue;
      }

      const itemName = pick(row, ['item name', 'item_name', 'product name', 'name']);
      const itemCode = pick(row, ['item code', 'item_code', 'sku', 'product code']);
      const qty = pickNum(row, ['qty', 'quantity', 'jumlah']);
      const amount = pickNum(row, ['amount', 'total', 'subtotal']);
      const cost = pickNum(row, ['total cost', 'cost', 'hpp']);

      if (qty <= 0) {
        rowsSkipped++;
        continue;
      }

      // Find product by SKU first, then name
      let product: (typeof allProducts)[number] | undefined;
      if (itemCode) product = skuMap.get(itemCode.toLowerCase());
      if (!product && itemName) product = nameMap.get(itemName.toLowerCase());

      if (!product) {
        rowsError++;
        if (errors.length < 10) {
          errors.push(`Row ${i + 1}: produk tidak ditemukan ("${itemName}" / ${itemCode})`);
        }
        continue;
      }

      // Dedupe key: orderNo + productId
      const dupKey = `${orderNo}-${product.id}`;
      if (existingKeys.has(orderNo) || seenInBatch.has(dupKey)) {
        rowsSkipped++;
        continue;
      }
      seenInBatch.add(dupKey);

      // HPP fallback: cost dari file → product.currentAvgHpp → null
      const hppPerUnit =
        cost > 0 && qty > 0
          ? cost / qty
          : product.currentAvgHpp
            ? Number(product.currentAvgHpp)
            : null;
      const totalValue = amount > 0 ? amount : qty * (hppPerUnit ?? 0);

      stagingRows.push({
        id: createId(),
        importLogId,
        rowIndex: i,
        orderNo,
        productId: product.id,
        locationId: defaultLocationId,
        qtyInBase: qty.toString(),
        unitNameUsed: 'OLSERA_SALES',
        qtyInUnitUsed: qty.toString(),
        hppAtMovement: hppPerUnit !== null ? hppPerUnit.toString() : null,
        totalValueRp: totalValue.toString(),
        rawRow: JSON.stringify(row).slice(0, 500),
      });

      totalValueRp += totalValue;
      movementsCreated++;
    }

    // Insert log + staging atomically
    await db.transaction(async (tx) => {
      await tx.insert(olseraImportLogs).values({
        id: importLogId,
        fileName: input.fileName,
        fileSize: input.fileSize,
        fileMd5,
        totalRows: input.rows.length,
        movementsCreated,
        rowsSkipped,
        rowsError,
        totalValueRp: totalValueRp.toString(),
        status: 'PREVIEW',
        uploadedBy: user.id,
      });

      // Bulk insert staging rows
      const chunkSize = 500;
      for (let i = 0; i < stagingRows.length; i += chunkSize) {
        await tx.insert(olseraImportStaging).values(stagingRows.slice(i, i + chunkSize));
      }
    });

    revalidatePath('/olsera-import');
    const preview: PreviewResult = {
      totalRows: input.rows.length,
      movementsCreated,
      rowsSkipped,
      rowsError,
      totalValueRp,
      importLogId,
      errors: errors.length > 0 ? errors : undefined,
    };
    return { ok: true as const, preview };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : 'Unknown',
    };
  }
}

export async function commitOlseraImport(input: { importLogId: string }) {
  const user = await requireRole(['OWNER', 'ADMIN']);

  try {
    const result = await db.transaction(async (tx) => {
      const [log] = await tx
        .select()
        .from(olseraImportLogs)
        .where(eq(olseraImportLogs.id, input.importLogId));

      if (!log) throw new Error('Import log tidak ditemukan');
      if (log.status !== 'PREVIEW') {
        throw new Error(`Status import sudah ${log.status}, tidak bisa commit lagi`);
      }

      const staging = await tx
        .select()
        .from(olseraImportStaging)
        .where(eq(olseraImportStaging.importLogId, input.importLogId));

      if (staging.length === 0) {
        throw new Error('Staging kosong, tidak ada yang dicommit');
      }

      // Pre-fetch existing balances for all (productId, locationId) pairs
      const productIds = Array.from(new Set(staging.map((s) => s.productId)));
      const balances = await tx
        .select()
        .from(stockBalances)
        .where(
          and(
            inArray(stockBalances.productId, productIds),
            eq(stockBalances.locationId, staging[0]!.locationId),
          ),
        );
      const balanceByProduct = new Map(balances.map((b) => [b.productId, b]));
      const newQtyByProduct = new Map<string, number>();
      for (const b of balances) {
        newQtyByProduct.set(b.productId, Number(b.qtyInBase));
      }

      let committedCount = 0;
      for (const row of staging) {
        const qtySigned = -Number(row.qtyInBase); // SALE_OUT mengurangi stok
        const movementId = createId();

        await tx.insert(stockMovements).values({
          id: movementId,
          productId: row.productId,
          locationId: row.locationId,
          movementType: 'SALE_OUT',
          qtyInBase: qtySigned.toString(),
          unitNameUsed: row.unitNameUsed,
          qtyInUnitUsed: row.qtyInUnitUsed,
          hppAtMovement: row.hppAtMovement,
          totalValueRp: row.totalValueRp,
          sourceType: 'OLSERA_SALES',
          sourceId: row.orderNo,
          notes: `Olsera sales import (log ${input.importLogId})`,
          createdBy: user.id,
        });

        // Update balance (allow negative, sales bisa lebih dari stok kalau master belum sync)
        const existing = balanceByProduct.get(row.productId);
        const currentQty =
          newQtyByProduct.get(row.productId) ??
          (existing ? Number(existing.qtyInBase) : 0);
        const nextQty = currentQty + qtySigned;
        newQtyByProduct.set(row.productId, nextQty);

        if (existing) {
          await tx
            .update(stockBalances)
            .set({
              qtyInBase: nextQty.toString(),
              lastMovementAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(stockBalances.id, existing.id));
        } else {
          // Buat balance baru meski negatif (data Olsera authoritative untuk tracking)
          const newId = createId();
          await tx.insert(stockBalances).values({
            id: newId,
            productId: row.productId,
            locationId: row.locationId,
            qtyInBase: nextQty.toString(),
            avgHpp: row.hppAtMovement,
            lastMovementAt: new Date(),
          });
          balanceByProduct.set(row.productId, {
            id: newId,
            productId: row.productId,
            locationId: row.locationId,
            qtyInBase: nextQty.toString(),
            avgHpp: row.hppAtMovement,
            lastMovementAt: new Date(),
            lastCountedAt: null,
            updatedAt: new Date(),
          });
        }

        committedCount++;
      }

      // Mark log as COMMITTED
      await tx
        .update(olseraImportLogs)
        .set({
          status: 'COMMITTED',
          committedBy: user.id,
          committedAt: new Date(),
        })
        .where(eq(olseraImportLogs.id, input.importLogId));

      // Cleanup staging untuk hemat space
      await tx
        .delete(olseraImportStaging)
        .where(eq(olseraImportStaging.importLogId, input.importLogId));

      return { committedCount };
    });

    revalidatePath('/olsera-import');
    revalidatePath('/inventory');
    revalidatePath('/movements');
    revalidatePath('/movements/history');
    revalidatePath('/dashboard');
    return { ok: true as const, committedCount: result.committedCount };
  } catch (err) {
    // Mark FAILED kalau commit gagal
    try {
      await db
        .update(olseraImportLogs)
        .set({
          status: 'FAILED',
          errorMessage: err instanceof Error ? err.message : 'Unknown',
        })
        .where(eq(olseraImportLogs.id, input.importLogId));
    } catch {
      // ignore
    }
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : 'Unknown',
    };
  }
}

export async function cancelOlseraImport(input: { importLogId: string }) {
  await requireRole(['OWNER', 'ADMIN']);

  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(olseraImportStaging)
        .where(eq(olseraImportStaging.importLogId, input.importLogId));
      await tx
        .update(olseraImportLogs)
        .set({ status: 'CANCELLED' })
        .where(eq(olseraImportLogs.id, input.importLogId));
    });
    revalidatePath('/olsera-import');
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : 'Unknown' };
  }
}
