import Link from 'next/link';
import { Card } from '@/components/ui/card';
import {
  PackageOpen,
  ArrowRightLeft,
  ShoppingCart,
  Wrench,
  History,
  type LucideIcon,
} from 'lucide-react';
import { requireAuth } from '@/lib/session';
import { getMovements } from '@/lib/queries/movements';
import { MovementRow } from './_components/MovementRow';
import type { UserRole } from '@/lib/roles';
import { cn } from '@/lib/utils';

interface ActionCard {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
  iconClass: string;
}

const ALL_ACTIONS: ActionCard[] = [
  {
    title: 'Opening Balance',
    description: 'Input stok awal sistem',
    href: '/movements/opening-balance',
    icon: PackageOpen,
    roles: ['OWNER'],
    iconClass: 'bg-blue-50 text-blue-600',
  },
  {
    title: 'Transfer',
    description: 'Pindah stok antar lokasi',
    href: '/movements/transfer',
    icon: ArrowRightLeft,
    roles: ['OWNER', 'ADMIN', 'SUPERVISOR', 'STAF_GUDANG'],
    iconClass: 'bg-kartini-green-light text-kartini-green',
  },
  {
    title: 'Pembelian Masuk',
    description: 'Terima barang dari supplier',
    href: '/movements/purchase',
    icon: ShoppingCart,
    roles: ['OWNER', 'ADMIN', 'SUPERVISOR'],
    iconClass: 'bg-kartini-orange-light text-kartini-orange',
  },
  {
    title: 'Adjustment / Waste',
    description: 'Koreksi atau catat barang rusak',
    href: '/movements/adjustment',
    icon: Wrench,
    roles: ['OWNER', 'ADMIN', 'SUPERVISOR'],
    iconClass: 'bg-red-50 text-red-600',
  },
];

export default async function MovementsHubPage() {
  const user = await requireAuth();
  const recent = await getMovements({ page: 1, pageSize: 10 });
  const actions = ALL_ACTIONS.filter((a) => a.roles.includes(user.role));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 flex items-center gap-2">
          <ArrowRightLeft className="w-6 h-6 text-kartini-green" />
          Movement Stok
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Catat semua aktivitas pergerakan stok: transfer, pembelian, adjustment.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-stone-700 mb-3">Aksi Cepat</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                className="block p-4 rounded-xl bg-white border border-stone-200 hover:border-stone-300 hover:shadow-soft-md transition"
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center mb-3',
                    a.iconClass,
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="font-semibold text-stone-900 text-sm">{a.title}</div>
                <div className="text-xs text-stone-500 mt-0.5">{a.description}</div>
              </Link>
            );
          })}
        </div>
      </div>

      <Card className="border-stone-200 shadow-soft-sm overflow-hidden p-0 gap-0">
        <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
          <h2 className="font-semibold text-stone-900 flex items-center gap-2 text-sm">
            <History className="w-4 h-4" />
            Aktivitas Terbaru
          </h2>
          <Link
            href="/movements/history"
            className="text-xs text-kartini-green hover:underline font-medium"
          >
            Lihat semua →
          </Link>
        </div>

        {recent.items.length === 0 ? (
          <div className="p-8 text-center text-sm text-stone-500">
            Belum ada movement. Mulai dari aksi cepat di atas.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {recent.items.map((m) => (
              <MovementRow key={m.id} movement={m} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
