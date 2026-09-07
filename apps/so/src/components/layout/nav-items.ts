import {
  Home,
  ClipboardPlus,
  UserCog,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/lib/roles';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
}

// Isi daftar ini HANYA halaman yang benar-benar ada. Menu lama menunjuk 13
// rute modul POS/SO yang sudah dipindah ke cabang legacy-postgres — semuanya
// 404, dan menu yang mengantar staf ke halaman kosong lebih buruk daripada
// menu pendek. Halaman /hitung, /tinjau, /barang, /pesanan menyusul di Tahap 6.
export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Beranda',
    href: '/',
    icon: Home,
    roles: ['OWNER', 'ADMIN', 'SUPERVISOR', 'STAF_GUDANG'],
  },
  {
    label: 'Catat',
    href: '/catat',
    icon: ClipboardPlus,
    roles: ['OWNER', 'ADMIN', 'SUPERVISOR', 'STAF_GUDANG'],
  },
  {
    label: 'Pengguna',
    href: '/admin/pengguna',
    icon: UserCog,
    roles: ['OWNER', 'ADMIN'],
  },
  {
    label: 'Data Pincang',
    href: '/admin/data-pincang',
    icon: AlertTriangle,
    roles: ['OWNER', 'ADMIN'],
  },
];
