import { requireRole, PERMISSIONS } from '@/lib/session';
import { FormCatat } from '@/components/catat/form-catat';

export const dynamic = 'force-dynamic';

export default async function CatatPage() {
  await requireRole(PERMISSIONS.CATAT_MUTASI);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Catat Mutasi</h1>
        <p className="text-sm text-stone-500 mt-1">
          Cari barang lewat kotak pencarian, lalu catat mutasi stok.
        </p>
      </div>

      <FormCatat />
    </div>
  );
}
