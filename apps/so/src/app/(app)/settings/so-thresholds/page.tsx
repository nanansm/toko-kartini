import Link from 'next/link';
import { ArrowLeft, Sliders } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireRole } from '@/lib/session';
import { getSOThresholds } from '@/lib/inventory/settings';
import { ThresholdForm } from './_components/ThresholdForm';

export default async function SOThresholdsSettingsPage() {
  await requireRole(['OWNER']);

  const thresholds = await getSOThresholds();

  return (
    <div className="space-y-5 max-w-2xl">
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali ke Pengaturan
      </Link>

      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 flex items-center gap-2">
          <Sliders className="w-6 h-6 text-kartini-green" />
          Threshold Stock Opname
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Atur batas selisih untuk auto-approve dan mandatory re-count.
        </p>
      </div>

      <Card className="border-stone-200 shadow-soft-sm">
        <CardHeader>
          <CardTitle className="text-base">Konfigurasi Threshold</CardTitle>
        </CardHeader>
        <CardContent>
          <ThresholdForm
            initialLow={thresholds.lowPct}
            initialHigh={thresholds.highPct}
          />
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200 p-4 text-sm text-blue-900">
        <strong>Cara kerja threshold:</strong>
        <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
          <li>
            Selisih per item &lt; {thresholds.lowPct}% → <strong>Auto-approved</strong>{' '}
            (tidak perlu supervisor)
          </li>
          <li>
            {thresholds.lowPct}% – {thresholds.highPct}% → <strong>Pending approval</strong>{' '}
            (supervisor input alasan)
          </li>
          <li>
            ≥ {thresholds.highPct}% → <strong>Mandatory re-count</strong> (block submit
            sampai dihitung ulang)
          </li>
        </ul>
      </Card>
    </div>
  );
}
