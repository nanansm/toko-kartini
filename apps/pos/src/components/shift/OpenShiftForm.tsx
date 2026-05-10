'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Wallet, Clock } from 'lucide-react';
import { openShift } from '@/lib/shift-actions';

export function OpenShiftForm({ userName }: { userName: string }) {
  const router = useRouter();
  const [openingCash, setOpeningCash] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cash = parseFloat(openingCash.replace(/\./g, '').replace(',', '.') || '0');
    if (isNaN(cash) || cash < 0) {
      toast.error('Modal awal tidak valid');
      return;
    }

    setSubmitting(true);
    const result = await openShift({
      openingCash: cash,
      notes: notes.trim() || undefined,
    });
    setSubmitting(false);

    if (result.ok) {
      toast.success('Shift dibuka. Selamat bekerja');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Gagal buka shift');
    }
  }

  const now = new Date();

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-lg p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-kartini-green-light rounded-2xl flex items-center justify-center mx-auto">
            <Clock className="w-7 h-7 text-kartini-green" />
          </div>
          <h1 className="text-xl font-bold text-stone-900">Buka Shift</h1>
          <p className="text-sm text-stone-500">
            Selamat datang, <strong>{userName}</strong>!
            <br />
            {now.toLocaleDateString('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-stone-700 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-stone-400" />
              Modal Awal Kas
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-medium">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={openingCash}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '');
                  setOpeningCash(raw ? Number(raw).toLocaleString('id-ID') : '');
                }}
                placeholder="0"
                className="w-full h-14 pl-12 pr-4 rounded-xl border-2 border-stone-200 focus:border-kartini-green focus:ring-2 focus:ring-kartini-green/20 text-lg font-semibold text-stone-900 outline-none transition tabular-nums"
              />
            </div>
            <p className="text-xs text-stone-400">
              Isi jumlah uang yang ada di laci kas saat ini
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">
              Catatan{' '}
              <span className="text-stone-400 font-normal">(opsional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Misal: Shift pagi, kasir Budi"
              className="w-full h-11 px-4 rounded-xl border border-stone-200 focus:border-kartini-green focus:ring-2 focus:ring-kartini-green/20 text-sm outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="pos-btn w-full rounded-xl bg-kartini-green hover:bg-kartini-green-dark text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-5 h-5 animate-spin" />}
            Buka Shift Sekarang
          </button>
        </form>
      </div>
    </div>
  );
}
