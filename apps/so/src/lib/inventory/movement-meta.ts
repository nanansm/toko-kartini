export type MovementTypeFilter =
  | 'OPENING_BALANCE'
  | 'PURCHASE_IN'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'SALE_OUT'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'WASTE';

export const MOVEMENT_TYPE_META: Record<
  MovementTypeFilter,
  { label: string; badgeClass: string; sign: 'positive' | 'negative' | 'neutral' }
> = {
  OPENING_BALANCE: {
    label: 'Opening',
    badgeClass: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
    sign: 'neutral',
  },
  PURCHASE_IN: {
    label: 'Beli Masuk',
    badgeClass: 'bg-green-100 text-green-700 hover:bg-green-100',
    sign: 'positive',
  },
  TRANSFER_OUT: {
    label: 'Transfer Keluar',
    badgeClass: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
    sign: 'negative',
  },
  TRANSFER_IN: {
    label: 'Transfer Masuk',
    badgeClass: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
    sign: 'positive',
  },
  SALE_OUT: {
    label: 'Jual',
    badgeClass: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
    sign: 'negative',
  },
  ADJUSTMENT_IN: {
    label: 'Adj +',
    badgeClass: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-100',
    sign: 'positive',
  },
  ADJUSTMENT_OUT: {
    label: 'Adj -',
    badgeClass: 'bg-rose-100 text-rose-700 hover:bg-rose-100',
    sign: 'negative',
  },
  WASTE: {
    label: 'Rusak',
    badgeClass: 'bg-red-100 text-red-700 hover:bg-red-100',
    sign: 'negative',
  },
};
