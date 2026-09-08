// Port persis dari scripts/selisih_so.py milik tim. Modul ini MURNI --
// tidak menyentuh Google Sheets. Rumusnya:
//
//   perkiraan = hasil SO sesi sebelumnya + masuk - keluar (di antara dua sesi)
//   selisih   = hasil hitung sesi ini - perkiraan
//
// Selisih MINUS = barang kurang dari seharusnya (menguap). Selisih PLUS =
// barang lebih banyak dari catatan, biasanya ada barang masuk yang lupa
// dicatat.

import type { BarisLog, BarisMutasi, BarisSelisih } from './tipe';
import { rapi } from './tipe';
import type { PetaHarga } from './harga';
import { nilaiRupiah } from './harga';
import { bagiSesi } from './sesi';

export const HEADER_SELISIH: readonly string[] = [
  'Tgl SO', 'Lokasi', 'SKU', 'Produk', 'Satuan', 'Perkiraan',
  'Hasil Hitung', 'Selisih', 'HPP', 'Nilai Selisih', 'Dasar',
];

interface Mutasi {
  waktu: string;
  sku: string;
  qty: number;
}

interface DataSesi {
  qty: Map<string, number>;
  akhir: string;
  mulai: string;
}

/** Tulis sesi SO sebagai satu tanggal, atau rentang kalau memakan beberapa hari. */
function rentang(sesi: DataSesi): string {
  const akhir = sesi.akhir.slice(0, 10);
  return sesi.mulai === akhir ? sesi.mulai : `${sesi.mulai}..${akhir}`;
}

export function hitungSelisih(
  log: BarisLog[],
  mutasi: BarisMutasi[],
  harga: PetaHarga,
): { baris: BarisSelisih[]; cocok: number; nilaiKurang: number; nilaiLebih: number } {
  // Kelompokkan tanggal SO per lokasi jadi SESI, bukan per tanggal mentah:
  // rak besar sering dihitung dua hari bersambung, dan membandingkan hari
  // kedua dengan hari pertama membuat barang yang belum sempat dihitung
  // kemarin terbaca sebagai "barang lebih". Waktu penuh tetap dipakai untuk
  // memotong jendela mutasi di bawah.
  const tanggalRak = new Map<string, Set<string>>();
  for (const r of log) {
    if (!r.waktu || !r.rak) continue;
    const set = tanggalRak.get(r.rak) ?? new Set<string>();
    set.add(r.waktu.slice(0, 10));
    tanggalRak.set(r.rak, set);
  }
  const petaSesi = new Map<string, string>(); // `${rak}|${tanggal}` -> tanggal mulai sesinya
  for (const [rak, tgls] of tanggalRak) {
    for (const kelompok of bagiSesi([...tgls])) {
      const mulai = kelompok[0];
      if (mulai === undefined) continue;
      for (const t of kelompok) petaSesi.set(`${rak}|${t}`, mulai);
    }
  }

  const so = new Map<string, Map<string, DataSesi>>();
  const nama = new Map<string, string>();
  const satuan = new Map<string, string>();

  for (const r of log) {
    if (!r.waktu || !r.rak || !r.sku) continue;
    const tgl = r.waktu.slice(0, 10);
    const kunci = petaSesi.get(`${r.rak}|${tgl}`) ?? tgl;
    let perRak = so.get(r.rak);
    if (!perRak) {
      perRak = new Map<string, DataSesi>();
      so.set(r.rak, perRak);
    }
    let hari = perRak.get(kunci);
    if (!hari) {
      hari = { qty: new Map<string, number>(), akhir: '', mulai: kunci };
      perRak.set(kunci, hari);
    }
    hari.mulai = kunci;
    hari.qty.set(r.sku, (hari.qty.get(r.sku) ?? 0) + r.qty);
    if (r.waktu > hari.akhir) hari.akhir = r.waktu;
    if (!nama.has(r.sku)) nama.set(r.sku, r.produk);
    if (!satuan.has(r.sku)) satuan.set(r.sku, r.satuan);
  }

  // Mutasi dikelompokkan per lokasi, disimpan dengan waktunya supaya bisa
  // disaring per jendela antar-sesi.
  const masuk = new Map<string, Mutasi[]>();
  const keluar = new Map<string, Mutasi[]>();
  for (const r of mutasi) {
    if (!r.waktu || !r.sku) continue;
    if (!nama.has(r.sku)) nama.set(r.sku, r.produk);
    if (!satuan.has(r.sku)) satuan.set(r.sku, r.satuan);
    if (r.ke) {
      const arr = masuk.get(r.ke) ?? [];
      arr.push({ waktu: r.waktu, sku: r.sku, qty: r.qty });
      masuk.set(r.ke, arr);
    }
    if (r.dari) {
      const arr = keluar.get(r.dari) ?? [];
      arr.push({ waktu: r.waktu, sku: r.sku, qty: r.qty });
      keluar.set(r.dari, arr);
    }
  }

  const baris: BarisSelisih[] = [];
  let cocok = 0;

  for (const lokasi of [...so.keys()].sort()) {
    const perRak = so.get(lokasi);
    if (!perRak) continue;
    const sesi = [...perRak.keys()].sort();
    for (let i = 0; i < sesi.length; i += 1) {
      const kunci = sesi[i];
      if (kunci === undefined) continue;
      const ini = perRak.get(kunci);
      if (!ini) continue;
      // Tanggal yang dilaporkan adalah hari sesi itu SELESAI.
      const tgl = ini.akhir.slice(0, 10);
      const kunciSebelum = i > 0 ? sesi[i - 1] : undefined;
      const sebelum = kunciSebelum !== undefined ? perRak.get(kunciSebelum) : undefined;
      const batasBawah = sebelum ? sebelum.akhir : '';
      const batasAtas = ini.akhir;
      const dasar = sebelum
        ? `SO ${rentang(sebelum)}`
        : 'SO pertama — perkiraan dari mutasi saja, belum tentu benar';

      const geser = new Map<string, number>();
      for (const m of masuk.get(lokasi) ?? []) {
        // Stempel waktu format YYYY-MM-DD HH:MM:SS sudah urut leksikografis,
        // jadi perbandingan string setara perbandingan waktu tanpa risiko
        // pergeseran zona waktu dari parsing Date.
        if (batasBawah < m.waktu && m.waktu <= batasAtas) {
          geser.set(m.sku, (geser.get(m.sku) ?? 0) + m.qty);
        }
      }
      for (const k of keluar.get(lokasi) ?? []) {
        if (batasBawah < k.waktu && k.waktu <= batasAtas) {
          geser.set(k.sku, (geser.get(k.sku) ?? 0) - k.qty);
        }
      }

      const awal = sebelum ? sebelum.qty : new Map<string, number>();
      // Produk yang DIHARAPKAN ada (dari sesi sebelumnya atau mutasi) tapi
      // tidak ikut dihitung sesi ini tetap harus muncul: hasilnya 0 dan itu
      // justru selisih terbesar.
      const skus = new Set<string>([...awal.keys(), ...geser.keys(), ...ini.qty.keys()]);
      const skuUrut = [...skus].sort((a, b) => {
        const na = nama.get(a) ?? a;
        const nb = nama.get(b) ?? b;
        return na < nb ? -1 : na > nb ? 1 : 0;
      });

      for (const sku of skuUrut) {
        const perkiraan = (awal.get(sku) ?? 0) + (geser.get(sku) ?? 0);
        const hasil = ini.qty.get(sku) ?? 0;
        const selisih = hasil - perkiraan;
        // Baris yang selisihnya (nyaris) nol TIDAK ditulis, cuma dihitung ke
        // `cocok`: menampilkan ribuan baris berselisih nol menenggelamkan
        // yang benar-benar meleset. Ambang 1e-9 menyerap sisa pembulatan
        // float, bukan toleransi selisih sungguhan.
        if (Math.abs(selisih) < 1e-9) {
          cocok += 1;
          continue;
        }
        const h = harga.cari(sku, nama.get(sku) ?? '', satuan.get(sku) ?? '');
        const hpp = h ? h.hpp : null;
        const selisihRapi = rapi(selisih);
        baris.push({
          tglSO: tgl,
          lokasi,
          sku,
          produk: nama.get(sku) ?? '',
          satuan: satuan.get(sku) ?? '',
          perkiraan: rapi(perkiraan),
          hasilHitung: rapi(hasil),
          selisih: selisihRapi,
          hpp: hpp === null ? '' : rapi(hpp),
          nilaiSelisih: nilaiRupiah(selisihRapi, hpp),
          dasar,
        });
      }
    }
  }

  // Terbaru di atas; di dalam tanggal yang sama, nilai selisih termahal
  // dulu. Ini setara dengan dua sort() berurutan (stabil) di selisih_so.py:
  // sort naik (tgl, -abs(nilai)) lalu sort turun berdasar tgl saja.
  baris.sort((a, b) => {
    if (a.tglSO !== b.tglSO) return a.tglSO < b.tglSO ? 1 : -1;
    const na = typeof a.nilaiSelisih === 'number' ? Math.abs(a.nilaiSelisih) : 0;
    const nb = typeof b.nilaiSelisih === 'number' ? Math.abs(b.nilaiSelisih) : 0;
    return nb - na;
  });

  let nilaiKurang = 0;
  let nilaiLebih = 0;
  for (const b of baris) {
    if (typeof b.nilaiSelisih === 'number') {
      if (b.nilaiSelisih < 0) nilaiKurang += Math.abs(b.nilaiSelisih);
      else if (b.nilaiSelisih > 0) nilaiLebih += b.nilaiSelisih;
    }
  }

  return { baris, cocok, nilaiKurang, nilaiLebih };
}

export function keSelSelisih(baris: BarisSelisih[]): (string | number)[][] {
  return baris.map((b) => [
    b.tglSO, b.lokasi, b.sku, b.produk, b.satuan,
    b.perkiraan, b.hasilHitung, b.selisih, b.hpp, b.nilaiSelisih, b.dasar,
  ]);
}
