import {
  Home,
  ClipboardPlus,
  ClipboardCheck,
  Scale,
  Package,
  ShoppingCart,
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
// menu pendek.
//
// Dua halaman admin (/admin/pengguna, /admin/data-pincang) sengaja TIDAK di
// sini walau ada dan bisa diakses: batangnya memakai `flex-1` per butir, jadi
// di layar 360px delapan butir menyisakan 45px per label dan tulisannya patah.
// Keduanya sudah punya tautan sendiri di Beranda, yang memang tempatnya —
// dipakai sesekali oleh dua peran, bukan tiap hari oleh semua staf.
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
    label: 'Hitung',
    href: '/hitung',
    icon: ClipboardCheck,
    roles: ['OWNER', 'ADMIN', 'SUPERVISOR', 'STAF_GUDANG'],
  },
  {
    label: 'Tinjau',
    href: '/tinjau',
    icon: Scale,
    roles: ['OWNER', 'ADMIN', 'SUPERVISOR'],
  },
  {
    label: 'Barang',
    href: '/barang',
    icon: Package,
    roles: ['OWNER', 'ADMIN', 'SUPERVISOR', 'STAF_GUDANG'],
  },
  {
    label: 'Pesanan',
    href: '/pesanan',
    icon: ShoppingCart,
    roles: ['OWNER', 'ADMIN', 'SUPERVISOR', 'STAF_GUDANG'],
  },
];
