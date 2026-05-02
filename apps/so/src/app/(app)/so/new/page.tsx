import { db, locations, products } from '@kartini/db';
import { eq, asc } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardCheck } from 'lucide-react';
import { CreateSOForm } from './_components/CreateSOForm';
import { requireAuth } from '@/lib/session';

export default async function NewSOPage() {
  await requireAuth();

  const [allLocations, allCategories] = await Promise.all([
    db
      .select()
      .from(locations)
      .where(eq(locations.isActive, true))
      .orderBy(asc(locations.id)),
    db
      .selectDistinct({ categoryL1: products.categoryL1 })
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(asc(products.categoryL1)),
  ]);

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-kartini-green" />
          Mulai SO Baru
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Pilih tipe, lokasi, dan scope SO. Sistem akan generate daftar produk yang harus
          di-count.
        </p>
      </div>

      <Card className="border-stone-200 shadow-soft-sm">
        <CardHeader>
          <CardTitle className="text-base">Konfigurasi SO</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateSOForm
            locations={allLocations.map((l) => ({
              id: l.id,
              code: l.code,
              name: l.name,
              type: l.type,
            }))}
            categories={allCategories.map((c) => c.categoryL1)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
