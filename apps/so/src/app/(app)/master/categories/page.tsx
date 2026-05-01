import Link from 'next/link';
import { Tags, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getCategoryTree } from '@/lib/queries/categories';
import { requireAuth } from '@/lib/session';

export default async function CategoriesPage() {
  await requireAuth();
  const rows = await getCategoryTree();

  // Group by L1
  const grouped = new Map<
    string,
    { children: { l2: string | null; productCount: number; activeCount: number }[]; total: number; active: number }
  >();
  for (const r of rows) {
    if (!grouped.has(r.l1)) grouped.set(r.l1, { children: [], total: 0, active: 0 });
    const g = grouped.get(r.l1)!;
    g.children.push({ l2: r.l2, productCount: r.productCount, activeCount: r.activeCount });
    g.total += r.productCount;
    g.active += r.activeCount;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 flex items-center gap-2">
          <Tags className="w-6 h-6 text-kartini-green" />
          Master Kategori
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          {grouped.size} kategori L1 ·{' '}
          {rows.reduce((sum, r) => sum + r.productCount, 0).toLocaleString('id-ID')} produk total
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[...grouped.entries()].map(([l1, group]) => (
          <Card key={l1} className="border-stone-200 shadow-soft-sm py-4 gap-3">
            <CardContent className="px-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/master/products?cat=${encodeURIComponent(l1)}`}
                  className="font-semibold text-stone-900 hover:text-kartini-green flex items-center gap-1 group min-w-0"
                >
                  <span className="truncate">{l1}</span>
                  <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-kartini-green flex-shrink-0" />
                </Link>
                <Badge
                  variant="secondary"
                  className="bg-kartini-green-light text-kartini-green-dark border-0 flex-shrink-0"
                >
                  {group.total.toLocaleString('id-ID')}
                </Badge>
              </div>
              <div className="space-y-1.5">
                {group.children.map((c, idx) => (
                  <div
                    key={`${l1}-${c.l2 ?? '_null'}-${idx}`}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-stone-600 truncate">{c.l2 ?? '— (tanpa L2)'}</span>
                    <span className="text-xs text-stone-400 tabular-nums flex-shrink-0">
                      {c.activeCount.toLocaleString('id-ID')} aktif / {c.productCount.toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
