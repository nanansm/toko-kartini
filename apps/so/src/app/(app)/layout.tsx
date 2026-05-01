import { requireAuth } from '@/lib/session';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { Toaster } from '@/components/ui/sonner';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();

  return (
    <div className="min-h-screen bg-stone-50">
      <Sidebar userRole={user.role} />
      <Topbar user={user} />

      <main className="lg:pl-60 pb-20 lg:pb-0">
        <div className="max-w-7xl mx-auto p-4 lg:p-8">{children}</div>
      </main>

      <BottomNav />
      <Toaster />
    </div>
  );
}
