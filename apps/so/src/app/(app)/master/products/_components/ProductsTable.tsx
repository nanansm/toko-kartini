import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatRupiah } from '@/lib/format';

export interface ProductItem {
  id: string;
  name: string;
  categoryL1: string;
  categoryL2: string | null;
  hppPerL1: string | null;
  sellPriceHj3: string | null;
  isActive: boolean;
  supplierName: string | null;
}

export function ProductsTable({ items }: { items: ProductItem[] }) {
  if (items.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="text-4xl mb-2">📦</div>
        <p className="text-sm text-stone-500">Tidak ada produk yang cocok dengan filter</p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide">
                ID
              </th>
              <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide">
                Nama Produk
              </th>
              <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide">
                Kategori
              </th>
              <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide">
                Supplier
              </th>
              <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide text-right">
                HPP
              </th>
              <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide text-right">
                Harga Eceran
              </th>
              <th className="px-4 py-3 font-semibold text-stone-600 text-xs uppercase tracking-wide">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-stone-50 transition">
                <td className="px-4 py-3">
                  <Link
                    href={`/master/products/${item.id}`}
                    className="font-mono text-xs text-stone-500 hover:text-kartini-green"
                  >
                    {item.id}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/master/products/${item.id}`}
                    className="font-medium text-stone-900 hover:text-kartini-green"
                  >
                    {item.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="text-stone-600">{item.categoryL1}</div>
                  {item.categoryL2 && (
                    <div className="text-xs text-stone-400">{item.categoryL2}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-stone-600">{item.supplierName ?? '-'}</td>
                <td className="px-4 py-3 text-right text-stone-700 tabular-nums">
                  {formatRupiah(item.hppPerL1)}
                </td>
                <td className="px-4 py-3 text-right text-stone-700 tabular-nums">
                  {formatRupiah(item.sellPriceHj3)}
                </td>
                <td className="px-4 py-3">
                  {item.isActive ? (
                    <Badge className="bg-kartini-green-light text-kartini-green-dark hover:bg-kartini-green-light border-0">
                      Aktif
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-stone-100 text-stone-600 border-0">
                      Nonaktif
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-stone-100">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/master/products/${item.id}`}
            className="block p-4 hover:bg-stone-50 transition"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="font-medium text-stone-900 text-sm leading-tight flex-1">
                {item.name}
              </div>
              {item.isActive ? (
                <Badge className="bg-kartini-green-light text-kartini-green-dark hover:bg-kartini-green-light border-0 text-[10px] px-2 py-0.5 flex-shrink-0">
                  Aktif
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="bg-stone-100 text-stone-600 border-0 text-[10px] px-2 py-0.5 flex-shrink-0"
                >
                  Nonaktif
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="text-stone-500">
                {item.categoryL1} · {item.supplierName ?? 'Tanpa supplier'}
              </div>
              <div className="font-semibold text-stone-700 tabular-nums">
                {formatRupiah(item.sellPriceHj3)}
              </div>
            </div>
            <div className="text-[10px] text-stone-400 font-mono mt-1">{item.id}</div>
          </Link>
        ))}
      </div>
    </>
  );
}
