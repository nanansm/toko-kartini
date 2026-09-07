import type { Metadata } from 'next';
import { Logo } from '@/components/brand/Logo';
import { FormMasuk } from '@/components/masuk/FormMasuk';

export const metadata: Metadata = {
  title: 'Masuk — Toko Kartini',
};

export default function MasukPage() {
  return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Logo size="lg" showText />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-stone-900">Masuk</h1>
            <p className="text-sm text-stone-500 mt-1">
              Sistem Gudang Toko Kartini
            </p>
          </div>
        </div>
        <FormMasuk />
      </div>
    </main>
  );
}
