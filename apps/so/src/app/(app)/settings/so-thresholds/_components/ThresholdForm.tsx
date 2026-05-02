'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { updateSOThresholds } from './actions';

interface Props {
  initialLow: number;
  initialHigh: number;
}

export function ThresholdForm({ initialLow, initialHigh }: Props) {
  const router = useRouter();
  const [low, setLow] = useState(initialLow);
  const [high, setHigh] = useState(initialHigh);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (low < 0 || low > 100 || high < 0 || high > 100) {
      toast.error('Threshold harus antara 0 dan 100');
      return;
    }
    if (low >= high) {
      toast.error('Threshold rendah harus lebih kecil dari threshold tinggi');
      return;
    }

    setSubmitting(true);
    const result = await updateSOThresholds({ low, high });
    setSubmitting(false);

    if (result.ok) {
      toast.success('Threshold tersimpan');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Gagal');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-stone-700">
            Threshold Rendah (%) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={low}
            onChange={(e) => setLow(parseFloat(e.target.value))}
            className="w-full h-10 px-3 rounded-lg border border-stone-200 focus:border-kartini-green focus:ring-2 focus:ring-kartini-green/20 text-sm outline-none tabular-nums"
          />
          <p className="text-xs text-stone-500">
            Selisih di bawah nilai ini → auto-approve.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-stone-700">
            Threshold Tinggi (%) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={high}
            onChange={(e) => setHigh(parseFloat(e.target.value))}
            className="w-full h-10 px-3 rounded-lg border border-stone-200 focus:border-kartini-green focus:ring-2 focus:ring-kartini-green/20 text-sm outline-none tabular-nums"
          />
          <p className="text-xs text-stone-500">
            Selisih di atas/sama dengan nilai ini → mandatory re-count.
          </p>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="px-5 h-11 rounded-lg bg-kartini-green hover:bg-kartini-green-dark text-white font-semibold text-sm disabled:opacity-50 transition flex items-center gap-2"
      >
        {submitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        Simpan
      </button>
    </form>
  );
}
