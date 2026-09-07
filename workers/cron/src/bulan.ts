import { bacaSaldoAwal, bacaLog, daftarTab, buatTab, bulanSaldoAwal, tambahSaldoAwal, catatErrorSheet, KOLOM_LOG } from '@kartini/sheets';
import { lipatSaldo } from './saldo';

export interface RingkasanBulan {
  bulan: string;
  tabDibuat: string[];
  saldoAwalDitulis: number;
  dilewati: string | null;
}

function formatBulan(tahun: number, bulanIndeksNol: number): string {
  const bulan = String(bulanIndeksNol + 1).padStart(2, '0');
  return `${tahun}-${bulan}`;
}

// Pakai Date.UTC dengan bulan+1/-1 -- bukan penambahan/pengurangan 30 hari --
// supaya Desember 2026 -> Januari 2027 (dan sebaliknya) menyeberang tahun
// dengan benar, bukan mendarat di tanggal yang salah.
function bulanRelatif(waktu: Date, geser: number): string {
  const acuan = new Date(Date.UTC(waktu.getUTCFullYear(), waktu.getUTCMonth() + geser, 1));
  return formatBulan(acuan.getUTCFullYear(), acuan.getUTCMonth());
}

export async function tutupBulan(sheetId: string): Promise<RingkasanBulan> {
  const sekarang = new Date();
  const bulanIni = bulanRelatif(sekarang, 0);
  const bulanLalu = bulanRelatif(sekarang, -1);
  const bulanDepan = bulanRelatif(sekarang, 1);

  const tabs = await daftarTab(sheetId);
  const judulTab = new Set(tabs.map((t) => t.judul));

  const tabDibuat: string[] = [];
  for (const bulan of [bulanIni, bulanDepan]) {
    const judul = `Log_${bulan}`;
    if (!judulTab.has(judul)) {
      await buatTab(sheetId, judul, KOLOM_LOG);
      tabDibuat.push(judul);
    }
  }

  const sudahAda = await bulanSaldoAwal(sheetId);
  if (sudahAda.has(bulanIni)) {
    return { bulan: bulanIni, tabDibuat, saldoAwalDitulis: 0, dilewati: 'saldo awal bulan ini sudah ada' };
  }

  if (!judulTab.has(`Log_${bulanLalu}`)) {
    return { bulan: bulanIni, tabDibuat, saldoAwalDitulis: 0, dilewati: 'tidak ada Log bulan lalu' };
  }

  const [saldoAwalLalu, logLalu] = await Promise.all([
    bacaSaldoAwal(sheetId, bulanLalu),
    bacaLog(sheetId, `Log_${bulanLalu}`),
  ]);

  const { peta, kejanggalan } = lipatSaldo(saldoAwalLalu, logLalu);

  const baris: { productId: string; lokasi: string; qty: number }[] = [];
  for (const [kunci, qty] of peta) {
    if (qty === 0) continue;
    const pemisah = kunci.indexOf('|');
    baris.push({ productId: kunci.slice(0, pemisah), lokasi: kunci.slice(pemisah + 1), qty });
  }

  await tambahSaldoAwal(sheetId, bulanIni, baris);

  // Saldo tetap ditulis walau ada kejanggalan -- menahan pembukaan bulan
  // gara-gara satu baris janggal jauh lebih merusak daripada membawanya
  // sambil melapor lewat tab Error.
  if (kejanggalan.length > 0) {
    await catatErrorSheet(
      sheetId,
      `tutup bulan ${bulanLalu}: ${kejanggalan.join('; ').slice(0, 250)}`,
      `Log_${bulanLalu}`
    );
  }

  return { bulan: bulanIni, tabDibuat, saldoAwalDitulis: baris.length, dilewati: null };
}
