// Port persis dari scripts/sesi_so.py milik tim. Satu SO tidak selalu
// selesai dalam sehari -- hitung stok satu gudang sering memakan dua hari
// berturut-turut, jadi dua hari itu satu kejadian. Kalau dipisah, hari
// kedua terbaca sebagai SO baru dan angka selisihnya salah.

/** Jeda maksimal antar hari yang masih dianggap satu SO. 1 = hari bersambung. */
export const JEDA_HARI = 1;

const MS_PER_HARI = 86400000;

/**
 * Urai satu stempel waktu jadi tanggal kalender UTC. Mengembalikan null
 * kalau bukan tanggal valid (format salah atau tanggal kalender mustahil
 * seperti 2026-02-30) -- sampah seperti itu tidak boleh ikut membentuk sesi.
 */
function tanggalDari(t: string): { s: string; ms: number } | null {
  const s = t.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const ys = m[1];
  const bs = m[2];
  const ds = m[3];
  if (ys === undefined || bs === undefined || ds === undefined) return null;
  const y = Number(ys);
  const bln = Number(bs);
  const d = Number(ds);
  const ms = Date.UTC(y, bln - 1, d);
  const cek = new Date(ms);
  // Date.UTC melakukan overflow diam-diam (mis. bulan 13 -> Januari tahun
  // berikutnya), jadi validasi ulang komponennya supaya tanggal mustahil
  // tetap ditolak, sama seperti date.fromisoformat di Python.
  if (cek.getUTCFullYear() !== y || cek.getUTCMonth() !== bln - 1 || cek.getUTCDate() !== d) {
    return null;
  }
  return { s, ms };
}

/** Kelompokkan tanggal SO satu lokasi jadi sesi, urut naik, tanpa duplikat. */
export function bagiSesi(tanggal: string[]): string[][] {
  const petaMs = new Map<string, number>();
  for (const t of tanggal) {
    const parsed = tanggalDari(t);
    if (parsed) petaMs.set(parsed.s, parsed.ms);
  }
  const urut = [...petaMs.keys()].sort();

  const sesi: string[][] = [];
  let sesiAktif: string[] = [];
  let msAkhir = 0;

  for (const t of urut) {
    const ms = petaMs.get(t);
    if (ms === undefined) continue; // tak mungkin terjadi, tapi hindari asumsi
    // Selisih hari dihitung dari tanggal kalender (bukan pengurangan
    // string) supaya lintas bulan/tahun tetap benar -- 31 Agu ke 1 Sep
    // itu sehari, bukan "beda" karena angka tanggalnya turun.
    if (sesiAktif.length > 0 && (ms - msAkhir) / MS_PER_HARI <= JEDA_HARI) {
      sesiAktif.push(t);
    } else {
      sesiAktif = [t];
      sesi.push(sesiAktif);
    }
    msAkhir = ms;
  }
  return sesi;
}

/** Himpunan tanggal pada sesi TERAKHIR saja. Kosong kalau tak ada sesi. */
export function sesiTerakhir(tanggal: string[]): Set<string> {
  const sesi = bagiSesi(tanggal);
  const akhir = sesi[sesi.length - 1];
  return akhir ? new Set(akhir) : new Set();
}
