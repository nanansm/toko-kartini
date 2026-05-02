import { db, olseraImportLogs } from '@kartini/db';
import { desc } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, Upload, History } from 'lucide-react';
import { OlseraUploadForm } from './_components/OlseraUploadForm';
import { requireRole } from '@/lib/session';

export default async function OlseraImportPage() {
  await requireRole(['OWNER', 'ADMIN']);

  const recentImports = await db
    .select()
    .from(olseraImportLogs)
    .orderBy(desc(olseraImportLogs.uploadedAt))
    .limit(10);

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-kartini-green" />
          Import Sales dari Olsera
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Upload Sales Report Excel dari Olsera. Sistem akan auto-generate SALE_OUT
          movements.
        </p>
      </div>

      <Card className="bg-blue-50 border-blue-200 p-4 text-sm text-blue-900">
        <strong>Cara export dari Olsera Pro:</strong>
        <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
          <li>Login Olsera Pro → Reports → Sales Report</li>
          <li>Pilih periode (mis. minggu lalu)</li>
          <li>Export → Excel (.xlsx)</li>
          <li>Upload file di sini</li>
        </ol>
      </Card>

      <Card className="border-stone-200 shadow-soft-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Upload File Excel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OlseraUploadForm />
        </CardContent>
      </Card>

      <Card className="border-stone-200 shadow-soft-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4" />
            Riwayat Import
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentImports.length === 0 ? (
            <p className="text-sm text-stone-500 text-center py-6">Belum ada import</p>
          ) : (
            <div className="space-y-2">
              {recentImports.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-lg bg-stone-50 flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-stone-900 truncate">
                      {log.fileName}
                    </div>
                    <div className="text-xs text-stone-500 mt-0.5">
                      {new Date(log.uploadedAt).toLocaleString('id-ID')} ·{' '}
                      {log.movementsCreated} movements · {log.rowsSkipped} skipped ·{' '}
                      {log.rowsError} error
                    </div>
                    {log.errorMessage && (
                      <div className="text-xs text-red-600 mt-1 truncate">
                        {log.errorMessage}
                      </div>
                    )}
                  </div>
                  <Badge
                    className={
                      log.status === 'COMMITTED'
                        ? 'bg-green-100 text-green-700'
                        : log.status === 'FAILED'
                          ? 'bg-red-100 text-red-700'
                          : log.status === 'PREVIEW'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-stone-100 text-stone-700'
                    }
                  >
                    {log.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
