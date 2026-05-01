import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--color-kartini-primary)] text-white text-2xl font-bold">
          TK
        </div>
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-kartini-primary)]">Toko Kartini</h1>
          <p className="text-sm text-slate-500 mt-1">Sistem Stock Opname</p>
        </div>
        <p className="text-slate-600">
          Sistem digital untuk pencatatan stock opname harian, mingguan, dan bulanan dengan valuasi
          otomatis.
        </p>
        <Link
          href="/login"
          className="inline-block w-full px-6 py-3 rounded-xl bg-[var(--color-kartini-primary)] text-white font-semibold hover:opacity-90 transition"
        >
          Masuk ke Sistem
        </Link>
        <p className="text-xs text-slate-400">v0.1.0 · Phase 1 · Foundation</p>
      </div>
    </main>
  );
}
