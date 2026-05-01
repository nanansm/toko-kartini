import { db, locations } from '@kartini/db';
import { eq, asc } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRightLeft } from 'lucide-react';
import { TransferForm } from './_components/TransferForm';
import { requireAuth } from '@/lib/session';

export default async function TransferPage() {
  await requireAuth();

  const allLocations = await db
    .select()
    .from(locations)
    .where(eq(locations.isActive, true))
    .orderBy(asc(locations.id));

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 flex items-center gap-2">
          <ArrowRightLeft className="w-6 h-6 text-kartini-green" />
          Transfer Stok
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Pindahkan stok antar lokasi (Display ↔ Gudang).
        </p>
      </div>

      <Card className="border-stone-200 shadow-soft-sm">
        <CardHeader>
          <CardTitle className="text-base">Form Transfer</CardTitle>
        </CardHeader>
        <CardContent>
          <TransferForm locations={allLocations} />
        </CardContent>
      </Card>
    </div>
  );
}
