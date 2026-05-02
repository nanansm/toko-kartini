'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Send, ThumbsUp, ThumbsDown, X } from 'lucide-react';
import {
  submitSOSession,
  approveSOSession,
  rejectSOSession,
  cancelSOSession,
} from '@/lib/inventory/so-actions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const APPROVER_ROLES = ['OWNER', 'ADMIN', 'SUPERVISOR'];

interface Props {
  session: { id: string; status: string };
  statusCounts: Record<string, number>;
  userRole: string;
}

export function SOActionButtons({ session, statusCounts, userRole }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const pending = statusCounts.PENDING ?? 0;
  const needsRecount = statusCounts.NEEDS_RECOUNT ?? 0;
  const pendingApproval = statusCounts.PENDING_APPROVAL ?? 0;

  const canSubmit =
    ['DRAFT', 'IN_PROGRESS'].includes(session.status) &&
    pending === 0 &&
    needsRecount === 0;

  const canApprove =
    session.status === 'SUBMITTED' &&
    APPROVER_ROLES.includes(userRole) &&
    pendingApproval === 0;

  const canReject = session.status === 'SUBMITTED' && APPROVER_ROLES.includes(userRole);
  const canCancel = ['DRAFT', 'IN_PROGRESS'].includes(session.status);

  async function handleSubmit() {
    setSubmitting(true);
    const result = await submitSOSession(session.id);
    setSubmitting(false);
    if (result.ok) {
      toast.success(
        result.needsApproval
          ? `Submit berhasil. ${result.pendingApprovalCount} item perlu approval.`
          : `Submit berhasil. Semua ${result.autoApprovedCount} item auto-approved (${result.autoFinalizedAdjustments} adjustment dibuat).`,
      );
      router.refresh();
    } else {
      toast.error(result.error ?? 'Gagal submit');
    }
  }

  async function handleApprove() {
    setSubmitting(true);
    const result = await approveSOSession(session.id);
    setSubmitting(false);
    if (result.ok) {
      toast.success(
        `Approved. ${result.adjustmentsCreated} adjustment movement dibuat.`,
      );
      router.refresh();
    } else {
      toast.error(result.error ?? 'Gagal');
    }
  }

  async function handleCancel() {
    if (!confirm('Yakin cancel SO ini?')) return;
    setSubmitting(true);
    const result = await cancelSOSession(session.id);
    setSubmitting(false);
    if (result.ok) {
      toast.success('SO dibatalkan');
      router.push('/so');
    } else {
      toast.error(result.error ?? 'Gagal');
    }
  }

  if (!canSubmit && !canApprove && !canReject && !canCancel) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {canSubmit && (
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-kartini-green hover:bg-kartini-green-dark text-white font-semibold text-sm transition disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Submit SO
        </button>
      )}

      {canApprove && (
        <button
          onClick={handleApprove}
          disabled={submitting}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ThumbsUp className="w-4 h-4" />
          )}
          Approve SO (Generate Adjustment)
        </button>
      )}

      {canReject && <RejectDialog sessionId={session.id} />}

      {canCancel && (
        <button
          onClick={handleCancel}
          disabled={submitting}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium text-sm transition disabled:opacity-50"
        >
          <X className="w-4 h-4" />
          Cancel SO
        </button>
      )}
    </div>
  );
}

function RejectDialog({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleReject() {
    if (reason.length < 10) {
      toast.error('Alasan minimal 10 karakter');
      return;
    }
    setSubmitting(true);
    const result = await rejectSOSession({ sessionId, reason });
    setSubmitting(false);
    if (result.ok) {
      toast.success('SO di-reject');
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.error ?? 'Gagal');
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-medium text-sm transition">
          <ThumbsDown className="w-4 h-4" />
          Reject SO
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject SO Session?</DialogTitle>
          <DialogDescription>
            SO akan dipindah ke status REJECTED. Tim bisa buat SO baru untuk hitung
            ulang.
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Alasan reject (minimal 10 karakter)..."
          className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100 resize-none"
        />
        <DialogFooter>
          <button
            onClick={() => setOpen(false)}
            className="h-10 px-4 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100"
          >
            Batal
          </button>
          <button
            onClick={handleReject}
            disabled={submitting || reason.length < 10}
            className="h-10 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm disabled:opacity-50"
          >
            {submitting ? 'Memproses...' : 'Reject'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
