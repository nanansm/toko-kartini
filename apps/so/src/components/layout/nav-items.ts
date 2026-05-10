import {
  LayoutDashboard,
  Package,
  Truck,
  Users,
  Tags,
  RefreshCw,
  UserCog,
  Settings,
  Boxes,
  ArrowRightLeft,
  ClipboardCheck,
  FileSpreadsheet,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/lib/roles';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['OWNER', 'ADMIN', 'SUPERVISOR', 'STAF_GUDANG'],
  },
  {
    label: 'Stok',
    href: '/inventory',
    icon: Boxes,
    roles: ['OWNER', 'ADMIN', 'SUPERVISOR', 'STAF_GUDANG'],
  },
  {
    label: 'Movement',
    href: '/movements',
    icon: ArrowRightLeft,
    roles: ['OWNER', 'ADMIN', 'SUPERVISOR', 'STAF_GUDANG'],
  },
  {
    label: 'Stock Opname',
    href: '/so',
    icon: ClipboardCheck,
    roles: ['OWNER', 'ADMIN', 'SUPERVISOR', 'STAF_GUDANG'],
  },
  {
    label: 'Laporan',
    href: '/reports',
    icon: BarChart3,
    roles: ['OWNER', 'ADMIN', 'SUPERVISOR'],
  },
  {
    label: 'Import Olsera',
    href: '/olsera-import',
    icon: FileSpreadsheet,
    roles: ['OWNER', 'ADMIN'],
  },
  {
    label: 'Produk',
    href: '/master/products',
    icon: Package,
    roles: ['OWNER', 'ADMIN', 'SUPERVISOR', 'STAF_GUDANG'],
  },
  {
    label: 'Supplier',
    href: '/master/suppliers',
    icon: Truck,
    roles: ['OWNER', 'ADMIN', 'SUPERVISOR'],
  },
  {
    label: 'Customer',
    href: '/master/customers',
    icon: Users,
    roles: ['OWNER', 'ADMIN', 'SUPERVISOR'],
  },
  {
    label: 'Kategori',
    href: '/master/categories',
    icon: Tags,
    roles: ['OWNER', 'ADMIN', 'SUPERVISOR', 'STAF_GUDANG'],
  },
  {
    label: 'Sinkronisasi',
    href: '/sync',
    icon: RefreshCw,
    roles: ['OWNER', 'ADMIN'],
  },
  {
    label: 'Pengguna',
    href: '/users',
    icon: UserCog,
    roles: ['OWNER'],
  },
  {
    label: 'Pengaturan',
    href: '/settings',
    icon: Settings,
    roles: ['OWNER'],
  },
];
