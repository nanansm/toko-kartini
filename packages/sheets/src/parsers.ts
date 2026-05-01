import type { SheetProduct, SheetSupplier, SheetCustomer } from './types';

function s(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  return String(v).trim();
}

function n(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const num = typeof v === 'number' ? v : parseFloat(String(v).replace(/[.,\s]/g, ''));
  return isNaN(num) ? null : num;
}

function b(v: unknown, fallback = true): boolean {
  if (v === null || v === undefined || v === '') return fallback;
  const str = String(v).trim().toUpperCase();
  return str === 'TRUE' || str === 'YES' || str === '1';
}

// Parse row dari tab Products (header di row 4, data dari row 6)
export function parseProductRow(row: string[]): SheetProduct | null {
  const productId = s(row[0]);
  const productName = s(row[1]);
  if (!productId || !productName) return null;

  return {
    productId,
    productName,
    categoryL1: s(row[2]) ?? '',
    categoryL2: s(row[3]),
    supplierName: s(row[4]),
    unitL1Name: s(row[5]),
    unitL1ToL2Qty: n(row[6]),
    unitL2Name: s(row[7]),
    unitL2ToL3Qty: n(row[8]),
    unitL3Name: s(row[9]),
    unitL3ToL4Qty: n(row[10]),
    unitL4Name: s(row[11]),
    hppPerL1: n(row[12]),
    sellPriceGrosirL1: n(row[13]),
    sellPriceHj1: n(row[14]),
    sellPriceHj2: n(row[15]),
    sellPriceHj3: n(row[16]),
    olseraSku: s(row[17]),
    isActive: b(row[18], true),
    notes: s(row[19]),
  };
}

export function parseSupplierRow(row: string[]): SheetSupplier | null {
  const supplierId = s(row[0]);
  const supplierName = s(row[1]);
  if (!supplierId || !supplierName) return null;

  return {
    supplierId,
    supplierName,
    picName: s(row[2]),
    phone: s(row[3]),
    whatsapp: s(row[4]),
    email: s(row[5]),
    address: s(row[6]),
    paymentTermDays: n(row[7]),
    notes: s(row[8]),
  };
}

export function parseCustomerRow(row: string[]): SheetCustomer | null {
  const customerId = s(row[0]);
  const customerName = s(row[1]);
  if (!customerId || !customerName) return null;

  const tier = (s(row[8])?.toUpperCase() ?? 'HJ2') as SheetCustomer['pricingTier'];
  const validTier = (['GROSIR', 'HJ1', 'HJ2', 'HJ3'] as const).includes(tier as never)
    ? tier
    : 'HJ2';

  return {
    customerId,
    customerName,
    customerType: s(row[2]),
    picName: s(row[3]),
    phone: s(row[4]),
    whatsapp: s(row[5]),
    email: s(row[6]),
    address: s(row[7]),
    pricingTier: validTier,
    creditLimitRp: n(row[9]),
    paymentTermDays: n(row[10]),
    notes: s(row[11]),
  };
}
