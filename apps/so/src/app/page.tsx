import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { Logo } from '@/components/brand/Logo';

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  return (
    <main className="min-h-screen bg-gradient-to-br from-stone-50 via-stone-50 to-kartini-green-light flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <Logo size="lg" showText />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-stone-900">Sistem Stock Opname</h1>
          <p className="text-sm text-stone-500 mt-2">
            Pencatatan stock opname digital harian, mingguan, dan bulanan dengan valuasi otomatis
            untuk Toko Kartini.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-block w-full px-6 py-3 rounded-xl bg-kartini-green text-white font-semibold hover:bg-kartini-green-dark transition shadow-lg shadow-kartini-green/20"
        >
          Masuk ke Sistem
        </Link>
        <p className="text-xs text-stone-400">v0.2.0 · Phase 1</p>
      </div>
    </main>
  );
}
