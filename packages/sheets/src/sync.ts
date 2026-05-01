import 'dotenv/config';
import { db, products, suppliers, customers, productUnits } from '@kartini/db';
import { readSheet } from './client';
import { parseProductRow, parseSupplierRow, parseCustomerRow } from './parsers';

const SHEET_ID = process.env.GOOGLE_SHEET_MASTER_ID;
if (!SHEET_ID) throw new Error('GOOGLE_SHEET_MASTER_ID is required');

async function syncSuppliers() {
  console.log('📋 Syncing Suppliers...');
  const rows = await readSheet(SHEET_ID!, 'Suppliers!A6:I');
  let inserted = 0;
  for (const row of rows) {
    const sup = parseSupplierRow(row);
    if (!sup) continue;
    await db
      .insert(suppliers)
      .values({
        id: sup.supplierId,
        name: sup.supplierName,
        picName: sup.picName,
        phone: sup.phone,
        whatsapp: sup.whatsapp,
        email: sup.email,
        address: sup.address,
        paymentTermDays: sup.paymentTermDays ?? 0,
        notes: sup.notes,
      })
      .onConflictDoUpdate({
        target: suppliers.id,
        set: {
          name: sup.supplierName,
          picName: sup.picName,
          phone: sup.phone,
          whatsapp: sup.whatsapp,
          paymentTermDays: sup.paymentTermDays ?? 0,
          updatedAt: new Date(),
        },
      });
    inserted++;
  }
  console.log(`   ✓ ${inserted} suppliers synced`);
}

async function syncProducts() {
  console.log('📦 Syncing Products...');
  const rows = await readSheet(SHEET_ID!, 'Products!A6:T');
  let inserted = 0;
  let skipped = 0;

  // Build supplier name → id map
  const allSuppliers = await db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers);
  const supplierMap = new Map(allSuppliers.map((s) => [s.name.toLowerCase(), s.id]));

  for (const row of rows) {
    const p = parseProductRow(row);
    if (!p) {
      skipped++;
      continue;
    }
    const supplierId = p.supplierName
      ? (supplierMap.get(p.supplierName.toLowerCase()) ?? null)
      : null;

    await db
      .insert(products)
      .values({
        id: p.productId,
        name: p.productName,
        categoryL1: p.categoryL1,
        categoryL2: p.categoryL2,
        supplierId,
        hppPerL1: p.hppPerL1?.toString(),
        sellPriceGrosirL1: p.sellPriceGrosirL1?.toString(),
        sellPriceHj1: p.sellPriceHj1?.toString(),
        sellPriceHj2: p.sellPriceHj2?.toString(),
        sellPriceHj3: p.sellPriceHj3?.toString(),
        olseraSku: p.olseraSku,
        isActive: p.isActive,
        notes: p.notes,
      })
      .onConflictDoUpdate({
        target: products.id,
        set: {
          name: p.productName,
          categoryL1: p.categoryL1,
          categoryL2: p.categoryL2,
          supplierId,
          hppPerL1: p.hppPerL1?.toString(),
          sellPriceGrosirL1: p.sellPriceGrosirL1?.toString(),
          sellPriceHj1: p.sellPriceHj1?.toString(),
          sellPriceHj2: p.sellPriceHj2?.toString(),
          sellPriceHj3: p.sellPriceHj3?.toString(),
          isActive: p.isActive,
          updatedAt: new Date(),
        },
      });
    inserted++;
  }
  console.log(`   ✓ ${inserted} products synced (${skipped} skipped)`);
}

async function syncProductUnits() {
  console.log('📐 Syncing ProductUnits...');
  const rows = await readSheet(SHEET_ID!, 'ProductUnits!A6:H');
  let inserted = 0;

  for (const row of rows) {
    const productId = row[0];
    const unitName = row[2];
    const unitLevel = parseInt(String(row[3]));
    const qtyInBase = parseInt(String(row[4]));
    if (!productId || !unitName || isNaN(unitLevel) || isNaN(qtyInBase)) continue;

    const isBase =
      String(row[5] ?? '')
        .trim()
        .toUpperCase() === 'TRUE';
    const isDefaultPurchase =
      String(row[6] ?? '')
        .trim()
        .toUpperCase() === 'TRUE';
    const isDefaultSell =
      String(row[7] ?? '')
        .trim()
        .toUpperCase() === 'TRUE';

    const unitId = `${productId}-L${unitLevel}`;
    await db
      .insert(productUnits)
      .values({
        id: unitId,
        productId,
        unitName,
        unitLevel,
        qtyInBaseUnit: qtyInBase,
        isBaseUnit: isBase,
        isDefaultPurchase,
        isDefaultSell,
      })
      .onConflictDoUpdate({
        target: productUnits.id,
        set: {
          unitName,
          qtyInBaseUnit: qtyInBase,
          isBaseUnit: isBase,
          isDefaultPurchase,
          isDefaultSell,
          updatedAt: new Date(),
        },
      });
    inserted++;
  }
  console.log(`   ✓ ${inserted} product units synced`);
}

async function syncCustomers() {
  console.log('👥 Syncing Customers...');
  const rows = await readSheet(SHEET_ID!, 'Customers!A6:L');
  let inserted = 0;
  for (const row of rows) {
    const c = parseCustomerRow(row);
    if (!c) continue;
    await db
      .insert(customers)
      .values({
        id: c.customerId,
        name: c.customerName,
        customerType: c.customerType,
        picName: c.picName,
        phone: c.phone,
        whatsapp: c.whatsapp,
        email: c.email,
        address: c.address,
        pricingTier: c.pricingTier,
        creditLimitRp: c.creditLimitRp?.toString() ?? '0',
        paymentTermDays: c.paymentTermDays ?? 0,
        notes: c.notes,
      })
      .onConflictDoUpdate({
        target: customers.id,
        set: {
          name: c.customerName,
          customerType: c.customerType,
          picName: c.picName,
          phone: c.phone,
          whatsapp: c.whatsapp,
          pricingTier: c.pricingTier,
          updatedAt: new Date(),
        },
      });
    inserted++;
  }
  console.log(`   ✓ ${inserted} customers synced`);
}

async function main() {
  console.log('🔄 Starting sync from Google Sheet...');
  console.log(`   Sheet ID: ${SHEET_ID}\n`);

  await syncSuppliers();
  await syncProducts();
  await syncProductUnits();
  await syncCustomers();

  console.log('\n✅ Sync completed successfully');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});
