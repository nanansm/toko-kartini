import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  MOVEMENT_TYPE_META,
  type MovementTypeFilter,
} from '@/lib/inventory/movement-meta';

interface MovementRowItem {
  id: string;
  productId: string;
  productName: string;
  locationCode: string;
  locationName: string;
  movementType: string;
  qtyInBase: string;
  unitNameUsed: string;
  notes: string | null;
  createdAt: Date;
  createdByName: string | null;
}

const datetimeFmt = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function MovementRow({ movement }: { movement: MovementRowItem }) {
  const meta =
    MOVEMENT_TYPE_META[movement.movementType as MovementTypeFilter] ?? {
      label: movement.movementType,
      badgeClass: 'bg-stone-100 text-stone-700 hover:bg-stone-100',
      sign: 'neutral' as const,
    };

  const qty = Number(movement.qtyInBase);
  const isPositive = qty >= 0;

  return (
    <div className="p-4 hover:bg-stone-50 flex items-center gap-3">
      <Badge className={cn(meta.badgeClass, 'border-0 text-xs flex-shrink-0')}>
        {meta.label}
      </Badge>
      <div className="flex-1 min-w-0">
        <Link
          href={`/master/products/${movement.productId}`}
          className="font-medium text-sm text-stone-900 hover:text-kartini-green truncate block"
        >
          {movement.productName}
        </Link>
        <div className="text-xs text-stone-500 truncate">
          <span className="font-mono">{movement.locationCode}</span> · {movement.unitNameUsed}
          {movement.createdByName && ` · ${movement.createdByName}`}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div
          className={cn(
            'font-semibold text-sm tabular-nums',
            isPositive ? 'text-green-700' : 'text-red-700',
          )}
        >
          {isPositive ? '+' : ''}
          {qty.toLocaleString('id-ID')}
        </div>
        <div className="text-xs text-stone-400">
          {datetimeFmt.format(new Date(movement.createdAt))}
        </div>
      </div>
    </div>
  );
}
