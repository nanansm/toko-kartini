import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { BarChart3, ClipboardCheck, TrendingDown } from 'lucide-react';
import { requireAuth } from '@/lib/session';

const REPORT_ITEMS = [
  {
    title: 'Valuasi Stok',
    description: 'Nilai persediaan dalam Rupiah per lokasi dan kategori',
    href: '/reports/valuation',
    icon: BarChart3,
    color: 'bg-kartini-green-light text-kartini-green',
  },
  {
    title: 'Laporan SO',
    description: 'Ringkasan Stock Opname yang sudah diapprove dengan analisis selisih',
    href: '/reports/so',
    icon: ClipboardCheck,
    color: 'bg-blue-50 text-blue-600',
  },
  {
    title: 'Slow Moving',
    description: 'Produk tidak bergerak lebih dari 30 hari',
    href: '/reports/slow-moving',
    icon: TrendingDown,
    color: 'bg-amber-50 text-amber-600',
  },
];

export default async function ReportsHubPage() {
  await requireAuth();

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-kartini-green" />
          Laporan
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Analisis stok, valuasi, dan performa SO.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {REPORT_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="border-stone-200 shadow-soft-sm hover:shadow-soft-md hover:border-kartini-green/30 transition h-full p-5">
                <div className={`w-10 h-10 rounded-lg ${item.color} flex items-center justify-center mb-4`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-stone-900 mb-1">{item.title}</h3>
                <p className="text-sm text-stone-500">{item.description}</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
