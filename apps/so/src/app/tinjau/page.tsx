import { redirect } from 'next/navigation';
import { requireRole, PERMISSIONS } from '@/lib/session';
import { MODE_LAPORAN } from '@/lib/mode';
import { DaftarTinjau } from '@/components/tinjau/daftar-tinjau';

export const dynamic = 'force-dynamic';

export default async function TinjauPage() {
  // Model laporan: buku besar yang sah ada di aplikasi tim, bukan di sini.
  // Halaman ini tidak dihapus supaya arah masih bisa dibalik dengan satu saklar.
  if (MODE_LAPORAN) redirect('/');

  await requireRole(PERMISSIONS.TINJAU_SO);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Tinjau Hasil Hitung</h1>
        <p className="text-sm text-stone-500 mt-1">
          Hasil hitung yang bentrok dengan mutasi yang masuk saat penghitungan berlangsung,
          menunggu diputuskan.
        </p>
      </div>

      <DaftarTinjau />
    </div>
  );
}
