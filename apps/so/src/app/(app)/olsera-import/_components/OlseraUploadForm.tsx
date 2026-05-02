'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Loader2,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  previewOlseraImport,
  commitOlseraImport,
  cancelOlseraImport,
} from '@/lib/inventory/olsera-actions';

interface PreviewData {
  totalRows: number;
  movementsCreated: number;
  rowsSkipped: number;
  rowsError: number;
  totalValueRp: number;
  importLogId: string;
  errors?: string[];
}

const MAX_ROWS = 10000;

type Row = Record<string, string | number | null | undefined>;

function normalizeKeys(rows: Record<string, unknown>[]): Row[] {
  return rows.map((row) => {
    const out: Row = {};
    for (const [k, v] of Object.entries(row)) {
      const key = k.trim().toLowerCase();
      if (v === null || v === undefined) out[key] = null;
      else if (typeof v === 'number' || typeof v === 'string') out[key] = v;
      else if (v instanceof Date) out[key] = v.toISOString();
      else out[key] = String(v);
    }
    return out;
  });
}

export function OlseraUploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(null);
  }

  async function handlePreview() {
    if (!file) {
      toast.error('Pilih file dulu');
      return;
    }
    setParsing(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;
      if (!sheet) throw new Error('Sheet kosong');

      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: null,
      });

      if (rawRows.length === 0) {
        toast.error('File kosong');
        setParsing(false);
        return;
      }
      if (rawRows.length > MAX_ROWS) {
        toast.warning(
          `File berisi ${rawRows.length} baris. Hanya ${MAX_ROWS} pertama yang akan diproses.`,
        );
      }

      const rows = normalizeKeys(rawRows.slice(0, MAX_ROWS));

      const result = await previewOlseraImport({
        fileName: file.name,
        fileSize: file.size,
        rows,
      });

      if (result.ok) {
        setPreview(result.preview);
        toast.success(
          `Preview siap. ${result.preview.movementsCreated} movement akan dibuat.`,
        );
      } else {
        toast.error(result.error ?? 'Gagal parse');
      }
    } catch (err) {
      toast.error(`Gagal baca file: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setParsing(false);
    }
  }

  async function handleCommit() {
    if (!preview?.importLogId) return;
    if (
      !confirm(
        `Commit ${preview.movementsCreated} SALE_OUT movements? Stok akan berkurang.`,
      )
    )
      return;

    setCommitting(true);
    const result = await commitOlseraImport({ importLogId: preview.importLogId });
    setCommitting(false);

    if (result.ok) {
      toast.success(`${result.committedCount} movements committed`);
      setFile(null);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      router.refresh();
    } else {
      toast.error(result.error ?? 'Gagal commit');
    }
  }

  async function handleCancel() {
    if (preview?.importLogId) {
      await cancelOlseraImport({ importLogId: preview.importLogId });
    }
    setPreview(null);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="space-y-4">
      {!preview ? (
        <>
          <div className="border-2 border-dashed border-stone-200 rounded-lg p-8 text-center hover:border-kartini-green transition">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer block">
              <FileSpreadsheet className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              {file ? (
                <div>
                  <div className="font-semibold text-stone-900">{file.name}</div>
                  <div className="text-xs text-stone-500 mt-1">
                    {(file.size / 1024).toFixed(1)} KB
                  </div>
                </div>
              ) : (
                <div>
                  <div className="font-semibold text-stone-700">
                    Klik untuk pilih file Excel
                  </div>
                  <div className="text-xs text-stone-500 mt-1">Support .xlsx, .xls</div>
                </div>
              )}
            </label>
          </div>

          {file && (
            <button
              onClick={handlePreview}
              disabled={parsing}
              className="w-full h-11 rounded-lg bg-kartini-green hover:bg-kartini-green-dark text-white font-semibold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {parsing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {parsing ? 'Memproses file...' : 'Preview Import'}
            </button>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="p-3 rounded-lg bg-blue-50">
              <div className="text-xs text-blue-700">Total baris</div>
              <div className="text-xl font-bold text-blue-900">{preview.totalRows}</div>
            </div>
            <div className="p-3 rounded-lg bg-green-50">
              <div className="text-xs text-green-700">Movement valid</div>
              <div className="text-xl font-bold text-green-900">
                {preview.movementsCreated}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-amber-50">
              <div className="text-xs text-amber-700">Skipped (duplicate)</div>
              <div className="text-xl font-bold text-amber-900">
                {preview.rowsSkipped}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-red-50">
              <div className="text-xs text-red-700">Error</div>
              <div className="text-xl font-bold text-red-900">{preview.rowsError}</div>
            </div>
          </div>

          {preview.errors && preview.errors.length > 0 && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <div className="font-semibold text-sm text-red-900 mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Sample errors:
              </div>
              <ul className="text-xs text-red-700 space-y-0.5 list-disc list-inside">
                {preview.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="p-4 rounded-lg bg-kartini-green-light border border-kartini-green/20 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-kartini-green flex-shrink-0" />
            <div className="flex-1 text-sm text-stone-700">
              Total nilai sales:{' '}
              <strong className="text-stone-900">
                Rp {preview.totalValueRp.toLocaleString('id-ID')}
              </strong>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="h-11 px-5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium text-sm transition"
            >
              Batal
            </button>
            <button
              onClick={handleCommit}
              disabled={committing || preview.movementsCreated === 0}
              className="flex-1 h-11 rounded-lg bg-kartini-green hover:bg-kartini-green-dark text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {committing && <Loader2 className="w-4 h-4 animate-spin" />}
              Commit {preview.movementsCreated} Movements
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
