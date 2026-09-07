import type { Metadata } from 'next';
import { requireRole, PERMISSIONS } from '@/lib/session';
import { KelolaPengguna } from '@/components/admin/KelolaPengguna';

export const metadata: Metadata = {
  title: 'Kelola Pengguna — Toko Kartini',
};

export default async function HalamanPenggunaPage() {
  await requireRole(PERMISSIONS.KELOLA_PENGGUNA);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <h1 className="text-2xl font-semibold">Kelola Pengguna</h1>
      <KelolaPengguna />
    </div>
  );
}
