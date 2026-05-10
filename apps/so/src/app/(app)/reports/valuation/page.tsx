import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { BarChart3, MapPin, AlertCircle } from 'lucide-react';
import { getStockValuation } from '@/lib/queries/reports';
import { requireAuth } from '@/lib/session';

function formatRp(value: number): string {
  if (!value || value === 0) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function ValuationPage() {
  await requireAuth();
  const locations = await getStockValuation();

  const totalValue = locations.reduce((sum, l) => sum + Number(l.total_value_rp ?? 0), 0);
  const totalProducts = locations.reduce((sum, l) => sum + Number(l.total_products ?? 0), 0);
  const totalNoHpp = locations.reduce(
    (sum, l) => sum + (Number(l.total_products) - Number(l.products_with_hpp)),
    0,
  );

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-kartini-green" />
          Valuasi Stok
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Nilai persediaan berdasarkan HPP master produk. Data: April 2026.
        </p>
      </div>

      {totalNoHpp > 0 && (
        <Card className="bg-amber-50 border-amber-200 p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <strong>{totalNoHpp} produk</strong> tidak punya data HPP — nilai stoknya tidak
            ter-hitung. Lengkapi HPP di Google Sheet master untuk hasil valuasi yang akurat.
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="border-stone-200 shadow-soft-sm p-4">
          <div className="text-xs text-stone-500 mb-1">Total Nilai Stok</div>
          <div className="text-2xl font-bold text-stone-900">{formatRp(totalValue)}</div>
          <div className="text-xs text-stone-400 mt-1">Semua lokasi</div>
        </Card>
        <Card className="border-stone-200 shadow-soft-sm p-4">
          <div className="text-xs text-stone-500 mb-1">Total SKU</div>
          <div className="text-2xl font-bold text-stone-900">
            {totalProducts.toLocaleString('id-ID')}
          </div>
          <div className="text-xs text-stone-400 mt-1">Produk dengan stok</div>
        </Card>
        <Card className="border-stone-200 shadow-soft-sm p-4">
          <div className="text-xs text-stone-500 mb-1">Tanpa HPP</div>
          <div className="text-2xl font-bold text-amber-600">
            {totalNoHpp.toLocaleString('id-ID')}
          </div>
          <div className="text-xs text-stone-400 mt-1">Nilai tidak terhitung</div>
        </Card>
      </div>

      <div className="space-y-3">
        {locations.map((loc) => {
          const noHpp = Number(loc.total_products) - Number(loc.products_with_hpp);
          const coverage =
            Number(loc.total_products) > 0
              ? Math.round((Number(loc.products_with_hpp) / Number(loc.total_products)) * 100)
              : 0;

          return (
            <Link key={loc.location_id} href={`/reports/valuation/${loc.location_id}`}>
              <Card className="border-stone-200 shadow-soft-sm hover:shadow-soft-md hover:border-kartini-green/20 transition p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-stone-400 mb-1">
                      <MapPin className="w-3 h-3" />
                      {loc.location_code}
                    </div>
                    <h3 className="font-semibold text-stone-900">{loc.location_name}</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-stone-900">
                      {formatRp(Number(loc.total_value_rp))}
                    </div>
                    <div className="text-xs text-stone-400 mt-0.5">
                      HPP coverage: {coverage}% ({loc.products_with_hpp}/{loc.total_products}{' '}
                      produk)
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-kartini-green rounded-full"
                      style={{ width: `${coverage}%` }}
                    />
                  </div>
                </div>

                <div className="text-xs text-stone-400 mt-2">
                  {loc.total_products} produk · {noHpp > 0 && `${noHpp} tanpa HPP · `}
                  Klik untuk detail per kategori →
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
