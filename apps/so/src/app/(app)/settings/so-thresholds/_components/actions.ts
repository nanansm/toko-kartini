'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/session';
import { updateSetting } from '@/lib/inventory/settings';

export async function updateSOThresholds(input: { low: number; high: number }) {
  const user = await requireRole(['OWNER']);

  if (
    !Number.isFinite(input.low) ||
    !Number.isFinite(input.high) ||
    input.low < 0 ||
    input.low > 100 ||
    input.high < 0 ||
    input.high > 100
  ) {
    return { ok: false as const, error: 'Threshold harus 0-100' };
  }
  if (input.low >= input.high) {
    return {
      ok: false as const,
      error: 'Threshold rendah harus lebih kecil dari tinggi',
    };
  }

  try {
    await updateSetting('so_threshold_low_pct', String(input.low), user.id);
    await updateSetting('so_threshold_high_pct', String(input.high), user.id);

    revalidatePath('/settings/so-thresholds');
    revalidatePath('/so');
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : 'Unknown' };
  }
}
