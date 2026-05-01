export interface SheetProduct {
  productId: string;
  productName: string;
  categoryL1: string;
  categoryL2: string | null;
  supplierName: string | null;
  unitL1Name: string | null;
  unitL1ToL2Qty: number | null;
  unitL2Name: string | null;
  unitL2ToL3Qty: number | null;
  unitL3Name: string | null;
  unitL3ToL4Qty: number | null;
  unitL4Name: string | null;
  hppPerL1: number | null;
  sellPriceGrosirL1: number | null;
  sellPriceHj1: number | null;
  sellPriceHj2: number | null;
  sellPriceHj3: number | null;
  olseraSku: string | null;
  isActive: boolean;
  notes: string | null;
}

export interface SheetSupplier {
  supplierId: string;
  supplierName: string;
  picName: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  paymentTermDays: number | null;
  notes: string | null;
}

export interface SheetCustomer {
  customerId: string;
  customerName: string;
  customerType: string | null;
  picName: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  pricingTier: 'GROSIR' | 'HJ1' | 'HJ2' | 'HJ3';
  creditLimitRp: number | null;
  paymentTermDays: number | null;
  notes: string | null;
}
