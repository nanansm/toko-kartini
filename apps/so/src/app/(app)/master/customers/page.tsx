import { Users, MessageCircle, Phone, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getCustomers } from '@/lib/queries/customers';
import { requireRole } from '@/lib/session';
import { formatRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';

const TIER_STYLE: Record<string, string> = {
  GROSIR: 'bg-purple-100 text-purple-700',
  HJ1: 'bg-blue-100 text-blue-700',
  HJ2: 'bg-kartini-green-light text-kartini-green-dark',
  HJ3: 'bg-kartini-orange-light text-kartini-orange-dark',
};

export default async function CustomersPage() {
  await requireRole(['OWNER', 'ADMIN', 'SUPERVISOR']);
  const data = await getCustomers();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-kartini-green" />
          Master Customer
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          {data.total.toLocaleString('id-ID')} customer B2B · sumber: Google Sheet
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.items.map((c) => (
          <Card
            key={c.id}
            className="border-stone-200 shadow-soft-sm hover:shadow-soft-md transition py-4 gap-2"
          >
            <div className="px-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-[10px] text-stone-400 mb-1">{c.id}</div>
                  <h3 className="font-semibold text-stone-900 leading-tight">{c.name}</h3>
                  {c.customerType && (
                    <p className="text-xs text-stone-500 mt-0.5">{c.customerType}</p>
                  )}
                </div>
                <Badge
                  className={cn(
                    'border-0 flex-shrink-0',
                    TIER_STYLE[c.pricingTier] ?? 'bg-stone-100 text-stone-700',
                  )}
                >
                  {c.pricingTier}
                </Badge>
              </div>

              {c.picName && (
                <div className="text-xs text-stone-500">
                  PIC: <span className="text-stone-700">{c.picName}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-3 text-xs">
                {c.whatsapp && (
                  <a
                    href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-green-700 hover:text-green-900 transition"
                  >
                    <MessageCircle className="w-3 h-3" />
                    WhatsApp
                  </a>
                )}
                {c.phone && (
                  <a
                    href={`tel:${c.phone}`}
                    className="inline-flex items-center gap-1 text-stone-600 hover:text-stone-900"
                  >
                    <Phone className="w-3 h-3" />
                    {c.phone}
                  </a>
                )}
              </div>

              {c.address && (
                <div className="flex items-start gap-1.5 text-xs text-stone-500">
                  <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-2">{c.address}</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-3 border-t border-stone-100 text-xs">
                <div>
                  <div className="text-stone-400 text-[10px] uppercase">Limit kredit</div>
                  <div className="font-semibold text-stone-700 tabular-nums">
                    {formatRupiah(c.creditLimitRp)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-stone-400 text-[10px] uppercase">Tempo</div>
                  <div className="font-semibold text-stone-700 tabular-nums">
                    {c.paymentTermDays ?? 0} hari
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {data.items.length === 0 && (
        <Card className="border-stone-200 shadow-soft-sm py-12 text-center">
          <p className="text-sm text-stone-500">Belum ada customer terdaftar.</p>
        </Card>
      )}
    </div>
  );
}
