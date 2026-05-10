import { requirePOSAuth } from '@/lib/session';
import { getActiveShift } from '@/lib/shift-actions';
import { POSTopbar } from '@/components/layout/POSTopbar';

export default async function POSLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePOSAuth();
  const activeShift = await getActiveShift(user.id);

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col">
      <POSTopbar user={user} activeShift={activeShift} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
