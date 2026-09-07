import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PwaDaftar } from '@/components/pwa-daftar';
import { BottomNav } from '@/components/layout/BottomNav';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Gudang Toko Kartini',
  description: 'Pencatatan gudang Toko Kartini',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Kartini', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#0f7a3e',
  // Staf memakai HP di gudang; zoom cubit tetap diizinkan supaya angka kecil
  // masih bisa diperbesar, jadi `maximumScale` sengaja tidak dikunci.
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Peran dibaca di sini, bukan di dalam BottomNav: penyaring menu per peran
  // ada di sisi server, dan komponen navigasinya sendiri berjalan di peramban.
  const user = await getCurrentUser();

  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/ikon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/ikon.svg" />
      </head>
      <body>
        {/* Pengirim latar dipasang di akar, bukan di /catat: antrean harus tetap
            terkuras walau staf sudah pindah halaman setelah menyimpan. */}
        <PwaDaftar />
        {children}
        {user && <BottomNav peran={user.peran} />}
      </body>
    </html>
  );
}
