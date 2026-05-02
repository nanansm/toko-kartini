import 'server-only';
import { db, systemSettings } from '@kartini/db';
import { eq } from 'drizzle-orm';

export interface SOThresholds {
  // < lowPct → auto-approve item saat session di-submit
  lowPct: number;
  // >= highPct → mandatory re-count, block submit
  highPct: number;
}

export async function getSOThresholds(): Promise<SOThresholds> {
  const settings = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.category, 'so'));

  const lowSetting = settings.find((s) => s.key === 'so_threshold_low_pct');
  const highSetting = settings.find((s) => s.key === 'so_threshold_high_pct');

  return {
    lowPct: lowSetting ? parseFloat(lowSetting.value) : 5,
    highPct: highSetting ? parseFloat(highSetting.value) : 20,
  };
}

export async function getOlseraDefaultLocation(): Promise<string> {
  const [setting] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'olsera_default_location_id'));
  return setting?.value ?? 'LOC-01';
}

export async function updateSetting(key: string, value: string, userId: string) {
  await db
    .update(systemSettings)
    .set({ value, updatedBy: userId, updatedAt: new Date() })
    .where(eq(systemSettings.key, key));
}

export type SOItemClassification = 'AUTO_APPROVED' | 'PENDING_APPROVAL' | 'NEEDS_RECOUNT';

/**
 * Klasifikasi status SO item berdasarkan absolute % selisih.
 * - < lowPct  → AUTO_APPROVED (selisih wajar)
 * - >= highPct → NEEDS_RECOUNT (terlalu jauh, suruh hitung ulang)
 * - di antara → PENDING_APPROVAL (perlu supervisor)
 */
export function classifyItemStatus(
  diffPercent: number,
  thresholds: SOThresholds,
): SOItemClassification {
  const absDiff = Math.abs(diffPercent);
  if (absDiff < thresholds.lowPct) return 'AUTO_APPROVED';
  if (absDiff >= thresholds.highPct) return 'NEEDS_RECOUNT';
  return 'PENDING_APPROVAL';
}
