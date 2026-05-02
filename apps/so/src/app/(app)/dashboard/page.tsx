import Link from 'next/link';
import {
  db,
  products,
  suppliers,
  customers,
  locations,
  stockCountSessions,
  olseraImportLogs,
} from '@kartini/db';
import { count, eq, inArray, gte, sum, desc, and } from 'drizzle-orm';
import { Card, CardContent } from '@/components/ui/card';
import {
  Package,
  Truck,
  Users,
  MapPin,
  TrendingUp,
  ArrowRightLeft,
  Boxes,
  ClipboardCheck,
  CheckCircle2,
  FileSpreadsheet,
  type LucideIcon,
} from 'lucide-react';
import { requireAuth } from '@/lib/session';
import { cn } from '@/lib/utils';

function formatRupiahShort(num: number): string {
  if (num === 0) return 'Rp 0';
  const sign = num < 0 ? '-' : '';
  return (
    sign +
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(Math.abs(num))
  );
}

export default async function DashboardPage() {
  const user = await requireAuth();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    productsCount,
    suppliersCount,
    customersCount,
    locationsCount,
    soActiveRows,
    soThisMonthRows,
    lastOlseraRows,
  ] = await Promise.all([
    db.select({ count: count() }).from(products).where(eq(products.isActive, true)),
    db.select({ count: count() }).from(suppliers).where(eq(suppliers.isActive, true)),
    db.select({ count: count() }).from(customers).where(eq(customers.isActive, true)),
    db.select({ count: count() }).from(locations).where(eq(locations.isActive, true)),
    db
      .select({ count: count() })
      .from(stockCountSessions)
      .where(
        inArray(stockCountSessions.status, ['DRAFT', 'IN_PROGRESS', 'SUBMITTED']),
      ),
    db
      .select({
        count: count(),
        totalDiff: sum(stockCountSessions.totalDifferenceValueRp),
      })
      .from(stockCountSessions)
      .where(
        and(
          eq(stockCountSessions.status, 'APPROVED'),
          gte(stockCountSessions.approvedAt, monthStart),
        ),
      ),
    db
      .select({
        committedAt: olseraImportLogs.committedAt,
        movementsCreated: olseraImportLogs.movementsCreated,
      })
      .from(olseraImportLogs)
      .where(eq(olseraImportLogs.status, 'COMMITTED'))
      .orderBy(desc(olseraImportLogs.committedAt))
      .limit(1),
  ]);

  const soActive = soActiveRows[0]?.count ?? 0;
  const soThisMonth = soThisMonthRows[0]?.count ?? 0;
  const soThisMonthDiff = Number(soThisMonthRows[0]?.totalDiff ?? 0);
  const lastOlsera = lastOlseraRows[0];

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

      {/* Operasional cards: SO + Olsera */}
      <div>
        <h2 className="text-lg font-semibold text-stone-900 mb-3 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-kartini-green" />
          Operasional
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link href="/so" className="block">
            <Card className="border-stone-200 shadow-soft-sm py-4 gap-2 hover:border-kartini-green/30 transition">
              <CardContent className="px-4 lg:px-5">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-2">
                  <ClipboardCheck className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-stone-900 tabular-nums">
                  {soActive.toLocaleString('id-ID')}
                </div>
                <div className="text-xs text-stone-500 mt-0.5">SO Aktif</div>
                <div className="text-[10px] text-stone-400 mt-1">
                  Draft / In Progress / Menunggu approval
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/so?status=APPROVED" className="block">
            <Card className="border-stone-200 shadow-soft-sm py-4 gap-2 hover:border-kartini-green/30 transition">
              <CardContent className="px-4 lg:px-5">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-2xl font-bold text-stone-900 tabular-nums">
                  {soThisMonth.toLocaleString('id-ID')}
                </div>
                <div className="text-xs text-stone-500 mt-0.5">SO Selesai Bulan Ini</div>
                <div
                  className={cn(
                    'text-[10px] mt-1 tabular-nums',
                    soThisMonthDiff < 0
                      ? 'text-red-600'
                      : soThisMonthDiff > 0
                        ? 'text-green-600'
                        : 'text-stone-400',
                  )}
                >
                  Selisih nilai: {formatRupiahShort(soThisMonthDiff)}
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/olsera-import" className="block">
            <Card className="border-stone-200 shadow-soft-sm py-4 gap-2 hover:border-kartini-green/30 transition">
              <CardContent className="px-4 lg:px-5">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center mb-2">
                  <FileSpreadsheet className="w-5 h-5 text-amber-600" />
                </div>
                <div className="text-sm font-bold text-stone-900">
                  {lastOlsera?.committedAt
                    ? new Date(lastOlsera.committedAt).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Belum pernah'}
                </div>
                <div className="text-xs text-stone-500 mt-0.5">Sync Olsera Terakhir</div>
                <div className="text-[10px] text-stone-400 mt-1">
                  {lastOlsera
                    ? `${lastOlsera.movementsCreated.toLocaleString('id-ID')} movements`
                    : 'Upload Excel sales report'}
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

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
            title="Movement"
            description="Transfer, pembelian, adjustment"
            icon={ArrowRightLeft}
            href="/movements"
          />
          <QuickActionCard
            title="Mulai SO Baru"
            description="Hitung stok fisik vs sistem"
            icon={ClipboardCheck}
            href="/so/new"
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
