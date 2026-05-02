'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, ThumbsUp, ThumbsDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { approveSOItem, rejectSOItem } from '@/lib/inventory/so-actions';
import type { SOItem } from './SOItemList';

export function SOItemApprovalDialog({
  item,
  onClose,
}: {
  item: SOItem;
  onClose: () => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);

  async function handleSubmit() {
    if (!action) return;
    if (reason.length < 5) {
      toast.error('Alasan minimal 5 karakter');
      return;
    }
    setSubmitting(true);
    const result =
      action === 'approve'
        ? await approveSOItem({ itemId: item.id, approvalReason: reason })
        : await rejectSOItem({ itemId: item.id, rejectionReason: reason });
    setSubmitting(false);
    if (result.ok) {
      toast.success(action === 'approve' ? 'Item di-approve' : 'Item di-reject');
      router.refresh();
      onClose();
    } else {
      toast.error(result.error ?? 'Gagal');
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{item.productName}</DialogTitle>
          <DialogDescription className="text-xs space-y-1">
            <span className="block">
              Stok sistem:{' '}
              <span className="font-semibold">
                {Number(item.qtySystemBase).toLocaleString('id-ID')}
              </span>
            </span>
            <span className="block">
              Stok fisik:{' '}
              <span className="font-semibold">
                {Number(item.qtyPhysicalBase ?? 0).toLocaleString('id-ID')}
              </span>
            </span>
            <span
              className={`block font-bold ${
                Number(item.differenceBase ?? 0) < 0 ? 'text-red-600' : 'text-green-600'
              }`}
            >
              Selisih: {Number(item.differenceBase ?? 0) > 0 ? '+' : ''}
              {Number(item.differenceBase ?? 0).toLocaleString('id-ID')} (
              {Number(item.differencePercent ?? 0).toFixed(1)}%)
            </span>
            {item.notes && (
              <span className="block text-stone-500">Catatan: {item.notes}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setAction('approve')}
              className={`flex-1 h-10 rounded-lg flex items-center justify-center gap-2 font-semibold text-sm transition ${
                action === 'approve'
                  ? 'bg-green-600 text-white'
                  : 'bg-green-50 text-green-700 hover:bg-green-100'
              }`}
            >
              <ThumbsUp className="w-4 h-4" />
              Approve
            </button>
            <button
              onClick={() => setAction('reject')}
              className={`flex-1 h-10 rounded-lg flex items-center justify-center gap-2 font-semibold text-sm transition ${
                action === 'reject'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              <ThumbsDown className="w-4 h-4" />
              Reject
            </button>
          </div>

          {action && (
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={
                action === 'approve'
                  ? 'Alasan approve (mis. shrinkage wajar, barang rusak)...'
                  : 'Alasan reject (suruh recount, perlu konfirmasi)...'
              }
              className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-200 resize-none"
            />
          )}
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !action || reason.length < 5}
            className={`h-10 px-4 rounded-lg text-white font-semibold text-sm disabled:opacity-50 flex items-center gap-2 transition ${
              action === 'approve'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {action === 'approve' ? 'Konfirmasi Approve' : 'Konfirmasi Reject'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
