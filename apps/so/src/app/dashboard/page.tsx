import { auth } from '@kartini/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect('/login');

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-kartini-primary)]">Dashboard</h1>
            <p className="text-sm text-slate-500">Selamat datang, {session.user.name}</p>
          </div>
          <div className="text-right text-sm">
            <div className="font-medium text-slate-700">{session.user.email}</div>
            <div className="text-slate-400 text-xs uppercase tracking-wide">
              {(session.user as { role?: string }).role ?? 'STAF_GUDANG'}
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs uppercase text-slate-400 tracking-wide">Lokasi</div>
            <div className="text-3xl font-bold mt-2">3</div>
            <div className="text-xs text-slate-500 mt-1">
              Toko, Gudang Packaging, Ciherang
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs uppercase text-slate-400 tracking-wide">Produk Aktif</div>
            <div className="text-3xl font-bold mt-2">—</div>
            <div className="text-xs text-slate-500 mt-1">Sync dari Master Sheet</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs uppercase text-slate-400 tracking-wide">SO Pending</div>
            <div className="text-3xl font-bold mt-2">0</div>
            <div className="text-xs text-slate-500 mt-1">Menunggu approval</div>
          </div>
        </section>

        <section className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="font-semibold text-amber-900">🚧 Phase 1: Foundation Done</div>
          <p className="text-sm text-amber-800 mt-1">
            Module SO (Movement, Weekly Count, Monthly Valuation) akan dibangun di Week 2-6.
          </p>
        </section>
      </div>
    </main>
  );
}
