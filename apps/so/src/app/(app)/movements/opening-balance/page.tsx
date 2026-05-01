import { db, locations } from '@kartini/db';
import { eq, asc } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PackageOpen, Info } from 'lucide-react';
import { OpeningBalanceForm } from './_components/OpeningBalanceForm';
import { requireRole } from '@/lib/session';

export default async function OpeningBalancePage() {
  await requireRole(['OWNER']);

  const allLocations = await db
    .select()
    .from(locations)
    .where(eq(locations.isActive, true))
    .orderBy(asc(locations.id));

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 flex items-center gap-2">
          <PackageOpen className="w-6 h-6 text-kartini-green" />
          Opening Balance
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Input stok awal produk. Hanya OWNER yang bisa.
        </p>
      </div>

      <Alert className="bg-amber-50 border-amber-200">
        <Info className="text-amber-600" />
        <AlertTitle className="text-amber-900">Penting</AlertTitle>
        <AlertDescription className="text-amber-900">
          Opening Balance dipakai 1x untuk inisialisasi stok awal sebelum sistem mulai live.
          Setelah ada movement (transfer/pembelian/SO), gunakan menu yang sesuai. Pastikan stok
          fisik sudah dihitung terlebih dahulu sebelum input.
        </AlertDescription>
      </Alert>

      <Card className="border-stone-200 shadow-soft-sm">
        <CardHeader>
          <CardTitle className="text-base">Form Opening Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <OpeningBalanceForm locations={allLocations} />
        </CardContent>
      </Card>
    </div>
  );
}
