import { Card } from '@/components/ui/card';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  type LucideIcon,
} from 'lucide-react';

interface Props {
  statusCounts: Record<string, number>;
  totalItems: number;
}

export function SOProgress({ statusCounts, totalItems }: Props) {
  const pending = statusCounts.PENDING ?? 0;
  const counted = statusCounts.COUNTED ?? 0;
  const needsRecount = statusCounts.NEEDS_RECOUNT ?? 0;
  const pendingApproval = statusCounts.PENDING_APPROVAL ?? 0;
  const autoApproved = statusCounts.AUTO_APPROVED ?? 0;
  const approved = statusCounts.APPROVED ?? 0;
  const rejected = statusCounts.REJECTED ?? 0;

  const completed = autoApproved + approved + rejected;
  const inProgress = counted + needsRecount + pendingApproval;
  const percentage =
    totalItems > 0 ? Math.round(((completed + inProgress) / totalItems) * 100) : 0;

  return (
    <Card className="border-stone-200 shadow-soft-sm p-4">
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs text-stone-500 mb-1.5">
            <span>Progress</span>
            <span className="font-semibold">{percentage}%</span>
          </div>
          <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-kartini-green rounded-full transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs pt-2">
          <StatusItem icon={Clock} label="Pending" count={pending} color="text-stone-500" />
          <StatusItem
            icon={CheckCircle2}
            label="Counted"
            count={counted}
            color="text-blue-600"
          />
          {needsRecount > 0 && (
            <StatusItem
              icon={AlertTriangle}
              label="Recount"
              count={needsRecount}
              color="text-red-600"
            />
          )}
          {pendingApproval > 0 && (
            <StatusItem
              icon={Clock}
              label="Wait Approve"
              count={pendingApproval}
              color="text-amber-600"
            />
          )}
          {autoApproved > 0 && (
            <StatusItem
              icon={ThumbsUp}
              label="Auto OK"
              count={autoApproved}
              color="text-green-600"
            />
          )}
          {approved > 0 && (
            <StatusItem
              icon={ThumbsUp}
              label="Approved"
              count={approved}
              color="text-green-700"
            />
          )}
          {rejected > 0 && (
            <StatusItem
              icon={ThumbsDown}
              label="Rejected"
              count={rejected}
              color="text-red-700"
            />
          )}
        </div>
      </div>
    </Card>
  );
}

function StatusItem({
  icon: Icon,
  label,
  count,
  color,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <span className="text-stone-500">{label}:</span>
      <span className={`font-semibold ${color}`}>{count}</span>
    </div>
  );
}
