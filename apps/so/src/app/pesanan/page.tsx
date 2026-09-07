import Link from 'next/link';
import { requireRole, PERMISSIONS } from '@/lib/session';
import { totalPerProduk } from '@/lib/saldo';
import { petaProdukRingkas } from '@/lib/katalog';
import { keQtyPokok } from '@/lib/mutasi';
import { formatNumber, formatWaktuWIB } from '@/lib/format';
import { bacaMinimum } from '@kartini/sheets';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export const dynamic = 'force-dynamic';

interface ItemPesanan {
  productId: string;
  nama: string;
  supplier: string | null;
  satuanInput: string;
  kurangSatuan: number;
  kurangPokok: number;
  minimumPokok: number;
  stok: number;
}

interface ItemTidakDikenal {
  productId: string;
  nama: string;
  barisSheet: number;
  sebab: string;
}

export default async function PesananPage() {
  await requireRole(PERMISSIONS.LIHAT_PESANAN);

  const sheetId = process.env.SHEET_OPS_ID;

  if (!sheetId) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Pesanan Supplier</h1>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4 text-stone-500">
          Sistem belum siap. Hubungi admin.
        </div>
      </div>
    );
  }

  const [minimum, saldo] = await Promise.all([bacaMinimum(sheetId), totalPerProduk()]);

  if (!saldo) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Pesanan Supplier</h1>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4 text-stone-500">
          Saldo belum dihitung. Penyegar berkala akan mengisinya.
        </div>
      </div>
    );
  }

  const produkPeta = await petaProdukRingkas(minimum.map((m) => m.productId));

  const item: ItemPesanan[] = [];
  const tidakDikenal: ItemTidakDikenal[] = [];

  for (const m of minimum) {
    const produk = produkPeta.get(m.productId);
    if (!produk) {
      tidakDikenal.push({
        productId: m.productId,
        nama: m.nama,
        barisSheet: m.barisSheet,
        sebab: 'Produk tidak ditemukan di katalog.',
      });
      continue;
    }

    const minimumPokok = keQtyPokok(m.minimum, m.satuanInput, produk.satuan);
    if (minimumPokok === null) {
      tidakDikenal.push({
        productId: m.productId,
        nama: m.nama,
        barisSheet: m.barisSheet,
        sebab: `Satuan "${m.satuanInput}" tidak dikenal untuk produk ini.`,
      });
      continue;
    }

    const stok = saldo.peta.get(m.productId) ?? 0;
    if (stok >= minimumPokok) continue;

    const kurangPokok = minimumPokok - stok;
    const tingkat = produk.satuan.find((s) => s.nama.trim().toLowerCase() === m.satuanInput.trim().toLowerCase());
    const pengali = tingkat?.pengali ?? 1;
    const kurangSatuan = Math.ceil(kurangPokok / pengali);

    item.push({
      productId: m.productId,
      nama: produk.nama,
      supplier: produk.supplier,
      satuanInput: m.satuanInput,
      kurangSatuan,
      kurangPokok,
      minimumPokok,
      stok,
    });
  }

  const kelompok = new Map<string, ItemPesanan[]>();
  for (const it of item) {
    const kunci = it.supplier && it.supplier.trim() !== '' ? it.supplier : '';
    const daftar = kelompok.get(kunci);
    if (daftar) {
      daftar.push(it);
    } else {
      kelompok.set(kunci, [it]);
    }
  }

  for (const daftar of kelompok.values()) {
    daftar.sort((a, b) => b.kurangPokok / b.minimumPokok - a.kurangPokok / a.minimumPokok);
  }

  const namaSupplier = Array.from(kelompok.keys())
    .filter((k) => k !== '')
    .sort((a, b) => a.localeCompare(b, 'id'));
  if (kelompok.has('')) namaSupplier.push('');

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Pesanan Supplier</h1>
        <p className="text-sm text-stone-500 mt-1">
          Barang yang stoknya di bawah batas minimum, dikelompokkan per supplier.
        </p>
        <p className="text-xs text-stone-500 mt-1">Saldo dihitung {formatWaktuWIB(saldo.waktu)}</p>
      </div>

      {item.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-4 text-stone-500">
          Tidak ada barang di bawah batas minimum.
        </div>
      ) : (
        namaSupplier.map((kunci) => {
          const daftar = kelompok.get(kunci);
          if (!daftar) return null;
          return (
            <div key={kunci || '__tanpa_supplier__'} className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold text-stone-900">{kunci === '' ? 'Tanpa supplier' : kunci}</h2>
                <span className="text-sm text-stone-500">{daftar.length} barang</span>
              </div>
              <div className="mt-3 divide-y divide-stone-200">
                {daftar.map((it) => (
                  <div key={it.productId} className="flex items-start justify-between py-3">
                    <div>
                      <Link href={`/barang/${it.productId}`} className="font-medium text-stone-900 hover:underline">
                        {it.nama}
                      </Link>
                      <div className="text-xs text-stone-500 font-mono">{it.productId}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold tabular-nums text-stone-900">
                        {formatNumber(it.kurangSatuan)}
                      </div>
                      <div className="text-xs text-stone-500">{it.satuanInput}</div>
                      <div className="text-xs text-stone-500">
                        stok {formatNumber(it.stok)} dari minimum {formatNumber(it.minimumPokok)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {tidakDikenal.length > 0 && (
        <Alert variant="default">
          <AlertTitle>Baris minimum yang tidak bisa dihitung</AlertTitle>
          <AlertDescription>
            {tidakDikenal.map((t) => (
              <p key={t.productId}>
                {t.productId} ({t.nama}): {t.sebab} — baris {t.barisSheet} di tab Minimum.
              </p>
            ))}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
