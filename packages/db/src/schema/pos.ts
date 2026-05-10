import {
  text,
  timestamp,
  decimal,
  integer,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { posSchema } from './_schemas';

// ============================================
// ENUMS
// ============================================

export const shiftStatusEnum = posSchema.enum('shift_status', ['OPEN', 'CLOSED']);

export const transactionStatusEnum = posSchema.enum('transaction_status', [
  'PENDING',
  'PAID',
  'CANCELLED',
  'REFUNDED',
]);

export const paymentMethodTypeEnum = posSchema.enum('payment_method_type', [
  'CASH',
  'TRANSFER',
  'QRIS',
  'CARD',
  'TEMPO',
]);

export const returnStatusEnum = posSchema.enum('return_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

// ============================================
// TABLES
// ============================================

export const paymentMethods = posSchema.table('payment_methods', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  type: paymentMethodTypeEnum('type').notNull().unique(),
  name: text('name').notNull(),
  isEnabled: boolean('is_enabled').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  notes: text('notes'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const receiptConfig = posSchema.table('receipt_config', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  storeName: text('store_name').notNull().default('TOKO KARTINI'),
  storeAddress: text('store_address'),
  storePhone: text('store_phone'),
  headerText: text('header_text'),
  footerText: text('footer_text').default('Terima kasih telah berbelanja!'),
  showLogo: boolean('show_logo').notNull().default(false),
  paperWidth: integer('paper_width').notNull().default(80),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const shifts = posSchema.table(
  'shifts',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),

    cashierId: text('cashier_id').notNull(),
    cashierName: text('cashier_name').notNull(),

    openedAt: timestamp('opened_at').notNull().defaultNow(),
    closedAt: timestamp('closed_at'),

    openingCash: decimal('opening_cash', { precision: 14, scale: 2 }).notNull().default('0'),
    closingCash: decimal('closing_cash', { precision: 14, scale: 2 }),
    expectedCash: decimal('expected_cash', { precision: 14, scale: 2 }),
    cashDifference: decimal('cash_difference', { precision: 14, scale: 2 }),

    totalTransactions: integer('total_transactions').notNull().default(0),
    totalRevenue: decimal('total_revenue', { precision: 14, scale: 2 }).notNull().default('0'),
    totalCashRevenue: decimal('total_cash_revenue', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    totalNonCashRevenue: decimal('total_non_cash_revenue', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    totalRefunds: decimal('total_refunds', { precision: 14, scale: 2 }).notNull().default('0'),

    status: shiftStatusEnum('status').notNull().default('OPEN'),

    openingNotes: text('opening_notes'),
    closingNotes: text('closing_notes'),

    closedBy: text('closed_by'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    idxCashier: index('idx_shift_cashier').on(t.cashierId),
    idxStatus: index('idx_shift_status').on(t.status),
    idxOpenedAt: index('idx_shift_opened_at').on(t.openedAt),
  }),
);

export const transactions = posSchema.table(
  'transactions',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),

    receiptNo: text('receipt_no').notNull().unique(),
    shiftId: text('shift_id').notNull(),
    cashierId: text('cashier_id').notNull(),

    customerId: text('customer_id'),
    customerName: text('customer_name'),

    subtotal: decimal('subtotal', { precision: 14, scale: 2 }).notNull().default('0'),
    discountAmount: decimal('discount_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    totalAmount: decimal('total_amount', { precision: 14, scale: 2 }).notNull().default('0'),

    paymentMethodId: text('payment_method_id'),
    paymentMethodType: paymentMethodTypeEnum('payment_method_type'),
    amountPaid: decimal('amount_paid', { precision: 14, scale: 2 }),
    changeAmount: decimal('change_amount', { precision: 14, scale: 2 }),

    status: transactionStatusEnum('status').notNull().default('PENDING'),

    notes: text('notes'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    paidAt: timestamp('paid_at'),
    cancelledAt: timestamp('cancelled_at'),
    cancelledBy: text('cancelled_by'),
    cancellationReason: text('cancellation_reason'),
  },
  (t) => ({
    idxShift: index('idx_transaction_shift').on(t.shiftId),
    idxCashier: index('idx_transaction_cashier').on(t.cashierId),
    idxStatus: index('idx_transaction_status').on(t.status),
    idxCreatedAt: index('idx_transaction_created_at').on(t.createdAt),
    idxReceiptNo: uniqueIndex('uniq_receipt_no').on(t.receiptNo),
  }),
);

export const transactionItems = posSchema.table(
  'transaction_items',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    transactionId: text('transaction_id').notNull(),

    productId: text('product_id').notNull(),
    productName: text('product_name').notNull(),
    productSku: text('product_sku'),

    unitName: text('unit_name').notNull(),
    qtyInBaseUnit: decimal('qty_in_base_unit', { precision: 14, scale: 4 }).notNull(),

    qty: decimal('qty', { precision: 10, scale: 2 }).notNull(),
    pricePerUnit: decimal('price_per_unit', { precision: 14, scale: 2 }).notNull(),
    originalPricePerUnit: decimal('original_price_per_unit', { precision: 14, scale: 2 }),
    discountPerUnit: decimal('discount_per_unit', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    subtotal: decimal('subtotal', { precision: 14, scale: 2 }).notNull(),

    hppPerUnit: decimal('hpp_per_unit', { precision: 14, scale: 2 }),

    isPriceOverridden: boolean('is_price_override').notNull().default(false),
    overrideReason: text('override_reason'),
    overrideBy: text('override_by'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    idxTransaction: index('idx_item_transaction').on(t.transactionId),
    idxProduct: index('idx_item_product').on(t.productId),
  }),
);

export const returnRequests = posSchema.table('return_requests', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  transactionId: text('transaction_id').notNull(),

  returnItems: text('return_items').notNull(),

  totalReturnAmount: decimal('total_return_amount', { precision: 14, scale: 2 }).notNull(),

  status: returnStatusEnum('status').notNull().default('PENDING'),
  requestedBy: text('requested_by').notNull(),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at'),
  rejectedBy: text('rejected_by'),
  rejectedAt: timestamp('rejected_at'),
  rejectionReason: text('rejection_reason'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
});
