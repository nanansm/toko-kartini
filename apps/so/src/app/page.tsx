import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { ROLE_LABEL } from '@/lib/roles';
import { canAccess, PERMISSIONS, requireAuth } from '@/lib/session';
import { ambilMetaKatalog } from '@/lib/katalog';
import { formatNumber, formatWaktuWIB } from '@/lib/format';

// Halaman ini sengaja dijaga: ia yang membuktikan sesi benar-benar dipakai,
// bukan cuma dibuat. Isi ringkasannya menyusul di tahap berikutnya.
export default async function HomePage() {
  const user = await requireAuth();
  const meta = await ambilMetaKatalog();

  return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <Logo size="lg" showText />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-stone-900">Sistem Gudang</h1>
          <p className="text-sm text-stone-500 mt-2">
            Masuk sebagai <span className="font-semibold">{user.nama}</span> ·{' '}
            {ROLE_LABEL[user.peran]}
          </p>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4 text-left">
          <div className="text-xs uppercase tracking-wide text-stone-500">Katalog</div>
          {meta ? (
            <>
              <div className="text-2xl font-bold text-stone-900">
                {formatNumber(meta.jumlahProduk)} barang
              </div>
              <div className="text-xs text-stone-500 mt-1">
                {formatNumber(meta.jumlahPincang)} barang pincang disembunyikan · segar{' '}
                {formatWaktuWIB(meta.waktu)}
              </div>
            </>
          ) : (
            <div className="text-sm text-stone-600 mt-1">
              Belum disegarkan. Katalog terisi otomatis oleh penyegar berkala.
            </div>
          )}
        </div>

        {canAccess(user.peran, PERMISSIONS.KELOLA_PENGGUNA) && (
          <div className="space-y-3">
            <Link
              href="/admin/pengguna"
              className="inline-block w-full px-6 py-3 rounded-xl border border-stone-300 bg-white font-semibold text-stone-800 hover:bg-stone-100 transition"
            >
              Kelola Pengguna
            </Link>
            <Link
              href="/admin/data-pincang"
              className="inline-block w-full px-6 py-3 rounded-xl border border-stone-300 bg-white font-semibold text-stone-800 hover:bg-stone-100 transition"
            >
              Data Pincang
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
