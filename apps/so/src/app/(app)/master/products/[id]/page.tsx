import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Package, Truck, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getProductDetail } from '@/lib/queries/products';
import { formatRupiah, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getProductDetail(id);
  if (!data) notFound();
  const { product, units } = data;

  return (
    <div className="space-y-5">
      <Link
        href="/master/products"
        className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali ke daftar produk
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-stone-400 font-mono mb-1">
            <Package className="w-3 h-3" />
            {product.id}
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-stone-900">{product.name}</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-stone-500 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Tag className="w-3.5 h-3.5" />
              {product.categoryL1}
              {product.categoryL2 && ` / ${product.categoryL2}`}
            </span>
            {product.supplierName && (
              <span className="inline-flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" />
                {product.supplierName}
              </span>
            )}
          </div>
        </div>
        <div>
          {product.isActive ? (
            <Badge className="bg-kartini-green-light text-kartini-green-dark hover:bg-kartini-green-light border-0">
              Aktif
            </Badge>
          ) : (
            <Badge variant="secondary">Nonaktif</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2 border-stone-200 shadow-soft-sm">
          <CardHeader>
            <CardTitle className="text-base">Konversi Unit</CardTitle>
          </CardHeader>
          <CardContent>
            {units.length === 0 ? (
              <p className="text-sm text-stone-500">Tidak ada konversi unit ter-set.</p>
            ) : (
              <div className="space-y-2">
                {units.map((unit) => (
                  <div
                    key={unit.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-stone-50 border border-stone-100 gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-md bg-white border border-stone-200 flex items-center justify-center text-xs font-bold text-stone-600 flex-shrink-0">
                        L{unit.unitLevel}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-stone-900 truncate">{unit.unitName}</div>
                        <div className="text-xs text-stone-500">
                          1 {unit.unitName} ={' '}
                          {formatNumber(unit.qtyInBaseUnit)}{' '}
                          {unit.isBaseUnit ? '(unit terkecil)' : 'unit terkecil'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                      {unit.isDefaultPurchase && (
                        <Badge variant="outline" className="text-[10px] border-stone-200">
                          Beli default
                        </Badge>
                      )}
                      {unit.isDefaultSell && (
                        <Badge variant="outline" className="text-[10px] border-stone-200">
                          Jual default
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-stone-200 shadow-soft-sm">
          <CardHeader>
            <CardTitle className="text-base">Harga</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <PriceRow label="HPP per Unit Besar" value={formatRupiah(product.hppPerL1)} bold />
            {product.currentAvgHpp && (
              <PriceRow
                label="Avg HPP (real)"
                value={formatRupiah(product.currentAvgHpp)}
                hint="dari pembelian"
              />
            )}
            <div className="h-px bg-stone-200 my-2" />
            <PriceRow label="Grosir" value={formatRupiah(product.sellPriceGrosirL1)} />
            <PriceRow label="HJ1" value={formatRupiah(product.sellPriceHj1)} />
            <PriceRow label="HJ2" value={formatRupiah(product.sellPriceHj2)} />
            <PriceRow label="HJ3 (Eceran)" value={formatRupiah(product.sellPriceHj3)} accent />
          </CardContent>
        </Card>
      </div>

      {product.notes && (
        <Card className="border-stone-200 shadow-soft-sm">
          <CardHeader>
            <CardTitle className="text-base">Catatan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-stone-600 whitespace-pre-wrap">{product.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PriceRow({
  label,
  value,
  bold,
  accent,
  hint,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div>
        <div className="text-stone-500">{label}</div>
        {hint && <div className="text-[10px] text-stone-400">{hint}</div>}
      </div>
      <div
        className={cn(
          'tabular-nums',
          accent
            ? 'font-bold text-kartini-green'
            : bold
              ? 'font-semibold text-stone-900'
              : 'text-stone-700',
        )}
      >
        {value}
      </div>
    </div>
  );
}
