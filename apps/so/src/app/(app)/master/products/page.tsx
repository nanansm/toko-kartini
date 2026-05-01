import { Card } from '@/components/ui/card';
import { Package } from 'lucide-react';
import { getProducts, getCategoriesL1 } from '@/lib/queries/products';
import { ProductsTable } from './_components/ProductsTable';
import { ProductsFilters } from './_components/ProductsFilters';
import { ProductsPagination } from './_components/ProductsPagination';

interface PageProps {
  searchParams: Promise<{
    q?: string;
    cat?: string;
    page?: string;
  }>;
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1') || 1);

  const [data, categories] = await Promise.all([
    getProducts({
      search: params.q,
      categoryL1: params.cat,
      page,
      pageSize: 50,
    }),
    getCategoriesL1(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 flex items-center gap-2">
          <Package className="w-6 h-6 text-kartini-green" />
          Master Produk
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          {data.total.toLocaleString('id-ID')} produk · sumber data: Google Sheet
        </p>
      </div>

      <Card className="border-stone-200 shadow-soft-sm py-4">
        <div className="px-4">
          <ProductsFilters categories={categories} />
        </div>
      </Card>

      <Card className="border-stone-200 shadow-soft-sm overflow-hidden p-0 gap-0">
        <ProductsTable items={data.items} />
        {data.totalPages > 1 && (
          <div className="border-t border-stone-200 px-4 py-3">
            <ProductsPagination
              currentPage={data.page}
              totalPages={data.totalPages}
              total={data.total}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
