import { Truck, Phone, MessageCircle, Package } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { getSuppliers } from '@/lib/queries/suppliers';
import { requireRole } from '@/lib/session';
import { SupplierSearch } from './_components/SupplierSearch';

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireRole(['OWNER', 'ADMIN', 'SUPERVISOR']);
  const params = await searchParams;
  const data = await getSuppliers({
    search: params.q,
    page: Math.max(1, parseInt(params.page ?? '1') || 1),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 flex items-center gap-2">
          <Truck className="w-6 h-6 text-kartini-green" />
          Master Supplier
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          {data.total.toLocaleString('id-ID')} supplier · sumber: Google Sheet
        </p>
      </div>

      <SupplierSearch />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.items.map((s) => (
          <Card
            key={s.id}
            className="border-stone-200 shadow-soft-sm hover:shadow-soft-md transition py-4 gap-2"
          >
            <div className="px-4">
              <div className="flex items-start justify-between mb-2">
                <div className="font-mono text-[10px] text-stone-400">{s.id}</div>
                <div className="flex items-center gap-1 text-xs text-stone-500">
                  <Package className="w-3 h-3" />
                  {Number(s.productCount ?? 0).toLocaleString('id-ID')} produk
                </div>
              </div>
              <h3 className="font-semibold text-stone-900 mb-2 line-clamp-2 leading-tight">
                {s.name}
              </h3>
              {s.picName && <div className="text-xs text-stone-500 mb-2">PIC: {s.picName}</div>}
              <div className="flex flex-wrap gap-3 mt-3">
                {s.whatsapp && (
                  <a
                    href={`https://wa.me/${s.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-green-700 hover:text-green-900 transition"
                  >
                    <MessageCircle className="w-3 h-3" />
                    WA
                  </a>
                )}
                {s.phone && (
                  <a
                    href={`tel:${s.phone}`}
                    className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900"
                  >
                    <Phone className="w-3 h-3" />
                    {s.phone}
                  </a>
                )}
              </div>
              {s.paymentTermDays !== null && s.paymentTermDays !== undefined && s.paymentTermDays > 0 && (
                <div className="mt-3 pt-3 border-t border-stone-100 text-xs text-stone-500">
                  Tempo:{' '}
                  <span className="font-semibold text-stone-700">{s.paymentTermDays} hari</span>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {data.items.length === 0 && (
        <Card className="border-stone-200 shadow-soft-sm py-12 text-center">
          <p className="text-sm text-stone-500">Tidak ada supplier yang cocok.</p>
        </Card>
      )}
    </div>
  );
}
