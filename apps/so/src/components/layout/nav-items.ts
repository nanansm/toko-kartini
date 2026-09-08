import {
  Home,
  ClipboardPlus,
  ClipboardCheck,
  Scale,
  Package,
  ShoppingCart,
  UserCog,
  FileSpreadsheet,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/lib/roles';
import { MODE_LAPORAN, RUTE_TULIS } from '@/lib/mode';

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
// Dua halaman admin ikut di sini sejak navigasi pindah ke laci samping. Waktu
// menunya masih batang bawah keduanya sengaja dikeluarkan: batang itu memakai
// `flex-1` per butir, jadi di layar 360px delapan butir menyisakan 45px per
// label dan tulisannya patah. Laci tidak punya batas itu — butirnya menumpuk
// ke bawah, selebar laci. Penyaring `roles` yang menjaga siapa melihatnya.
// Daftar sumber TIDAK dipangkas — entri rute tulis tetap tertulis di sini
// supaya menyalakannya lagi cukup ubah `MODE_LAPORAN` jadi `false`.
// Penyaringannya ada di `NAV_ITEMS` di bawah.
const NAV_ITEMS_SUMBER: NavItem[] = [
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
  {
    label: 'Pengguna',
    href: '/admin/pengguna',
    icon: UserCog,
    // Sama persis dengan PERMISSIONS.KELOLA_PENGGUNA yang dipakai halamannya.
    // Menu yang lebih longgar dari penjaga halaman = staf diantar ke 403.
    roles: ['OWNER'],
  },
  {
    label: 'Impor Penjualan',
    href: '/admin/penjualan',
    icon: FileSpreadsheet,
    roles: ['OWNER'],
  },
  {
    label: 'Data Pincang',
    href: '/admin/data-pincang',
    icon: AlertTriangle,
    roles: ['OWNER'],
  },
];

export const NAV_ITEMS: NavItem[] = MODE_LAPORAN
  ? NAV_ITEMS_SUMBER.filter((item) => !RUTE_TULIS.includes(item.href))
  : NAV_ITEMS_SUMBER;
