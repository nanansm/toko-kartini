import { requirePOSAuth } from '@/lib/session';
import { getActiveShift } from '@/lib/shift-actions';
import { OpenShiftForm } from '@/components/shift/OpenShiftForm';
import { ShiftDashboard } from '@/components/shift/ShiftDashboard';

export default async function POSPage() {
  const user = await requirePOSAuth();
  const activeShift = await getActiveShift(user.id);

  if (!activeShift) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)] p-6">
        <OpenShiftForm userName={user.name} />
      </div>
    );
  }

  return <ShiftDashboard shift={activeShift} user={user} />;
}
