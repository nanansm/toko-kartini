// Port persis dari scripts/saldo_display.py milik tim. Hitung sisa stok Area
// Display -- beda dengan gudang (saldo-gudang.ts), display berkurang tiap ada
// yang laku, jadi butuh data tab Penjualan. POS cuma menjual dari display,
// gudang tidak pernah tersentuh penjualan langsung.

import type { BarisLog, BarisMutasi, BarisPenjualan, BarisStok } from './tipe';
import { DISPLAY, rapi } from './tipe';
import type { PetaHarga } from './harga';
import { nilaiRupiah } from './harga';
import { sesiTerakhir } from './sesi';

export function hitungSaldoDisplay(
  log: BarisLog[],
  mutasi: BarisMutasi[],
  penjualan: BarisPenjualan[],
  harga: PetaHarga,
): { baris: BarisStok[]; peringatan: string[] } {
  // Waktu SO display terakhir (timestamp penuh, sama seperti saldo-gudang.ts)
  // + kumpulan tanggal buat mencari sesi SO-nya.
  let waktuSO = '';
  const tanggalDisplay = new Set<string>();
  for (const r of log) {
    if (r.rak.trim() !== DISPLAY) continue;
    const waktu = r.waktu.trim();
    if (waktu > waktuSO) waktuSO = waktu;
    if (waktu) tanggalDisplay.add(waktu.slice(0, 10));
  }
  // Display sebesar toko ini bisa habis dihitung dua hari; hari yang
  // bersambung dianggap satu sesi SO, bukan dua SO terpisah.
  const sesi = new Set(sesiTerakhir([...tanggalDisplay]));
  const tglSO = waktuSO.slice(0, 10);
  const daftarSesi = [...sesi].sort();
  const tglMulai = daftarSesi[0] ?? '';

  const baseline = new Map<string, number>(); // produk -> qty saat SO
  const masuk = new Map<string, number>();
  const keluar = new Map<string, number>();
  const terjual = new Map<string, number>();
  const sku = new Map<string, string>();
  const satuan = new Map<string, string>();

  for (const r of log) {
    if (r.rak.trim() !== DISPLAY) continue;
    const produk = r.produk.trim();
    if (!produk) continue;
    if (!sku.has(produk)) sku.set(produk, r.sku.trim());
    if (!satuan.has(produk)) satuan.set(produk, r.satuan.trim());
    // Hanya hitungan dari SESI SO terakhir yang jadi titik awal (baseline).
    if (sesi.has(r.waktu.trim().slice(0, 10))) {
      baseline.set(produk, (baseline.get(produk) ?? 0) + r.qty);
    }
  }

  for (const m of mutasi) {
    const waktu = m.waktu.trim();
    const dari = m.dari.trim();
    const ke = m.ke.trim();
    const produk = m.produk.trim();
    if (!produk || !waktu) continue;
    if (dari !== DISPLAY && ke !== DISPLAY) continue;
    if (!sku.has(produk)) sku.set(produk, m.sku.trim());
    if (!satuan.has(produk)) satuan.set(produk, m.satuan.trim());
    // Mutasi sebelum SO display sudah tercermin di hasil hitungan fisik.
    if (waktu <= waktuSO) continue;
    if (ke === DISPLAY) masuk.set(produk, (masuk.get(produk) ?? 0) + m.qty);
    if (dari === DISPLAY) keluar.set(produk, (keluar.get(produk) ?? 0) + m.qty);
  }

  // Kunci penggabungan penjualan adalah NAMA PRODUK, bukan SKU: tab Penjualan
  // hasil upload Olsera cuma bawa nama produk (dipetakan lewat tab Peta Satuan
  // Olsera), SKU kita sendiri tidak ikut terbawa dari sana.
  const hariSO = tglSO;
  const sehari = new Set<string>(); // produk yang lakunya jatuh di hari SO itu sendiri
  for (const p of penjualan) {
    // Kolom 0 tab Penjualan adalah Tanggal (satu baris = satu HARI). Bentuk
    // lama 'Awal/Akhir' yang masih tertulis di docstring skrip mereka sudah
    // tidak dipakai lagi -- kodenya sendiri membaca kolom Tanggal.
    const tgl = p.tanggal.trim().slice(0, 10);
    const produk = p.produk.trim();
    if (!produk || !tgl) continue;
    // Sebab terisi = konversi satuan gagal, angkanya tidak bisa dipercaya --
    // dilewat di sini, tapi barisnya sengaja tetap ada di tab Penjualan
    // supaya kelihatan, tidak dibuang diam-diam.
    if (p.sebab.trim()) continue;
    if (!satuan.has(produk)) satuan.set(produk, p.satuanDasar.trim());
    if (hariSO) {
      if (tgl < tglMulai) continue; // sebelum SO, sudah tercermin di hitungan fisik
      if (tgl <= hariSO) {
        // Hari SO itu sendiri: SO dihitung pada JAM tertentu, sedangkan
        // penjualan cuma punya TANGGAL. Tidak bisa dipastikan produk ini laku
        // sebelum atau sesudah barangnya dihitung, jadi memasukkannya berarti
        // menebak -- dicatat sebagai catatan+peringatan, bukan dihitung.
        sehari.add(produk);
        continue;
      }
    }
    terjual.set(produk, (terjual.get(produk) ?? 0) + p.qtyDasar);
  }

  const semuaProduk = new Set<string>([
    ...baseline.keys(),
    ...masuk.keys(),
    ...keluar.keys(),
    ...terjual.keys(),
  ]);
  const daftarProduk = [...semuaProduk].sort();

  const baris: BarisStok[] = [];
  for (const produk of daftarProduk) {
    const awal = baseline.get(produk) ?? 0;
    const m = masuk.get(produk) ?? 0;
    const k = keluar.get(produk) ?? 0;
    const j = terjual.get(produk) ?? 0;

    const catatan: string[] = [];
    if (!tglSO) {
      catatan.push('Area Display belum pernah di-SO');
    } else if (!baseline.has(produk)) {
      catatan.push('tidak ikut terhitung saat SO display');
    }
    if (sehari.has(produk)) {
      catatan.push('ada penjualan di hari SO itu sendiri, belum ikut dihitung');
    }

    // Produk yang BELUM PERNAH di-SO: sisa dikosongkan, bukan angka. Tanpa
    // titik awal, "sisa" cuma penjumlahan mutasi dan bukan saldo -- angka
    // minus besar gampang salah dibaca sebagai stok asli.
    const sisa: number | '' = tglSO ? rapi(awal + m - k - j) : '';
    const sat = satuan.get(produk) ?? '';
    const skuProduk = sku.get(produk) ?? '';
    const hasilHarga = harga.cari(skuProduk, produk, sat);
    const hpp = hasilHarga ? hasilHarga.hpp : null;

    baris.push({
      lokasi: DISPLAY,
      sku: skuProduk,
      produk,
      satuan: sat,
      hasilSO: rapi(awal),
      tglSO: tglSO || 'belum pernah SO',
      masuk: rapi(m),
      keluar: rapi(k),
      terjual: rapi(j),
      // Sisa BOLEH minus dan tidak dipaksa jadi 0: minus adalah sinyal barang
      // terjual tanpa isi ulang tercatat, satu-satunya petunjuk kalau
      // Pengeluaran belum lengkap dicatat -- menyembunyikannya menghapus itu.
      sisa,
      hpp: hpp === null ? '' : rapi(hpp),
      nilaiSisa: nilaiRupiah(sisa === '' ? null : sisa, hpp),
      catatan: catatan.join('; '),
    });
  }

  const peringatan: string[] = [];
  if (!tglSO) {
    peringatan.push(
      'Area Display belum pernah di-SO, jadi kolom Sisa dikosongkan. ' +
        'Hitung display dulu di aplikasi, baru angka sisa ada artinya.',
    );
  }
  if (sehari.size > 0) {
    peringatan.push(
      `${sehari.size} produk laku pada hari SO (${hariSO}) itu sendiri dan TIDAK ` +
        'dihitung: penjualan cuma punya tanggal, SO punya jam, jadi tidak bisa ' +
        'dipisah mana yang laku sebelum dan sesudah dihitung. Sisanya kelihatan ' +
        'sedikit lebih banyak daripada kenyataan, cuma untuk hari itu.',
    );
  }

  return { baris, peringatan };
}
