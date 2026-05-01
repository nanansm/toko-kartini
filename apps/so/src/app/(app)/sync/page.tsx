import { db, products, suppliers, customers, productUnits } from '@kartini/db';
import { count, max } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RefreshCw, Database, Info } from 'lucide-react';
import { requireRole } from '@/lib/session';

const dateFmt = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export default async function SyncPage() {
  await requireRole(['OWNER', 'ADMIN']);

  const [productsData, suppliersData, customersData, unitsData] = await Promise.all([
    db.select({ count: count(), lastUpdate: max(products.updatedAt) }).from(products),
    db.select({ count: count(), lastUpdate: max(suppliers.updatedAt) }).from(suppliers),
    db.select({ count: count(), lastUpdate: max(customers.updatedAt) }).from(customers),
    db.select({ count: count(), lastUpdate: max(productUnits.updatedAt) }).from(productUnits),
  ]);

  const tables = [
    {
      label: 'Products',
      icon: '📦',
      count: productsData[0]?.count ?? 0,
      lastUpdate: productsData[0]?.lastUpdate,
    },
    {
      label: 'Product Units',
      icon: '📐',
      count: unitsData[0]?.count ?? 0,
      lastUpdate: unitsData[0]?.lastUpdate,
    },
    {
      label: 'Suppliers',
      icon: '🚚',
      count: suppliersData[0]?.count ?? 0,
      lastUpdate: suppliersData[0]?.lastUpdate,
    },
    {
      label: 'Customers',
      icon: '👥',
      count: customersData[0]?.count ?? 0,
      lastUpdate: customersData[0]?.lastUpdate,
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 flex items-center gap-2">
          <RefreshCw className="w-6 h-6 text-kartini-green" />
          Sinkronisasi Master Data
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Tarik data terbaru dari Google Sheet ke database sistem.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tables.map((t) => (
          <Card key={t.label} className="border-stone-200 shadow-soft-sm py-4 gap-2">
            <CardContent className="px-4">
              <div className="text-2xl mb-2">{t.icon}</div>
              <div className="text-xs text-stone-500 mb-1">{t.label}</div>
              <div className="text-xl font-bold text-stone-900 tabular-nums">
                {t.count.toLocaleString('id-ID')}
              </div>
              {t.lastUpdate && (
                <div className="text-[10px] text-stone-400 mt-1">
                  {dateFmt.format(new Date(t.lastUpdate))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-stone-200 shadow-soft-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="w-4 h-4 text-kartini-green" />
            Trigger Sync Manual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-stone-600 space-y-2">
            <p>Sync akan menarik data terbaru dari Google Sheet master ke database sistem.</p>
            <ul className="list-disc list-inside space-y-1 text-xs text-stone-500 ml-2">
              <li>Suppliers di-update jika ada perubahan</li>
              <li>Products di-upsert (insert atau update)</li>
              <li>ProductUnits di-replace dengan data baru</li>
              <li>Customers di-upsert</li>
            </ul>
          </div>

          <Alert>
            <Info className="text-amber-600" />
            <AlertTitle>Sync via terminal</AlertTitle>
            <AlertDescription>
              <p>
                Sync sekarang harus dijalankan via terminal:{' '}
                <code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs font-mono">
                  pnpm sheets:sync
                </code>
                . Trigger via UI akan dibangun setelah modul SO selesai.
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
