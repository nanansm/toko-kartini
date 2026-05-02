'use server';

import {
  db,
  stockCountSessions,
  stockCountItems,
  stockBalances,
  stockMovements,
  products,
} from '@kartini/db';
import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { createId } from '@paralleldrive/cuid2';
import { requireAuth, requireRole } from '@/lib/session';
import {
  getProductUnitsForProduct,
  convertMixedToBaseUnit,
  type MixedUnitInput,
} from './unit-conversion';
import { getSOThresholds, classifyItemStatus } from './settings';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const APPROVER_ROLES = ['OWNER', 'ADMIN', 'SUPERVISOR'] as const;

function revalidateSoPaths(sessionId?: string) {
  revalidatePath('/so');
  if (sessionId) revalidatePath(`/so/${sessionId}`);
  revalidatePath('/inventory');
  revalidatePath('/movements');
  revalidatePath('/movements/history');
  revalidatePath('/dashboard');
}

// ============================================
// 1. CREATE SO SESSION
// ============================================

export async function createSOSession(input: {
  type: 'HARIAN' | 'MINGGUAN' | 'BULANAN';
  locationId: string;
  scopeFilter?: { categoryL1?: string };
  notes?: string;
}) {
  const user = await requireAuth();

  try {
    const result = await db.transaction(async (tx) => {
      const sessionId = `SOS-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`;

      // Insert session header
      await tx.insert(stockCountSessions).values({
        id: sessionId,
        type: input.type,
        locationId: input.locationId,
        status: 'DRAFT',
        startedAt: new Date(),
        createdBy: user.id,
        notes: input.notes,
      });

      // Pre-populate items dari stock_balances + filter kategori (kalau cycle count)
      const balances = await tx
        .select({
          productId: stockBalances.productId,
          qtyInBase: stockBalances.qtyInBase,
          avgHpp: stockBalances.avgHpp,
        })
        .from(stockBalances)
        .innerJoin(products, eq(stockBalances.productId, products.id))
        .where(
          and(
            eq(stockBalances.locationId, input.locationId),
            input.scopeFilter?.categoryL1
              ? eq(products.categoryL1, input.scopeFilter.categoryL1)
              : sql`1=1`,
            eq(products.isActive, true),
          ),
        );

      if (balances.length === 0) {
        throw new Error(
          'Tidak ada produk dengan stok di lokasi ini. Buat opening balance dulu sebelum SO.',
        );
      }

      const itemsToInsert = balances.map((b) => ({
        id: createId(),
        sessionId,
        productId: b.productId,
        qtySystemBase: b.qtyInBase,
        hppAtCount: b.avgHpp,
        status: 'PENDING' as const,
      }));

      // Bulk insert in chunks supaya tidak kena limit query size
      const chunkSize = 500;
      for (let i = 0; i < itemsToInsert.length; i += chunkSize) {
        await tx.insert(stockCountItems).values(itemsToInsert.slice(i, i + chunkSize));
      }

      // Update header dengan total items
      await tx
        .update(stockCountSessions)
        .set({
          totalItemsCount: itemsToInsert.length,
          status: 'DRAFT',
        })
        .where(eq(stockCountSessions.id, sessionId));

      return { sessionId, itemCount: itemsToInsert.length };
    });

    revalidateSoPaths(result.sessionId);
    return { ok: true as const, sessionId: result.sessionId, itemCount: result.itemCount };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// ============================================
// 2. INPUT QTY FISIK PER ITEM
// ============================================

export async function inputSOItemQty(input: {
  itemId: string;
  mixed: MixedUnitInput[];
  notes?: string;
}) {
  const user = await requireAuth();

  if (input.mixed.length === 0) {
    return { ok: false as const, error: 'Mohon isi qty fisik' };
  }

  try {
    const thresholds = await getSOThresholds();

    const result = await db.transaction(async (tx) => {
      const [item] = await tx
        .select({
          id: stockCountItems.id,
          sessionId: stockCountItems.sessionId,
          productId: stockCountItems.productId,
          qtySystemBase: stockCountItems.qtySystemBase,
          hppAtCount: stockCountItems.hppAtCount,
          status: stockCountItems.status,
          recountCount: stockCountItems.recountCount,
        })
        .from(stockCountItems)
        .where(eq(stockCountItems.id, input.itemId));

      if (!item) throw new Error('SO item tidak ditemukan');

      const [session] = await tx
        .select({ status: stockCountSessions.status })
        .from(stockCountSessions)
        .where(eq(stockCountSessions.id, item.sessionId));

      if (!session) throw new Error('Session tidak ditemukan');
      if (!['DRAFT', 'IN_PROGRESS'].includes(session.status)) {
        throw new Error('Session sudah disubmit, qty tidak bisa diubah lagi');
      }

      const units = await getProductUnitsForProduct(item.productId);
      if (units.length === 0) {
        throw new Error('Produk ini belum punya konfigurasi unit');
      }
      const { totalBase } = convertMixedToBaseUnit(input.mixed, units);

      const qtySystem = Number(item.qtySystemBase);
      const diff = totalBase - qtySystem;
      const diffPercent =
        qtySystem === 0 ? (totalBase > 0 ? 100 : 0) : (diff / qtySystem) * 100;
      const hpp = Number(item.hppAtCount ?? 0);
      const diffValue = diff * hpp;

      const classification = classifyItemStatus(diffPercent, thresholds);
      const isRecount = item.status === 'NEEDS_RECOUNT' || item.status === 'COUNTED';
      const newStatus = classification === 'NEEDS_RECOUNT' ? 'NEEDS_RECOUNT' : 'COUNTED';

      await tx
        .update(stockCountItems)
        .set({
          qtyPhysicalInput: JSON.stringify(input.mixed),
          qtyPhysicalBase: totalBase.toString(),
          differenceBase: diff.toString(),
          differenceValueRp: diffValue.toString(),
          differencePercent: diffPercent.toString(),
          status: newStatus,
          isCounted: true,
          notes: input.notes,
          countedBy: user.id,
          countedAt: new Date(),
          recountCount: isRecount ? item.recountCount + 1 : item.recountCount,
          updatedAt: new Date(),
        })
        .where(eq(stockCountItems.id, input.itemId));

      // Promote DRAFT → IN_PROGRESS pada input pertama
      if (session.status === 'DRAFT') {
        await tx
          .update(stockCountSessions)
          .set({ status: 'IN_PROGRESS', updatedAt: new Date() })
          .where(eq(stockCountSessions.id, item.sessionId));
      }

      return {
        sessionId: item.sessionId,
        diff,
        diffPercent,
        classification,
      };
    });

    revalidateSoPaths(result.sessionId);
    return {
      ok: true as const,
      diff: result.diff,
      diffPercent: parseFloat(result.diffPercent.toFixed(2)),
      classification: result.classification,
      needsRecount: result.classification === 'NEEDS_RECOUNT',
    };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// ============================================
// 3. SUBMIT SESSION (DRAFT/IN_PROGRESS → SUBMITTED)
// ============================================

export async function submitSOSession(sessionId: string) {
  const user = await requireAuth();

  try {
    const thresholds = await getSOThresholds();

    const result = await db.transaction(async (tx) => {
      const [session] = await tx
        .select()
        .from(stockCountSessions)
        .where(eq(stockCountSessions.id, sessionId));

      if (!session) throw new Error('Session tidak ditemukan');
      if (!['DRAFT', 'IN_PROGRESS'].includes(session.status)) {
        throw new Error(`Session tidak bisa di-submit dari status ${session.status}`);
      }

      const items = await tx
        .select()
        .from(stockCountItems)
        .where(eq(stockCountItems.sessionId, sessionId));

      const pending = items.filter((i) => i.status === 'PENDING');
      const needsRecount = items.filter((i) => i.status === 'NEEDS_RECOUNT');

      if (pending.length > 0) {
        throw new Error(
          `Masih ada ${pending.length} item belum di-count. Lengkapi dulu sebelum submit.`,
        );
      }
      if (needsRecount.length > 0) {
        throw new Error(
          `${needsRecount.length} item perlu re-count (selisih > threshold). Hitung ulang dulu.`,
        );
      }

      // Re-classify item COUNTED → AUTO_APPROVED / PENDING_APPROVAL
      let autoApprovedCount = 0;
      let pendingApprovalCount = 0;
      const counted = items.filter((i) => i.status === 'COUNTED');

      for (const item of counted) {
        const diffPct = Number(item.differencePercent ?? 0);
        const cls = classifyItemStatus(diffPct, thresholds);

        if (cls === 'AUTO_APPROVED') {
          await tx
            .update(stockCountItems)
            .set({
              status: 'AUTO_APPROVED',
              approvedBy: 'SYSTEM',
              approvedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(stockCountItems.id, item.id));
          autoApprovedCount++;
        } else if (cls === 'PENDING_APPROVAL') {
          await tx
            .update(stockCountItems)
            .set({ status: 'PENDING_APPROVAL', updatedAt: new Date() })
            .where(eq(stockCountItems.id, item.id));
          pendingApprovalCount++;
        }
      }

      // Re-fetch items setelah update
      const refreshed = await tx
        .select()
        .from(stockCountItems)
        .where(eq(stockCountItems.sessionId, sessionId));

      const totalDiffValue = refreshed.reduce(
        (sum, i) => sum + Number(i.differenceValueRp ?? 0),
        0,
      );
      const totalValue = refreshed.reduce(
        (sum, i) =>
          sum + Number(i.qtyPhysicalBase ?? 0) * Number(i.hppAtCount ?? 0),
        0,
      );
      const totalDifferences = refreshed.filter(
        (i) => Number(i.differenceBase ?? 0) !== 0,
      ).length;

      await tx
        .update(stockCountSessions)
        .set({
          status: 'SUBMITTED',
          submittedAt: new Date(),
          submittedBy: user.id,
          totalDifferences,
          totalDifferenceValueRp: totalDiffValue.toString(),
          totalValueRp: totalValue.toString(),
          updatedAt: new Date(),
        })
        .where(eq(stockCountSessions.id, sessionId));

      // Auto-approve session kalau tidak ada PENDING_APPROVAL
      let autoFinalized: { adjustmentsCreated: number } | null = null;
      if (pendingApprovalCount === 0) {
        autoFinalized = await internalApproveSOSession(tx, sessionId, user.id);
      }

      return {
        autoApprovedCount,
        pendingApprovalCount,
        autoFinalized,
      };
    });

    revalidateSoPaths(sessionId);
    return {
      ok: true as const,
      autoApprovedCount: result.autoApprovedCount,
      pendingApprovalCount: result.pendingApprovalCount,
      needsApproval: result.pendingApprovalCount > 0,
      autoFinalizedAdjustments: result.autoFinalized?.adjustmentsCreated ?? 0,
    };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// ============================================
// 4. APPROVE/REJECT INDIVIDUAL ITEM
// ============================================

export async function approveSOItem(input: { itemId: string; approvalReason: string }) {
  const user = await requireRole([...APPROVER_ROLES]);

  if (!input.approvalReason || input.approvalReason.trim().length < 5) {
    return { ok: false as const, error: 'Alasan approval minimal 5 karakter' };
  }

  try {
    const [item] = await db
      .select({ sessionId: stockCountItems.sessionId, status: stockCountItems.status })
      .from(stockCountItems)
      .where(eq(stockCountItems.id, input.itemId));
    if (!item) return { ok: false as const, error: 'Item tidak ditemukan' };
    if (item.status !== 'PENDING_APPROVAL') {
      return {
        ok: false as const,
        error: `Item tidak bisa di-approve dari status ${item.status}`,
      };
    }

    await db
      .update(stockCountItems)
      .set({
        status: 'APPROVED',
        approvalReason: input.approvalReason,
        approvedBy: user.id,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(stockCountItems.id, input.itemId));

    revalidateSoPaths(item.sessionId);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : 'Unknown' };
  }
}

export async function rejectSOItem(input: { itemId: string; rejectionReason: string }) {
  const user = await requireRole([...APPROVER_ROLES]);

  if (!input.rejectionReason || input.rejectionReason.trim().length < 5) {
    return { ok: false as const, error: 'Alasan reject minimal 5 karakter' };
  }

  try {
    const [item] = await db
      .select({ sessionId: stockCountItems.sessionId, status: stockCountItems.status })
      .from(stockCountItems)
      .where(eq(stockCountItems.id, input.itemId));
    if (!item) return { ok: false as const, error: 'Item tidak ditemukan' };
    if (item.status !== 'PENDING_APPROVAL') {
      return {
        ok: false as const,
        error: `Item tidak bisa di-reject dari status ${item.status}`,
      };
    }

    await db
      .update(stockCountItems)
      .set({
        status: 'REJECTED',
        rejectionReason: input.rejectionReason,
        rejectedBy: user.id,
        rejectedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(stockCountItems.id, input.itemId));

    revalidateSoPaths(item.sessionId);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : 'Unknown' };
  }
}

// ============================================
// 5. APPROVE FINAL SESSION → GENERATE ADJUSTMENT MOVEMENTS
// ============================================

export async function approveSOSession(sessionId: string) {
  const user = await requireRole([...APPROVER_ROLES]);

  try {
    const result = await db.transaction(async (tx) =>
      internalApproveSOSession(tx, sessionId, user.id),
    );
    revalidateSoPaths(sessionId);
    return {
      ok: true as const,
      sessionId,
      adjustmentsCreated: result.adjustmentsCreated,
    };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

async function internalApproveSOSession(
  tx: Tx,
  sessionId: string,
  userId: string,
): Promise<{ adjustmentsCreated: number }> {
  const [session] = await tx
    .select()
    .from(stockCountSessions)
    .where(eq(stockCountSessions.id, sessionId));

  if (!session) throw new Error('Session tidak ditemukan');
  if (session.status !== 'SUBMITTED') {
    throw new Error(`Session harus SUBMITTED dulu, current: ${session.status}`);
  }

  const items = await tx
    .select()
    .from(stockCountItems)
    .where(eq(stockCountItems.sessionId, sessionId));

  const unresolved = items.filter((i) =>
    ['PENDING', 'COUNTED', 'PENDING_APPROVAL', 'NEEDS_RECOUNT'].includes(i.status),
  );

  if (unresolved.length > 0) {
    throw new Error(
      `${unresolved.length} item belum di-approve/reject. Selesaikan dulu sebelum finalisasi.`,
    );
  }

  // Generate adjustment movements untuk item APPROVED + AUTO_APPROVED dengan diff != 0
  let adjustmentsCreated = 0;
  const itemsToAdjust = items.filter((i) => {
    const isApproved = i.status === 'APPROVED' || i.status === 'AUTO_APPROVED';
    const hasDiff = Number(i.differenceBase ?? 0) !== 0;
    return isApproved && hasDiff;
  });

  for (const item of itemsToAdjust) {
    const diffBase = Number(item.differenceBase);
    const isPositive = diffBase > 0;
    const movementType = isPositive ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
    const movementId = createId();

    const hppAtMove = item.hppAtCount ? Number(item.hppAtCount) : 0;

    await tx.insert(stockMovements).values({
      id: movementId,
      productId: item.productId,
      locationId: session.locationId,
      movementType,
      qtyInBase: diffBase.toString(),
      unitNameUsed: 'SO_ADJUSTMENT',
      qtyInUnitUsed: Math.abs(diffBase).toString(),
      hppAtMovement: item.hppAtCount,
      totalValueRp: (Math.abs(diffBase) * hppAtMove).toString(),
      sourceType: 'SO_SESSION',
      sourceId: sessionId,
      notes: `Adjustment dari SO ${session.id}: selisih ${
        diffBase > 0 ? '+' : ''
      }${diffBase} (${item.differencePercent ?? 0}%)`,
      createdBy: userId,
    });

    // Update stock_balance secara konsisten
    const [balance] = await tx
      .select()
      .from(stockBalances)
      .where(
        and(
          eq(stockBalances.productId, item.productId),
          eq(stockBalances.locationId, session.locationId),
        ),
      );

    if (balance) {
      const newQty = Number(balance.qtyInBase) + diffBase;
      if (newQty < 0) {
        throw new Error(
          `Adjustment akan membuat stok ${item.productId} di ${session.locationId} jadi negatif (${newQty}).`,
        );
      }
      await tx
        .update(stockBalances)
        .set({
          qtyInBase: newQty.toString(),
          lastMovementAt: new Date(),
          lastCountedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(stockBalances.id, balance.id));
    } else if (diffBase > 0) {
      await tx.insert(stockBalances).values({
        id: createId(),
        productId: item.productId,
        locationId: session.locationId,
        qtyInBase: diffBase.toString(),
        avgHpp: item.hppAtCount ?? null,
        lastMovementAt: new Date(),
        lastCountedAt: new Date(),
      });
    }

    await tx
      .update(stockCountItems)
      .set({ generatedMovementId: movementId, updatedAt: new Date() })
      .where(eq(stockCountItems.id, item.id));

    adjustmentsCreated++;
  }

  // Update lastCountedAt untuk semua produk di lokasi ini (audit cycle)
  await tx
    .update(stockBalances)
    .set({ lastCountedAt: new Date() })
    .where(eq(stockBalances.locationId, session.locationId));

  await tx
    .update(stockCountSessions)
    .set({
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(stockCountSessions.id, sessionId));

  return { adjustmentsCreated };
}

// ============================================
// 6. REJECT SESSION (back to REJECTED)
// ============================================

export async function rejectSOSession(input: { sessionId: string; reason: string }) {
  await requireRole([...APPROVER_ROLES]);

  if (!input.reason || input.reason.trim().length < 10) {
    return { ok: false as const, error: 'Alasan reject session minimal 10 karakter' };
  }

  try {
    const [updated] = await db
      .update(stockCountSessions)
      .set({
        status: 'REJECTED',
        rejectionReason: input.reason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(stockCountSessions.id, input.sessionId),
          eq(stockCountSessions.status, 'SUBMITTED'),
        ),
      )
      .returning({ id: stockCountSessions.id });

    if (!updated) {
      return {
        ok: false as const,
        error: 'Session tidak ada / status bukan SUBMITTED',
      };
    }

    revalidateSoPaths(input.sessionId);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : 'Unknown' };
  }
}

// ============================================
// 7. CANCEL SESSION (DRAFT/IN_PROGRESS only)
// ============================================

export async function cancelSOSession(sessionId: string) {
  const user = await requireAuth();

  try {
    const [session] = await db
      .select()
      .from(stockCountSessions)
      .where(eq(stockCountSessions.id, sessionId));

    if (!session) return { ok: false as const, error: 'Session tidak ditemukan' };

    if (user.role !== 'OWNER' && session.createdBy !== user.id) {
      return { ok: false as const, error: 'Tidak punya izin cancel session ini' };
    }
    if (!['DRAFT', 'IN_PROGRESS'].includes(session.status)) {
      return {
        ok: false as const,
        error: 'Hanya session DRAFT/IN_PROGRESS yang bisa di-cancel',
      };
    }

    await db
      .update(stockCountSessions)
      .set({ status: 'CANCELLED', updatedAt: new Date() })
      .where(eq(stockCountSessions.id, sessionId));

    revalidateSoPaths(sessionId);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : 'Unknown' };
  }
}
