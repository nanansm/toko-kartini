import { db, locations } from '@kartini/db';
import { eq, asc } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wrench } from 'lucide-react';
import { AdjustmentForm } from './_components/AdjustmentForm';
import { requireRole } from '@/lib/session';

export default async function AdjustmentPage() {
  await requireRole(['OWNER', 'ADMIN', 'SUPERVISOR']);

  const allLocations = await db
    .select()
    .from(locations)
    .where(eq(locations.isActive, true))
    .orderBy(asc(locations.id));

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 flex items-center gap-2">
          <Wrench className="w-6 h-6 text-kartini-green" />
          Adjustment / Waste
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Koreksi stok atau catat barang rusak. Setiap adjustment butuh alasan.
        </p>
      </div>

      <Card className="border-stone-200 shadow-soft-sm">
        <CardHeader>
          <CardTitle className="text-base">Form Adjustment</CardTitle>
        </CardHeader>
        <CardContent>
          <AdjustmentForm locations={allLocations} />
        </CardContent>
      </Card>
    </div>
  );
}
