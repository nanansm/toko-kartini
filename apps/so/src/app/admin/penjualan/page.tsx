import type { Metadata } from 'next';
import { requireRole, PERMISSIONS } from '@/lib/session';
import { ImporPenjualan } from '@/components/penjualan/impor-penjualan';

export const metadata: Metadata = {
  title: 'Impor Penjualan — Toko Kartini',
};

export default async function HalamanImporPenjualanPage() {
  // Penjaga halaman sama dengan penjaga route-nya (PERMISSIONS.KELOLA_PENGGUNA).
  // Menu yang lebih longgar daripada penjaga = staf diantar ke 403.
  await requireRole(PERMISSIONS.KELOLA_PENGGUNA);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Impor Penjualan</h1>
        <p className="text-sm text-stone-500 mt-1">
          Export POS &ldquo;Item Penjualan berdasarkan Tanggal&rdquo; (.xlsx) jadi tab Penjualan.
          Angka ini yang menentukan sisa Area Display.
        </p>
      </div>
      <ImporPenjualan />
    </div>
  );
}
