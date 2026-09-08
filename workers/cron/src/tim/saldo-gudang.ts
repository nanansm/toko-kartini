// Port persis dari scripts/hitung_saldo.py milik tim. Hitung sisa stok GUDANG
// (bukan Area Display -- itu ada di saldo-display.ts, sisi yang butuh data
// penjualan karena display berkurang tiap laku, sedangkan gudang cuma
// berkurang kalau ada orang memindahkannya lewat halaman Pengeluaran).

import type { BarisLog, BarisMutasi, BarisStok } from './tipe';
import { DISPLAY, MAYA, rapi } from './tipe';
import type { PetaHarga } from './harga';
import { nilaiRupiah } from './harga';
import { sesiTerakhir } from './sesi';

// (lokasi -> (sku -> qty)). Peta bertingkat dipakai supaya kunci komposit
// tidak perlu digabung jadi satu string -- nama lokasi/produk bisa memuat
// karakter apa pun tanpa risiko bentrok pemisah.
function tambah(peta: Map<string, Map<string, number>>, lokasi: string, sku: string, qty: number): void {
  let inner = peta.get(lokasi);
  if (!inner) {
    inner = new Map();
    peta.set(lokasi, inner);
  }
  inner.set(sku, (inner.get(sku) ?? 0) + qty);
}

export function hitungSaldoGudang(
  log: BarisLog[],
  mutasi: BarisMutasi[],
  harga: PetaHarga,
): BarisStok[] {
  // Skrip Python menerima `lokasi_aktif` dari tabel racks (Area Display sudah
  // dibuang di sana). Port ini tidak dapat parameter itu, jadi lokasi nyata
  // diturunkan dari data sendiri: semua rak/dari/ke yang muncul, dikurangi
  // lokasi maya (Barang Datang/Barang Rusak) dan Area Display -- itu ditangani
  // modul saldo-display.ts, bukan di sini.
  const lokasiAktif = new Set<string>();
  for (const r of log) {
    const rak = r.rak.trim();
    if (rak) lokasiAktif.add(rak);
  }
  for (const m of mutasi) {
    const dari = m.dari.trim();
    const ke = m.ke.trim();
    if (dari) lokasiAktif.add(dari);
    if (ke) lokasiAktif.add(ke);
  }
  for (const maya of MAYA) lokasiAktif.delete(maya);
  lokasiAktif.delete(DISPLAY);

  // Waktu SO terakhir per lokasi (timestamp PENUH, bukan tanggal saja: mutasi
  // beberapa jam sesudah rak dihitung harus ikut, yang sebelumnya sudah
  // tercermin di hasil hitungan fisik dan tidak boleh dihitung dua kali) +
  // kumpulan tanggal per lokasi untuk mencari sesi SO-nya.
  const waktuSO = new Map<string, string>();
  const tanggalRak = new Map<string, Set<string>>();
  for (const r of log) {
    const waktu = r.waktu.trim();
    const rak = r.rak.trim();
    if (!waktu || !rak) continue;
    if (waktu > (waktuSO.get(rak) ?? '')) waktuSO.set(rak, waktu);
    let set = tanggalRak.get(rak);
    if (!set) {
      set = new Set();
      tanggalRak.set(rak, set);
    }
    set.add(waktu.slice(0, 10));
  }

  // Titik awalnya SESI SO terakhir, bukan HARI terakhir: satu rak besar sering
  // dihitung dua hari bersambung, dan memotong per-hari membuang hari pertama.
  const sesiAkhir = new Map<string, Set<string>>();
  for (const [rak, tgl] of tanggalRak) {
    sesiAkhir.set(rak, new Set(sesiTerakhir([...tgl])));
  }

  const baseline = new Map<string, Map<string, number>>(); // lokasi -> sku -> qty saat SO
  const nama = new Map<string, { produk: string; satuan: string }>(); // sku -> nama
  for (const r of log) {
    const waktu = r.waktu.trim();
    const rak = r.rak.trim();
    const sku = r.sku.trim();
    const sesi = sesiAkhir.get(rak);
    if (!sku || !rak || !sesi || !sesi.has(waktu.slice(0, 10))) continue;
    tambah(baseline, rak, sku, r.qty);
    if (!nama.has(sku)) nama.set(sku, { produk: r.produk.trim(), satuan: r.satuan.trim() });
  }

  const masuk = new Map<string, Map<string, number>>();
  const keluar = new Map<string, Map<string, number>>();
  for (const m of mutasi) {
    const waktu = m.waktu.trim();
    const dari = m.dari.trim();
    const ke = m.ke.trim();
    const sku = m.sku.trim();
    if (!sku || !waktu) continue;
    if (!nama.has(sku)) nama.set(sku, { produk: m.produk.trim(), satuan: m.satuan.trim() });
    // Mutasi sebelum SO lokasi itu sudah tercermin di hasil hitungan fisik --
    // hanya yang TEGAS sesudahnya (bukan >=) yang dihitung lagi di sini.
    if (lokasiAktif.has(ke) && waktu > (waktuSO.get(ke) ?? '')) {
      tambah(masuk, ke, sku, m.qty);
    }
    if (lokasiAktif.has(dari) && waktu > (waktuSO.get(dari) ?? '')) {
      tambah(keluar, dari, sku, m.qty);
    }
  }

  // Kumpulkan semua pasangan (lokasi, sku) yang muncul di baseline/masuk/keluar.
  const pasangan = new Map<string, Set<string>>(); // lokasi -> set sku
  for (const peta of [baseline, masuk, keluar]) {
    for (const [lokasi, inner] of peta) {
      let set = pasangan.get(lokasi);
      if (!set) {
        set = new Set();
        pasangan.set(lokasi, set);
      }
      for (const sku of inner.keys()) set.add(sku);
    }
  }

  const baris: BarisStok[] = [];
  for (const [lokasi, skuSet] of pasangan) {
    if (!lokasiAktif.has(lokasi)) continue;
    for (const sku of skuSet) {
      const awal = baseline.get(lokasi)?.get(sku) ?? 0;
      const m = masuk.get(lokasi)?.get(sku) ?? 0;
      const kel = keluar.get(lokasi)?.get(sku) ?? 0;
      const info = nama.get(sku);
      const produk = info?.produk ?? '';
      const satuan = info?.satuan ?? '';

      // Potong ke tanggal HANYA kalau memang ada waktu SO -- kalau tidak,
      // teks "belum pernah SO" ikut terpotong jadi tidak utuh.
      const waktu = waktuSO.get(lokasi) ?? '';
      const tglSO = waktu ? waktu.slice(0, 10) : 'belum pernah SO';
      const sisa = rapi(awal + m - kel);
      const hasilHarga = harga.cari(sku, produk, satuan);
      const hpp = hasilHarga ? hasilHarga.hpp : null;

      baris.push({
        lokasi,
        sku,
        produk,
        satuan,
        hasilSO: rapi(awal),
        tglSO,
        masuk: rapi(m),
        keluar: rapi(kel),
        // Gudang tidak butuh data penjualan Olsera sama sekali: barang cuma
        // berkurang dari gudang lewat mutasi, bukan lewat laku di kasir.
        terjual: '',
        sisa,
        hpp: hpp === null ? '' : rapi(hpp),
        nilaiSisa: nilaiRupiah(sisa, hpp),
        catatan: '',
      });
    }
  }

  // Urutkan (lokasi, nama produk) -- kunci sortir sama seperti hitung_saldo.py.
  baris.sort((a, b) => {
    if (a.lokasi !== b.lokasi) return a.lokasi < b.lokasi ? -1 : 1;
    if (a.produk !== b.produk) return a.produk < b.produk ? -1 : 1;
    return 0;
  });

  return baris;
}
