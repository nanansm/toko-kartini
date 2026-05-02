import Link from 'next/link';
import {
  Settings,
  Building2,
  Sliders,
  Plug,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { db, products } from '@kartini/db';
import { max } from 'drizzle-orm';
import { requireRole } from '@/lib/session';

const SHEET_ID = '1eK4Z1aQmg12elrFGhZ8fwAfbBXxY9YLLqEaIP8iebbE';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}`;
const SERVICE_ACCOUNT = 'modaltekun-agent@ai-agent-project-478310.iam.gserviceaccount.com';

const dateFmt = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export default async function SettingsPage() {
  await requireRole(['OWNER']);

  const [lastSyncRow] = await db
    .select({ lastSync: max(products.updatedAt) })
    .from(products);
  const lastSync = lastSyncRow?.lastSync;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-kartini-green" />
          Pengaturan Sistem
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Konfigurasi perusahaan, sistem, dan integrasi.
        </p>
      </div>

      {/* Section 1: Informasi Perusahaan */}
      <Card className="border-stone-200 shadow-soft-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-kartini-green" />
            Informasi Perusahaan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="Nama Badan Usaha" value="CV Kartini Boga Nusantara" />
          <InfoRow label="Brand" value="TOKO KARTINI" />
          <InfoRow
            label="Alamat"
            value="Jl. R.A. Kartini No.08, RT.001/RW.006, Regol Wetan, Kec. Sumedang Sel., Kab. Sumedang, Jawa Barat 45311"
          />
          <div className="flex items-start justify-between gap-3 text-sm">
            <span className="text-stone-500 flex-shrink-0">Status PKP</span>
            <Badge className="bg-kartini-orange-light text-kartini-orange-dark border-0">
              Belum PKP
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Konfigurasi Sistem */}
      <Card className="border-stone-200 shadow-soft-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sliders className="w-4 h-4 text-kartini-green" />
            Konfigurasi Sistem
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="Costing Method" value="Weighted Average" />
          <InfoRow label="Currency" value="IDR (Rupiah)" />
          <InfoRow label="Timezone" value="Asia/Jakarta (GMT+7)" />
          <InfoRow label="Low Stock Alert" value="7 hari" />
          <InfoRow label="SO Approval Required" value="Yes" />
          <Link
            href="/settings/so-thresholds"
            className="flex items-center justify-between gap-3 -mx-2 px-2 py-2 rounded-lg hover:bg-stone-50 transition group"
          >
            <div className="text-sm">
              <div className="font-medium text-stone-900">Threshold SO</div>
              <div className="text-xs text-stone-500 mt-0.5">
                Atur batas auto-approve & mandatory re-count
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-600" />
          </Link>
        </CardContent>
      </Card>

      {/* Section 3: Integrasi */}
      <Card className="border-stone-200 shadow-soft-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plug className="w-4 h-4 text-kartini-green" />
            Integrasi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Google Sheet */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📊</span>
                <div>
                  <div className="font-semibold text-stone-900 text-sm">Google Sheet Master</div>
                  <div className="text-xs text-stone-500">Sumber data master produk</div>
                </div>
              </div>
              <Badge className="bg-kartini-green-light text-kartini-green-dark border-0 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Connected
              </Badge>
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 space-y-2 text-xs">
              <DetailRow label="Sheet ID" value={SHEET_ID} mono />
              <DetailRow
                label="Service Account"
                value={`${SERVICE_ACCOUNT.slice(0, 22)}...`}
                mono
              />
              <DetailRow
                label="Last Sync"
                value={lastSync ? dateFmt.format(new Date(lastSync)) : 'Belum pernah'}
              />
            </div>
            <a
              href={SHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-stone-200 hover:border-kartini-green hover:bg-stone-50 text-sm font-medium text-stone-700 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Buka Google Sheet
            </a>
          </div>

          <div className="h-px bg-stone-200" />

          {/* Olsera */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🛒</span>
                <div>
                  <div className="font-semibold text-stone-900 text-sm">Olsera POS</div>
                  <div className="text-xs text-stone-500">Sistem kasir saat ini</div>
                </div>
              </div>
              <Badge className="bg-kartini-orange-light text-kartini-orange-dark border-0 inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Manual Sync
              </Badge>
            </div>
            <p className="text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-lg p-3">
              Olsera Pro tidak ada API. Sync via export Excel manual mingguan (setiap Senin
              pagi).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50 shadow-soft-sm py-4 gap-2">
        <CardContent className="px-4">
          <div className="flex items-start gap-2 text-sm text-amber-900">
            <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
            <p>
              Edit pengaturan akan dibuat di Phase 2. Sekarang display saja.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-stone-500 flex-shrink-0">{label}</span>
      <span className="text-stone-900 font-medium text-right">{value}</span>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-stone-500 flex-shrink-0">{label}</span>
      <span
        className={mono ? 'font-mono text-stone-700 text-right break-all' : 'text-stone-700 text-right'}
      >
        {value}
      </span>
    </div>
  );
}
