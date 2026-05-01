import Link from 'next/link';
import { db, products, suppliers, customers, locations } from '@kartini/db';
import { count, eq } from 'drizzle-orm';
import { Card, CardContent } from '@/components/ui/card';
import {
  Package,
  Truck,
  Users,
  MapPin,
  TrendingUp,
  ArrowRightLeft,
  Boxes,
  type LucideIcon,
} from 'lucide-react';
import { requireAuth } from '@/lib/session';
import { cn } from '@/lib/utils';

export default async function DashboardPage() {
  const user = await requireAuth();

  const [productsCount, suppliersCount, customersCount, locationsCount] = await Promise.all([
    db.select({ count: count() }).from(products).where(eq(products.isActive, true)),
    db.select({ count: count() }).from(suppliers).where(eq(suppliers.isActive, true)),
    db.select({ count: count() }).from(customers).where(eq(customers.isActive, true)),
    db.select({ count: count() }).from(locations).where(eq(locations.isActive, true)),
  ]);

  const stats = [
    {
      label: 'Produk Aktif',
      value: productsCount[0]?.count ?? 0,
      icon: Package,
      bgClass: 'bg-kartini-green-light',
      iconClass: 'text-kartini-green',
    },
    {
      label: 'Supplier',
      value: suppliersCount[0]?.count ?? 0,
      icon: Truck,
      bgClass: 'bg-blue-50',
      iconClass: 'text-blue-600',
    },
    {
      label: 'Customer B2B',
      value: customersCount[0]?.count ?? 0,
      icon: Users,
      bgClass: 'bg-kartini-orange-light',
      iconClass: 'text-kartini-orange',
    },
    {
      label: 'Lokasi',
      value: locationsCount[0]?.count ?? 0,
      icon: MapPin,
      bgClass: 'bg-purple-50',
      iconClass: 'text-purple-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900">
          Selamat datang, {user.name.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Berikut ringkasan data master Toko Kartini hari ini.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="border-stone-200 shadow-soft-sm py-4 gap-3">
              <CardContent className="px-4 lg:px-5">
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center mb-3',
                    stat.bgClass,
                  )}
                >
                  <Icon className={cn('w-5 h-5', stat.iconClass)} />
                </div>
                <div className="text-2xl lg:text-3xl font-bold text-stone-900 tabular-nums">
                  {stat.value.toLocaleString('id-ID')}
                </div>
                <div className="text-xs lg:text-sm text-stone-500 mt-0.5">{stat.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-gradient-to-br from-kartini-green-light to-stone-50 border-kartini-green/20 py-5 gap-3">
        <CardContent className="px-5 lg:px-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-kartini-green text-white flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-stone-900">Phase 1: Master Data Ready</h3>
              <p className="text-sm text-stone-600 mt-1">
                Master produk, supplier, dan customer sudah ter-sync dari Google Sheet. Modul Stock
                Opname (Movement, SO Mingguan, Bulanan) akan dibangun di Week 3-5.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-stone-900 mb-3">Akses Cepat</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <QuickActionCard
            title="Stok per Lokasi"
            description="Lihat stok di tiap lokasi fisik"
            icon={Boxes}
            href="/inventory"
          />
          <QuickActionCard
            title="Lihat Master Produk"
            description={`${(productsCount[0]?.count ?? 0).toLocaleString('id-ID')} produk tersedia`}
            icon={Package}
            href="/master/products"
          />
          <QuickActionCard
            title="Movement Baru"
            description="Transfer, pembelian, adjustment"
            icon={ArrowRightLeft}
            href="/movements"
            primary
          />
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({
  title,
  description,
  icon: Icon,
  href,
  primary = false,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'block p-4 rounded-xl border transition-all',
        primary
          ? 'bg-kartini-green text-white border-kartini-green hover:bg-kartini-green-dark'
          : 'bg-white border-stone-200 hover:border-stone-300 hover:shadow-soft-md',
      )}
    >
      <Icon className={cn('w-5 h-5 mb-2', primary ? 'text-white' : 'text-stone-500')} />
      <div className={cn('font-semibold text-sm', primary ? 'text-white' : 'text-stone-900')}>
        {title}
      </div>
      <div className={cn('text-xs mt-0.5', primary ? 'text-white/80' : 'text-stone-500')}>
        {description}
      </div>
    </Link>
  );
}
