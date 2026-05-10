'use server';

import { db, shifts, transactions } from '@kartini/db';
import { and, eq, sum, count, sql, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requirePOSAuth } from '@/lib/session';

export type ActiveShift = typeof shifts.$inferSelect;

export async function getActiveShift(cashierId: string): Promise<ActiveShift | null> {
  const [shift] = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.cashierId, cashierId), eq(shifts.status, 'OPEN')))
    .limit(1);
  return shift ?? null;
}

export async function openShift(input: { openingCash: number; notes?: string }) {
  const user = await requirePOSAuth();

  const existing = await getActiveShift(user.id);
  if (existing) {
    return {
      ok: false as const,
      error: 'Kamu masih punya shift yang aktif. Tutup dulu sebelum buka baru.',
    };
  }

  if (input.openingCash < 0) {
    return { ok: false as const, error: 'Modal awal tidak boleh negatif' };
  }

  try {
    const [shift] = await db
      .insert(shifts)
      .values({
        cashierId: user.id,
        cashierName: user.name,
        openingCash: input.openingCash.toString(),
        openingNotes: input.notes,
        status: 'OPEN',
      })
      .returning();

    revalidatePath('/pos');
    return { ok: true as const, shiftId: shift!.id };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function closeShift(input: {
  shiftId: string;
  closingCash: number;
  notes?: string;
}) {
  const user = await requirePOSAuth();

  try {
    const [shift] = await db
      .select()
      .from(shifts)
      .where(and(eq(shifts.id, input.shiftId), eq(shifts.status, 'OPEN')));

    if (!shift) {
      return { ok: false as const, error: 'Shift tidak ditemukan atau sudah ditutup' };
    }

    if (
      shift.cashierId !== user.id &&
      !['OWNER', 'SUPERVISOR', 'ADMIN'].includes(user.role)
    ) {
      return { ok: false as const, error: 'Tidak punya izin tutup shift ini' };
    }

    const [summary] = await db
      .select({
        totalTransactions: count(),
        totalRevenue: sum(transactions.totalAmount),
        totalCashRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.paymentMethodType} = 'CASH' THEN ${transactions.totalAmount} ELSE 0 END), 0)`,
        totalNonCashRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.paymentMethodType} != 'CASH' THEN ${transactions.totalAmount} ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.shiftId, input.shiftId),
          eq(transactions.status, 'PAID'),
        ),
      );

    const totalTransactions = Number(summary?.totalTransactions ?? 0);
    const totalRevenue = Number(summary?.totalRevenue ?? 0);
    const totalCashRevenue = Number(summary?.totalCashRevenue ?? 0);
    const totalNonCashRevenue = Number(summary?.totalNonCashRevenue ?? 0);

    const expectedCash = Number(shift.openingCash) + totalCashRevenue;
    const cashDifference = input.closingCash - expectedCash;

    await db
      .update(shifts)
      .set({
        status: 'CLOSED',
        closedAt: new Date(),
        closedBy: user.id,
        closingCash: input.closingCash.toString(),
        expectedCash: expectedCash.toString(),
        cashDifference: cashDifference.toString(),
        closingNotes: input.notes,
        totalTransactions,
        totalRevenue: totalRevenue.toString(),
        totalCashRevenue: totalCashRevenue.toString(),
        totalNonCashRevenue: totalNonCashRevenue.toString(),
      })
      .where(eq(shifts.id, input.shiftId));

    revalidatePath('/pos');
    return {
      ok: true as const,
      summary: {
        totalTransactions,
        totalRevenue,
        totalCashRevenue,
        totalNonCashRevenue,
        expectedCash,
        closingCash: input.closingCash,
        cashDifference,
      },
    };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function getShiftHistory(page = 1, pageSize = 20) {
  await requirePOSAuth();

  const [items, totalResult] = await Promise.all([
    db
      .select()
      .from(shifts)
      .where(eq(shifts.status, 'CLOSED'))
      .orderBy(desc(shifts.openedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: count() }).from(shifts).where(eq(shifts.status, 'CLOSED')),
  ]);

  const total = Number(totalResult[0]?.count ?? 0);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
