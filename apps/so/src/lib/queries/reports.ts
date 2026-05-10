import 'server-only';
import { db } from '@kartini/db';
import { sql } from 'drizzle-orm';

// ============================================
// 1. VALUASI STOK
// ============================================

/**
 * Hitung nilai stok per lokasi.
 * HPP per base unit = hpp_per_l1 / qty_in_base_unit (dari unit base/terkecil).
 * Single query dengan JOIN ke product_units (is_base_unit = true) — tidak ada N+1.
 */
export async function getStockValuation() {
  const rows = await db.execute(sql`
    SELECT
      l.id as location_id,
      l.name as location_name,
      l.code as location_code,
      COUNT(sb.product_id) as total_products,
      COUNT(CASE WHEN p.hpp_per_l1 IS NOT NULL THEN 1 END) as products_with_hpp,
      SUM(
        CASE
          WHEN p.hpp_per_l1 IS NOT NULL AND pu_base.qty_in_base_unit > 0
          THEN sb.qty_in_base * (p.hpp_per_l1 / pu_base.qty_in_base_unit)
          ELSE 0
        END
      ) as total_value_rp,
      SUM(sb.qty_in_base) as total_qty_base
    FROM inventory.stock_balances sb
    JOIN inventory.locations l ON l.id = sb.location_id
    JOIN inventory.products p ON p.id = sb.product_id
    LEFT JOIN inventory.product_units pu_base
      ON pu_base.product_id = p.id
      AND pu_base.unit_level = 1
    WHERE sb.qty_in_base > 0
      AND l.is_active = true
    GROUP BY l.id, l.name, l.code
    ORDER BY l.id
  `);

  return rows as unknown as Array<{
    location_id: string;
    location_name: string;
    location_code: string;
    total_products: number;
    products_with_hpp: number;
    total_value_rp: number;
    total_qty_base: number;
  }>;
}

/**
 * Valuasi per kategori untuk 1 lokasi.
 */
export async function getStockValuationByCategory(locationId: string) {
  const rows = await db.execute(sql`
    SELECT
      p.category_l1,
      COUNT(sb.product_id) as total_products,
      SUM(sb.qty_in_base) as total_qty_base,
      SUM(
        CASE
          WHEN p.hpp_per_l1 IS NOT NULL AND pu_base.qty_in_base_unit > 0
          THEN sb.qty_in_base * (p.hpp_per_l1 / pu_base.qty_in_base_unit)
          ELSE 0
        END
      ) as total_value_rp,
      COUNT(CASE WHEN p.hpp_per_l1 IS NULL THEN 1 END) as products_no_hpp
    FROM inventory.stock_balances sb
    JOIN inventory.products p ON p.id = sb.product_id
    LEFT JOIN inventory.product_units pu_base
      ON pu_base.product_id = p.id
      AND pu_base.unit_level = 1
    WHERE sb.location_id = ${locationId}
      AND sb.qty_in_base > 0
    GROUP BY p.category_l1
    ORDER BY total_value_rp DESC
  `);

  return rows as unknown as Array<{
    category_l1: string;
    total_products: number;
    total_qty_base: number;
    total_value_rp: number;
    products_no_hpp: number;
  }>;
}

// ============================================
// 2. LAPORAN SO
// ============================================

/**
 * List SO sessions APPROVED dengan stats breakdown items.
 */
export async function getSOReport(
  filter: {
    locationId?: string;
    month?: string; // YYYY-MM
    page?: number;
    pageSize?: number;
  } = {},
) {
  const { locationId, month, page = 1, pageSize = 20 } = filter;

  const rows = await db.execute(sql`
    SELECT
      scs.id as session_id,
      scs.type,
      scs.status,
      l.name as location_name,
      l.code as location_code,
      scs.started_at,
      scs.approved_at,
      scs.total_items_count,
      scs.total_differences,
      scs.total_value_rp,
      scs.total_difference_value_rp,
      COUNT(CASE WHEN sci.status = 'AUTO_APPROVED' THEN 1 END) as auto_approved_count,
      COUNT(CASE WHEN sci.status = 'APPROVED' THEN 1 END) as approved_count,
      COUNT(CASE WHEN sci.status = 'REJECTED' THEN 1 END) as rejected_count,
      COUNT(CASE WHEN sci.difference_base > 0 THEN 1 END) as surplus_count,
      COUNT(CASE WHEN sci.difference_base < 0 THEN 1 END) as shortage_count,
      SUM(CASE WHEN sci.difference_base < 0 THEN ABS(sci.difference_value_rp) ELSE 0 END) as shortage_value_rp
    FROM inventory.stock_count_sessions scs
    JOIN inventory.locations l ON l.id = scs.location_id
    LEFT JOIN inventory.stock_count_items sci ON sci.session_id = scs.id
    WHERE scs.status = 'APPROVED'
      ${locationId ? sql`AND scs.location_id = ${locationId}` : sql``}
      ${month ? sql`AND TO_CHAR(scs.approved_at, 'YYYY-MM') = ${month}` : sql``}
    GROUP BY scs.id, l.name, l.code
    ORDER BY scs.approved_at DESC
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
  `);

  const totalRows = await db.execute(sql`
    SELECT COUNT(*) as total
    FROM inventory.stock_count_sessions scs
    WHERE scs.status = 'APPROVED'
      ${locationId ? sql`AND scs.location_id = ${locationId}` : sql``}
      ${month ? sql`AND TO_CHAR(scs.approved_at, 'YYYY-MM') = ${month}` : sql``}
  `);

  const total = Number(
    ((totalRows as unknown as Array<{ total?: number | string }>)[0])?.total ?? 0,
  );

  return {
    items: rows as unknown as Array<Record<string, unknown>>,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Top 10 produk dengan selisih nilai terbesar dari 1 SO session.
 */
export async function getSOSessionTopDiscrepancies(sessionId: string) {
  const rows = await db.execute(sql`
    SELECT
      p.id as product_id,
      p.name as product_name,
      p.category_l1,
      sci.qty_system_base,
      sci.qty_physical_base,
      sci.difference_base,
      sci.difference_percent,
      sci.difference_value_rp,
      sci.status
    FROM inventory.stock_count_items sci
    JOIN inventory.products p ON p.id = sci.product_id
    WHERE sci.session_id = ${sessionId}
      AND sci.difference_base IS NOT NULL
      AND sci.difference_base != 0
    ORDER BY ABS(sci.difference_value_rp) DESC NULLS LAST
    LIMIT 10
  `);

  return rows as unknown as Array<Record<string, unknown>>;
}

// ============================================
// 3. SLOW MOVING PRODUCTS
// ============================================

/**
 * Produk tidak bergerak > thresholdDays hari (atau belum pernah bergerak).
 */
export async function getSlowMovingProducts(
  filter: {
    locationId?: string;
    thresholdDays?: number;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const { locationId, thresholdDays = 30, page = 1, pageSize = 50 } = filter;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - thresholdDays);
  const cutoffIso = cutoffDate.toISOString();

  const rows = await db.execute(sql`
    SELECT
      p.id as product_id,
      p.name as product_name,
      p.category_l1,
      l.name as location_name,
      l.code as location_code,
      sb.qty_in_base,
      sb.last_movement_at,
      EXTRACT(DAY FROM NOW() - sb.last_movement_at) as days_since_movement,
      CASE
        WHEN p.hpp_per_l1 IS NOT NULL AND pu_base.qty_in_base_unit > 0
        THEN sb.qty_in_base * (p.hpp_per_l1 / pu_base.qty_in_base_unit)
        ELSE NULL
      END as estimated_value_rp
    FROM inventory.stock_balances sb
    JOIN inventory.products p ON p.id = sb.product_id
    JOIN inventory.locations l ON l.id = sb.location_id
    LEFT JOIN inventory.product_units pu_base
      ON pu_base.product_id = p.id
      AND pu_base.unit_level = 1
    WHERE sb.qty_in_base > 0
      AND (
        sb.last_movement_at < ${cutoffIso}
        OR sb.last_movement_at IS NULL
      )
      ${locationId ? sql`AND sb.location_id = ${locationId}` : sql``}
      AND l.is_active = true
    ORDER BY sb.last_movement_at ASC NULLS FIRST
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
  `);

  const totalRows = await db.execute(sql`
    SELECT COUNT(*) as total
    FROM inventory.stock_balances sb
    JOIN inventory.locations l ON l.id = sb.location_id
    WHERE sb.qty_in_base > 0
      AND (
        sb.last_movement_at < ${cutoffIso}
        OR sb.last_movement_at IS NULL
      )
      ${locationId ? sql`AND sb.location_id = ${locationId}` : sql``}
      AND l.is_active = true
  `);

  const total = Number(
    ((totalRows as unknown as Array<{ total?: number | string }>)[0])?.total ?? 0,
  );

  return {
    items: rows as unknown as Array<Record<string, unknown>>,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    thresholdDays,
    cutoffDate,
  };
}
