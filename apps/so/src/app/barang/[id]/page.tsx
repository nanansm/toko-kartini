import { requireRole, PERMISSIONS } from '@/lib/session';
import { petaProdukRingkas } from '@/lib/katalog';
import { saldoPerLokasi } from '@/lib/saldo';
import { bacaLogBulanIni } from '@/lib/log-terkini';
import { LABEL_LOKASI, LOKASI_NYATA, isKodeLokasi } from '@/lib/lokasi';
import { LABEL_JENIS, type JenisMutasi } from '@/lib/mutasi';
import { formatNumber, formatWaktuWIB } from '@/lib/format';
import type { BarisLog } from '@kartini/sheets';

function labelLokasi(kode: string | null): string {
  if (kode === null) return '—';
  return isKodeLokasi(kode) ? LABEL_LOKASI[kode] : kode;
}

function isJenisMutasi(nilai: string): nilai is JenisMutasi {
  return nilai in LABEL_JENIS;
}

export const dynamic = 'force-dynamic';

const BATAS_RIWAYAT = 50;

export default async function KartuStokPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(PERMISSIONS.LIHAT_KATALOG);

  const { id } = await params;

  const [produkPeta, saldo] = await Promise.all([petaProdukRingkas([id]), saldoPerLokasi(id)]);
  const produk = produkPeta.get(id);

  let riwayat: BarisLog[] = [];
  let riwayatGagal = false;
  const sheetId = process.env.SHEET_OPS_ID;
  if (sheetId) {
    try {
      const log = await bacaLogBulanIni(sheetId);
      riwayat = log
        .filter((b) => b.productId === id)
        .sort((a, b) => b.id - a.id)
        .slice(0, BATAS_RIWAYAT);
    } catch {
      riwayatGagal = true;
    }
  }

  const petaQty = new Map<string, number>();
  if (saldo) {
    for (const baris of saldo.baris) {
      petaQty.set(baris.lokasi, (petaQty.get(baris.lokasi) ?? 0) + baris.qty);
    }
  }
  const total = LOKASI_NYATA.reduce((acc, lokasi) => acc + (petaQty.get(lokasi) ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">{produk?.nama ?? id}</h1>
        <p className="text-xs font-mono text-stone-500 mt-1">
          {id}
          {produk && ` · ${produk.kategori}`}
          {produk?.supplier && ` · ${produk.supplier}`}
        </p>
        {!produk && (
          <p className="text-sm text-stone-500 mt-1">
            Barang ini tidak ada di katalog. Mungkin datanya pincang — riwayat dan saldo di bawah
            tetap ditampilkan.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-stone-900">Saldo per Lokasi</h2>
        {saldo ? (
          <>
            <div className="mt-3 divide-y divide-stone-200">
              {LOKASI_NYATA.map((lokasi) => {
                const qty = petaQty.get(lokasi) ?? 0;
                return (
                  <div key={lokasi} className="flex items-center justify-between py-2">
                    <span className="text-stone-700">{LABEL_LOKASI[lokasi]}</span>
                    <span
                      className={`tabular-nums font-medium ${qty < 0 ? 'text-destructive' : 'text-stone-900'}`}
                    >
                      {formatNumber(qty)}
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between py-2 border-t border-stone-200 font-semibold">
                <span className="text-stone-900">Total</span>
                <span
                  className={`tabular-nums ${total < 0 ? 'text-destructive' : 'text-stone-900'}`}
                >
                  {formatNumber(total)}
                </span>
              </div>
            </div>
            <p className="text-xs text-stone-500 mt-3">Saldo dihitung {formatWaktuWIB(saldo.waktu)}</p>
          </>
        ) : (
          <p className="text-sm text-stone-500 mt-2">Saldo belum dihitung. Penyegar berkala akan mengisinya.</p>
        )}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-stone-900">Riwayat Bulan Ini</h2>
        {!sheetId || riwayatGagal ? (
          <p className="text-sm text-stone-500 mt-2">Riwayat tidak bisa dibaca.</p>
        ) : riwayat.length === 0 ? (
          <p className="text-sm text-stone-500 mt-2">Belum ada mutasi bulan ini.</p>
        ) : (
          <>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-stone-500 border-b border-stone-200">
                    <th className="py-2 pr-3 font-medium">Waktu</th>
                    <th className="py-2 pr-3 font-medium">Jenis</th>
                    <th className="py-2 pr-3 font-medium">Jumlah</th>
                    <th className="py-2 pr-3 font-medium">Dari → Ke</th>
                    <th className="py-2 pr-3 font-medium">User</th>
                    <th className="py-2 pr-3 font-medium">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {riwayat.map((baris) => (
                    <tr key={baris.id}>
                      <td className="py-2 pr-3 whitespace-nowrap text-stone-700">
                        {formatWaktuWIB(baris.waktuServer)}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap text-stone-700">
                        {isJenisMutasi(baris.jenis) ? LABEL_JENIS[baris.jenis] : baris.jenis}
                      </td>
                      <td className="py-2 pr-3 tabular-nums text-stone-900">
                        {formatNumber(baris.qtyPokok)}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap text-stone-700">
                        {labelLokasi(baris.dari)} → {labelLokasi(baris.ke)}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap text-stone-700">{baris.user}</td>
                      <td className="py-2 pr-3 text-stone-700">{baris.catatan ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {riwayat.length >= BATAS_RIWAYAT && (
              <p className="text-xs text-stone-500 mt-3">Menampilkan 50 mutasi terbaru bulan ini.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
