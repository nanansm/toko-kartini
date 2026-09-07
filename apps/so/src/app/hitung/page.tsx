import { requireRole, PERMISSIONS } from '@/lib/session';
import { FormHitung } from '@/components/hitung/form-hitung';

export const dynamic = 'force-dynamic';

export default async function HitungPage() {
  await requireRole(PERMISSIONS.MULAI_SO);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Hitung Stok</h1>
        <p className="text-sm text-stone-500 mt-1">
          Pilih satu lokasi, hitung fisik barangnya, lalu kirim. Barang yang tidak kamu
          hitung tidak diubah.
        </p>
      </div>

      <FormHitung />
    </div>
  );
}
