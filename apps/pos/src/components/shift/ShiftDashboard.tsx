'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, ShoppingCart, X, Clock } from 'lucide-react';
import { closeShift, type ActiveShift } from '@/lib/shift-actions';
import type { SessionUser } from '@/lib/session';

interface CloseSummary {
  totalTransactions: number;
  totalRevenue: number;
  totalCashRevenue: number;
  totalNonCashRevenue: number;
  expectedCash: number;
  closingCash: number;
  cashDifference: number;
}

interface Props {
  shift: ActiveShift;
  user: SessionUser;
}

function formatRp(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function ShiftDashboard({ shift, user }: Props) {
  const router = useRouter();
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [closingCash, setClosingCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [closeSummary, setCloseSummary] = useState<CloseSummary | null>(null);

  const shiftDuration = Math.round(
    (Date.now() - new Date(shift.openedAt).getTime()) / 1000 / 60,
  );

  async function handleCloseShift() {
    const cash = parseFloat(closingCash.replace(/\./g, '').replace(',', '.') || '0');
    if (isNaN(cash) || cash < 0) {
      toast.error('Jumlah kas tidak valid');
      return;
    }

    setSubmitting(true);
    const result = await closeShift({
      shiftId: shift.id,
      closingCash: cash,
      notes: closingNotes.trim() || undefined,
    });
    setSubmitting(false);

    if (result.ok) {
      setCloseSummary(result.summary);
      toast.success('Shift berhasil ditutup');
    } else {
      toast.error(result.error ?? 'Gagal tutup shift');
    }
  }

  if (closeSummary) {
    const rows: Array<{
      label: string;
      value: string;
      bold?: boolean;
      color?: string;
    }> = [
      { label: 'Total Transaksi', value: `${closeSummary.totalTransactions} transaksi` },
      {
        label: 'Total Pendapatan',
        value: formatRp(closeSummary.totalRevenue),
        bold: true,
      },
      { label: 'Tunai', value: formatRp(closeSummary.totalCashRevenue) },
      { label: 'Non-Tunai', value: formatRp(closeSummary.totalNonCashRevenue) },
      { label: 'Modal Awal', value: formatRp(Number(shift.openingCash)) },
      { label: 'Kas Aktual', value: formatRp(closeSummary.closingCash) },
      { label: 'Kas Seharusnya', value: formatRp(closeSummary.expectedCash) },
      {
        label: 'Selisih Kas',
        value: formatRp(closeSummary.cashDifference),
        color:
          closeSummary.cashDifference < 0
            ? 'text-red-600'
            : closeSummary.cashDifference > 0
              ? 'text-green-600'
              : 'text-stone-900',
      },
    ];

    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)] p-6">
        <div className="w-full max-w-md bg-white rounded-2xl border border-stone-200 shadow-lg p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-bold text-stone-900">Shift Ditutup</h2>
            <p className="text-sm text-stone-500 mt-1">Ringkasan shift kamu</p>
          </div>

          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.label} className="flex justify-between text-sm">
                <span className="text-stone-500">{row.label}</span>
                <span
                  className={`font-semibold tabular-nums ${
                    row.color ??
                    (row.bold ? 'text-stone-900 text-base' : 'text-stone-700')
                  }`}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={() => router.refresh()}
            className="pos-btn w-full rounded-xl bg-kartini-green text-white"
          >
            Selesai
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5 mt-8">
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm font-semibold text-green-700">Shift Aktif</span>
            </div>
            <h2 className="text-lg font-bold text-stone-900">
              Selamat bekerja, {user.name}!
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-stone-500 mt-1">
              <Clock className="w-3 h-3" />
              <span>
                Dibuka{' '}
                {new Date(shift.openedAt).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                · {shiftDuration} menit lalu
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-stone-500">Modal Awal</div>
            <div className="text-xl font-bold text-stone-900 tabular-nums">
              {formatRp(Number(shift.openingCash))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-stone-100">
          <div className="text-center">
            <div className="text-lg font-bold text-stone-900">
              {shift.totalTransactions ?? 0}
            </div>
            <div className="text-xs text-stone-500">Transaksi</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-stone-900 tabular-nums">
              {formatRp(Number(shift.totalRevenue ?? 0))}
            </div>
            <div className="text-xs text-stone-500">Pendapatan</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-stone-900 tabular-nums">
              {formatRp(Number(shift.totalCashRevenue ?? 0))}
            </div>
            <div className="text-xs text-stone-500">Tunai</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="bg-kartini-green rounded-xl p-6 text-white text-center opacity-50">
          <ShoppingCart className="w-8 h-8 mx-auto mb-2" />
          <div className="font-semibold">Kasir (Transaksi)</div>
          <div className="text-xs text-white/70 mt-1">Dibangun di Phase 2</div>
        </div>

        {!showCloseForm ? (
          <button
            onClick={() => setShowCloseForm(true)}
            className="pos-btn w-full rounded-xl bg-stone-800 hover:bg-stone-900 text-white flex items-center justify-center gap-2"
          >
            <X className="w-5 h-5" />
            Tutup Shift
          </button>
        ) : (
          <div className="bg-white rounded-xl border-2 border-stone-200 p-5 space-y-4">
            <h3 className="font-semibold text-stone-900">Tutup Shift</h3>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700">
                Jumlah Kas di Laci *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-medium">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={closingCash}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setClosingCash(raw ? Number(raw).toLocaleString('id-ID') : '');
                  }}
                  placeholder="0"
                  className="w-full h-12 pl-12 pr-4 rounded-xl border-2 border-stone-200 focus:border-red-400 text-lg font-semibold outline-none tabular-nums"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700">
                Catatan{' '}
                <span className="text-stone-400 font-normal">(opsional)</span>
              </label>
              <input
                type="text"
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="Catatan tutup shift..."
                className="w-full h-10 px-3 rounded-lg border border-stone-200 text-sm outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCloseForm(false)}
                className="flex-1 h-11 rounded-xl bg-stone-100 text-stone-700 font-medium text-sm"
              >
                Batal
              </button>
              <button
                onClick={handleCloseShift}
                disabled={submitting || !closingCash}
                className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Tutup Shift
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
