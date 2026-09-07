import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <Logo size="lg" showText />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-stone-900">Sistem Gudang</h1>
          <p className="text-sm text-stone-500 mt-2">
            Pencatatan stok dan mutasi barang Toko Kartini.
          </p>
        </div>
        <Link
          href="/catat"
          className="inline-block w-full px-6 py-3 rounded-xl bg-kartini-green text-white font-semibold hover:bg-kartini-green-dark transition"
        >
          Mulai Mencatat
        </Link>
      </div>
    </main>
  );
}
