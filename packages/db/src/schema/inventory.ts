import {
  text,
  timestamp,
  integer,
  decimal,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { inventorySchema } from './_schemas';

// Enums
export const locationTypeEnum = inventorySchema.enum('location_type', ['TOKO', 'GUDANG']);
export const movementTypeEnum = inventorySchema.enum('movement_type', [
  'PURCHASE_IN', // Beli dari supplier
  'TRANSFER_OUT', // Pindah ke lokasi lain
  'TRANSFER_IN', // Diterima dari lokasi lain
  'SALE_OUT', // Terjual (sync dari Olsera)
  'ADJUSTMENT_IN', // Koreksi positif (SO surplus)
  'ADJUSTMENT_OUT', // Koreksi negatif (SO minus, hilang/rusak)
  'WASTE', // Rusak/expired
  'OPENING_BALANCE', // Saldo awal saat init
]);
export const soSessionTypeEnum = inventorySchema.enum('so_session_type', [
  'HARIAN',
  'MINGGUAN',
  'BULANAN',
]);
export const soSessionStatusEnum = inventorySchema.enum('so_session_status', [
  'DRAFT',
  'IN_PROGRESS',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
]);
export const soItemStatusEnum = inventorySchema.enum('so_item_status', [
  'PENDING', // Belum di-count
  'COUNTED', // Sudah di-input qty fisik
  'NEEDS_RECOUNT', // Selisih > threshold tinggi, harus re-count
  'AUTO_APPROVED', // Selisih < threshold rendah, auto-OK
  'PENDING_APPROVAL', // Selisih medium, perlu supervisor approve
  'APPROVED', // Sudah di-approve supervisor
  'REJECTED', // Di-reject supervisor
]);

// Lokasi fisik (3 lokasi)
export const locations = inventorySchema.table('locations', {
  id: text('id').primaryKey(), // LOC-01, LOC-02, LOC-03
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  type: locationTypeEnum('type').notNull(),
  address: text('address'),
  distanceKmFromMain: decimal('distance_km_from_main', { precision: 6, scale: 2 }),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Master kategori (auto-sync dari Sheet)
export const categories = inventorySchema.table(
  'categories',
  {
    id: text('id').primaryKey(), // CAT-XXX
    l1: text('l1').notNull(),
    l2: text('l2'),
    productCount: integer('product_count').notNull().default(0),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    uniqL1L2: uniqueIndex('uniq_cat_l1_l2').on(t.l1, t.l2),
  }),
);

// Master supplier
export const suppliers = inventorySchema.table('suppliers', {
  id: text('id').primaryKey(), // SUP-XXX
  name: text('name').notNull(),
  picName: text('pic_name'),
  phone: text('phone'),
  whatsapp: text('whatsapp'),
  email: text('email'),
  address: text('address'),
  paymentTermDays: integer('payment_term_days').default(0),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Master customer (B2B)
export const customers = inventorySchema.table('customers', {
  id: text('id').primaryKey(), // CUST-XXX
  name: text('name').notNull(),
  customerType: text('customer_type'), // Cafe/Resto/Toko/Reseller
  picName: text('pic_name'),
  phone: text('phone'),
  whatsapp: text('whatsapp'),
  email: text('email'),
  address: text('address'),
  pricingTier: text('pricing_tier', { enum: ['GROSIR', 'HJ1', 'HJ2', 'HJ3'] })
    .notNull()
    .default('HJ2'),
  creditLimitRp: decimal('credit_limit_rp', { precision: 14, scale: 2 }).default('0'),
  paymentTermDays: integer('payment_term_days').default(0),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Master produk
export const products = inventorySchema.table(
  'products',
  {
    id: text('id').primaryKey(), // PRD-XXXXX
    name: text('name').notNull(),
    categoryL1: text('category_l1').notNull(),
    categoryL2: text('category_l2'),
    supplierId: text('supplier_id').references(() => suppliers.id),
    // HPP per L1 (satuan terbesar) — masuk dari Sheet
    hppPerL1: decimal('hpp_per_l1', { precision: 14, scale: 2 }),
    // Pricing tiers per L1
    sellPriceGrosirL1: decimal('sell_price_grosir_l1', { precision: 14, scale: 2 }),
    sellPriceHj1: decimal('sell_price_hj1', { precision: 14, scale: 2 }),
    sellPriceHj2: decimal('sell_price_hj2', { precision: 14, scale: 2 }),
    sellPriceHj3: decimal('sell_price_hj3', { precision: 14, scale: 2 }),
    // Auto-calculated dari pembelian (Weighted Average)
    currentAvgHpp: decimal('current_avg_hpp', { precision: 14, scale: 2 }),
    // Olsera integration
    olseraSku: text('olsera_sku'),
    // Status
    isActive: boolean('is_active').notNull().default(true),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    idxName: index('idx_product_name').on(t.name),
    idxCategory: index('idx_product_category').on(t.categoryL1, t.categoryL2),
    idxSupplier: index('idx_product_supplier').on(t.supplierId),
    idxOlsera: index('idx_product_olsera_sku').on(t.olseraSku),
  }),
);

// Multi-unit per product (1 Bal = 20 Ikat = 200 Pack, dst)
export const productUnits = inventorySchema.table(
  'product_units',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    unitName: text('unit_name').notNull(), // Bal/Ikat/Pack/Pcs/Bks/etc
    unitLevel: integer('unit_level').notNull(), // 1-4 (1=terbesar, 4=terkecil)
    qtyInBaseUnit: integer('qty_in_base_unit').notNull(), // Konversi ke unit terkecil
    isBaseUnit: boolean('is_base_unit').notNull().default(false), // TRUE jika unit terkecil
    isDefaultPurchase: boolean('is_default_purchase').notNull().default(false),
    isDefaultSell: boolean('is_default_sell').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    uniqProductLevel: uniqueIndex('uniq_product_unit_level').on(t.productId, t.unitLevel),
    idxProduct: index('idx_product_unit_product').on(t.productId),
  }),
);

// Stok aktual per lokasi (selalu disimpan dalam BASE UNIT / unit terkecil)
export const stockBalances = inventorySchema.table(
  'stock_balances',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    locationId: text('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    qtyInBase: decimal('qty_in_base', { precision: 14, scale: 2 }).notNull().default('0'),
    // Avg HPP saat ini (untuk valuasi cepat)
    avgHpp: decimal('avg_hpp', { precision: 14, scale: 2 }),
    // Last activity tracking
    lastMovementAt: timestamp('last_movement_at'),
    lastCountedAt: timestamp('last_counted_at'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    uniqProductLocation: uniqueIndex('uniq_stock_product_location').on(t.productId, t.locationId),
    idxLocation: index('idx_stock_location').on(t.locationId),
  }),
);

// Log semua perubahan stok (audit trail lengkap)
export const stockMovements = inventorySchema.table(
  'stock_movements',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    locationId: text('location_id')
      .notNull()
      .references(() => locations.id),
    movementType: movementTypeEnum('movement_type').notNull(),
    qtyInBase: decimal('qty_in_base', { precision: 14, scale: 2 }).notNull(), // Bisa positif/negatif
    unitNameUsed: text('unit_name_used').notNull(), // Unit yang user pakai input
    qtyInUnitUsed: decimal('qty_in_unit_used', { precision: 14, scale: 2 }).notNull(),
    hppAtMovement: decimal('hpp_at_movement', { precision: 14, scale: 2 }),
    totalValueRp: decimal('total_value_rp', { precision: 14, scale: 2 }),
    // Reference (untuk transfer, link ke movement pasangannya)
    referenceMovementId: text('reference_movement_id'),
    // Source
    sourceType: text('source_type'), // OLSERA_SYNC, MANUAL, SO_SESSION, PURCHASE_ORDER
    sourceId: text('source_id'),
    notes: text('notes'),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    idxProduct: index('idx_movement_product').on(t.productId),
    idxLocation: index('idx_movement_location').on(t.locationId),
    idxType: index('idx_movement_type').on(t.movementType),
    idxCreatedAt: index('idx_movement_created_at').on(t.createdAt),
  }),
);

// SO Sessions (header SO)
export const stockCountSessions = inventorySchema.table('stock_count_sessions', {
  id: text('id').primaryKey(), // SOS-YYYYMMDD-XXX
  type: soSessionTypeEnum('type').notNull(),
  locationId: text('location_id')
    .notNull()
    .references(() => locations.id),
  status: soSessionStatusEnum('status').notNull().default('DRAFT'),
  // Timing
  scheduledFor: timestamp('scheduled_for'),
  startedAt: timestamp('started_at'),
  submittedAt: timestamp('submitted_at'),
  approvedAt: timestamp('approved_at'),
  // Users
  createdBy: text('created_by').notNull(),
  submittedBy: text('submitted_by'),
  approvedBy: text('approved_by'),
  // Summary (auto-calculated saat approve)
  totalItemsCount: integer('total_items_count').default(0),
  totalDifferences: integer('total_differences').default(0),
  totalValueRp: decimal('total_value_rp', { precision: 14, scale: 2 }),
  totalDifferenceValueRp: decimal('total_difference_value_rp', { precision: 14, scale: 2 }),
  notes: text('notes'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// SO Items (detail per produk dalam 1 session)
export const stockCountItems = inventorySchema.table(
  'stock_count_items',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => stockCountSessions.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    // Snapshot saat dimulai
    qtySystemBase: decimal('qty_system_base', { precision: 14, scale: 2 }).notNull(),
    hppAtCount: decimal('hpp_at_count', { precision: 14, scale: 2 }),
    // Input user (mixed unit, JSON)
    qtyPhysicalInput: text('qty_physical_input'), // JSON: [{"unitName":"Bal","qty":2},...]
    qtyPhysicalBase: decimal('qty_physical_base', { precision: 14, scale: 2 }), // hasil konversi
    // Selisih
    differenceBase: decimal('difference_base', { precision: 14, scale: 2 }),
    differenceValueRp: decimal('difference_value_rp', { precision: 14, scale: 2 }),
    differencePercent: decimal('difference_percent', { precision: 8, scale: 2 }),
    // Legacy flag (deprecated Week 4 in favor of `status`, retained untuk back-compat data)
    isCounted: boolean('is_counted').notNull().default(false),
    // Status & Approval (Week 4)
    status: soItemStatusEnum('status').notNull().default('PENDING'),
    approvalReason: text('approval_reason'),
    rejectionReason: text('rejection_reason'),
    approvedBy: text('approved_by'),
    approvedAt: timestamp('approved_at'),
    rejectedBy: text('rejected_by'),
    rejectedAt: timestamp('rejected_at'),
    recountCount: integer('recount_count').notNull().default(0),
    notes: text('notes'),
    countedBy: text('counted_by'),
    countedAt: timestamp('counted_at'),
    // Generated movement reference (saat approved)
    generatedMovementId: text('generated_movement_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    uniqSessionProduct: uniqueIndex('uniq_so_session_product').on(t.sessionId, t.productId),
    idxSession: index('idx_so_item_session').on(t.sessionId),
    idxStatus: index('idx_so_item_status').on(t.status),
  }),
);

// Konfigurasi sistem yang bisa diubah OWNER (threshold SO, default location, dll)
export const systemSettings = inventorySchema.table('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  description: text('description'),
  category: text('category').notNull().default('general'),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Log riwayat import sales Olsera dari file Excel
export const olseraImportLogs = inventorySchema.table('olsera_import_logs', {
  id: text('id').primaryKey(),
  fileName: text('file_name').notNull(),
  fileSize: integer('file_size'),
  fileMd5: text('file_md5'),
  // Periode data Olsera (kalau bisa di-detect dari file)
  periodFrom: timestamp('period_from'),
  periodTo: timestamp('period_to'),
  // Stats
  totalRows: integer('total_rows').notNull().default(0),
  movementsCreated: integer('movements_created').notNull().default(0),
  rowsSkipped: integer('rows_skipped').notNull().default(0),
  rowsError: integer('rows_error').notNull().default(0),
  totalValueRp: decimal('total_value_rp', { precision: 14, scale: 2 }),
  // Status
  status: text('status', {
    enum: ['PROCESSING', 'PREVIEW', 'COMMITTED', 'FAILED', 'CANCELLED'],
  }).notNull(),
  errorMessage: text('error_message'),
  // Audit
  uploadedBy: text('uploaded_by').notNull(),
  uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
  committedBy: text('committed_by'),
  committedAt: timestamp('committed_at'),
});

// Staging rows untuk Olsera import (dipakai saat preview → commit)
// Disimpan supaya commit tidak butuh upload ulang dari client
export const olseraImportStaging = inventorySchema.table(
  'olsera_import_staging',
  {
    id: text('id').primaryKey(),
    importLogId: text('import_log_id')
      .notNull()
      .references(() => olseraImportLogs.id, { onDelete: 'cascade' }),
    rowIndex: integer('row_index').notNull(),
    orderNo: text('order_no').notNull(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    locationId: text('location_id')
      .notNull()
      .references(() => locations.id),
    qtyInBase: decimal('qty_in_base', { precision: 14, scale: 2 }).notNull(),
    unitNameUsed: text('unit_name_used').notNull(),
    qtyInUnitUsed: decimal('qty_in_unit_used', { precision: 14, scale: 2 }).notNull(),
    hppAtMovement: decimal('hpp_at_movement', { precision: 14, scale: 2 }),
    totalValueRp: decimal('total_value_rp', { precision: 14, scale: 2 }),
    rawRow: text('raw_row'), // JSON sample
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    idxLog: index('idx_olsera_staging_log').on(t.importLogId),
  }),
);
