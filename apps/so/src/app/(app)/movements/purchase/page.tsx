import { db, locations, suppliers } from '@kartini/db';
import { eq, asc } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart } from 'lucide-react';
import { PurchaseForm } from './_components/PurchaseForm';
import { requireRole } from '@/lib/session';

export default async function PurchasePage() {
  await requireRole(['OWNER', 'ADMIN', 'SUPERVISOR']);

  const [allLocations, allSuppliers] = await Promise.all([
    db
      .select()
      .from(locations)
      .where(eq(locations.isActive, true))
      .orderBy(asc(locations.id)),
    db
      .select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers)
      .where(eq(suppliers.isActive, true))
      .orderBy(asc(suppliers.name)),
  ]);

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 text-kartini-green" />
          Pembelian Masuk
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Catat barang yang diterima dari supplier.
        </p>
      </div>

      <Card className="border-stone-200 shadow-soft-sm">
        <CardHeader>
          <CardTitle className="text-base">Form Pembelian</CardTitle>
        </CardHeader>
        <CardContent>
          <PurchaseForm locations={allLocations} suppliers={allSuppliers} />
        </CardContent>
      </Card>
    </div>
  );
}
