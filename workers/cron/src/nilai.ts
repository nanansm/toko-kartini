interface Env {
  KATALOG: KVNamespace;
}

interface SaldoTersimpan {
  versi: number;
  waktu: string;
  bulan: string;
  jumlah: number;
  idTerakhir: number;
  saldo: { productId: string; lokasi: string; qty: number }[];
}

interface BungkusRingkas {
  versi: number;
  waktu: string;
  jumlah: number;
  produk: {
    id: string;
    nama: string;
    kategori: string;
    supplier: string | null;
    satuan: { nama: string; pengali: number }[];
    hpp: number | null;
  }[];
}

export interface BarisNilaiLokasi {
  lokasi: string;
  qty: number;
  nilai: number;
  jumlahProduk: number;
}

export interface NilaiTersimpan {
  versi: 1;
  waktu: string;
  waktuSaldo: string;
  totalQty: number;
  totalNilai: number;
  /** qty yang produknya TIDAK punya harga -- tidak ikut totalNilai. */
  qtyTanpaHarga: number;
  /** banyak produk berbeda yang tak punya harga. */
  produkTanpaHarga: number;
  lokasi: BarisNilaiLokasi[];
}

export interface RingkasanNilai {
  waktu: string;
  totalQty: number;
  totalNilai: number;
  qtyTanpaHarga: number;
  takBerubah?: boolean;
  dilewati?: string;
}

// Urutan tetap 5 lokasi nyata -- bukan alfabet, bukan urutan kemunculan di saldo.
// Kode di luar daftar ini (kalau ada) tetap disertakan, ditaruh SETELAHNYA secara
// alfabet, supaya kode asing kelihatan sebagai kejanggalan, bukan hilang diam-diam.
const LOKASI_URUTAN: readonly string[] = [
  'GUDANG_PACKAGING',
  'GUDANG_BAHAN_KUE',
  'GUDANG_CIHERANG',
  'GUDANG_DAPUR_CHERRY',
  'AREA_DISPLAY',
];

interface AkumulasiLokasi {
  qty: number;
  nilai: number;
  jumlahProduk: number;
}

/** Fungsi ini murni KV -- tidak pernah memanggil Google Sheets. Nilai stok
 *  dihitung dari saldo:v1 (ditulis hitungSaldo) dan katalog:cari (ditulis
 *  segarkanKatalog), keduanya sudah ada di KV lebih dulu di siklus yang sama.
 *
 *  DISENGAJA: nilai tertinggal satu siklus dari saldo. `hitungSaldo` baru saja
 *  menulis `saldo:v1` beberapa milidetik sebelumnya, tapi KV menyimpan hasil
 *  baca di tepi sampai 60 detik dan itu tidak bisa diturunkan -- jadi bacaan di
 *  sini hampir pasti masih versi sebelumnya. Melewatkan saldo langsung sebagai
 *  argumen bisa menghapus jeda itu, tapi harganya mengubah tanda tangan
 *  hitungSaldo yang sudah lulus uji lapangan. Yang dipakai sebagai gantinya:
 *  `waktuSaldo` disimpan apa adanya dan ditampilkan di Beranda, jadi angkanya
 *  tidak pernah mengaku lebih baru daripada yang sebenarnya. */
export async function hitungNilai(env: Env): Promise<RingkasanNilai> {
  const waktu = new Date().toISOString();

  const [saldo, katalog] = await Promise.all([
    env.KATALOG.get<SaldoTersimpan>('saldo:v1', 'json'),
    env.KATALOG.get<BungkusRingkas>('katalog:cari', 'json'),
  ]);

  if (saldo === null || katalog === null) {
    return {
      waktu,
      totalQty: 0,
      totalNilai: 0,
      qtyTanpaHarga: 0,
      dilewati: saldo === null ? 'saldo:v1 belum ada' : 'katalog:cari belum ada',
    };
  }

  const petaHpp = new Map<string, number | null>();
  for (const p of katalog.produk) {
    petaHpp.set(p.id, p.hpp);
  }

  const petaLokasi = new Map<string, AkumulasiLokasi>();
  for (const kode of LOKASI_URUTAN) {
    petaLokasi.set(kode, { qty: 0, nilai: 0, jumlahProduk: 0 });
  }

  let totalQty = 0;
  let totalNilai = 0;
  let qtyTanpaHarga = 0;
  const produkTanpaHarga = new Set<string>();

  for (const baris of saldo.saldo) {
    let entri = petaLokasi.get(baris.lokasi);
    if (!entri) {
      entri = { qty: 0, nilai: 0, jumlahProduk: 0 };
      petaLokasi.set(baris.lokasi, entri);
    }
    // Barang tanpa harga tetap barang: qty-nya tetap ikut lokasi & total,
    // yang hilang cuma nilai uangnya -- dan itu wajib kelihatan terpisah,
    // bukan disembunyikan lewat pembulatan ke 0.
    entri.qty += baris.qty;
    entri.jumlahProduk += 1;
    totalQty += baris.qty;

    const hpp = petaHpp.get(baris.productId) ?? null;
    if (hpp === null) {
      qtyTanpaHarga += baris.qty;
      produkTanpaHarga.add(baris.productId);
    } else {
      const nilai = baris.qty * hpp;
      entri.nilai += nilai;
      totalNilai += nilai;
    }
  }

  const kodeLain = [...petaLokasi.keys()].filter((k) => !LOKASI_URUTAN.includes(k)).sort();
  const lokasi: BarisNilaiLokasi[] = [...LOKASI_URUTAN, ...kodeLain].map((kode) => {
    const entri = petaLokasi.get(kode) ?? { qty: 0, nilai: 0, jumlahProduk: 0 };
    return { lokasi: kode, qty: entri.qty, nilai: entri.nilai, jumlahProduk: entri.jumlahProduk };
  });

  const dataBaru = {
    versi: 1 as const,
    totalQty,
    totalNilai,
    qtyTanpaHarga,
    produkTanpaHarga: produkTanpaHarga.size,
    lokasi,
  };

  // Gerbang hemat tulis: cron jalan 144x/hari, jatah tulis KV gratis 1.000/hari.
  // Dibandingkan SEMUA field KECUALI `waktu` dan `waktuSaldo`: `waktuSaldo` ikut
  // berganti tiap siklus walau angkanya identik, jadi membandingkan objek utuh
  // membuat gerbang ini tidak pernah menahan apa pun.
  const lamaStr = await env.KATALOG.get('nilai:v1');
  const lama: NilaiTersimpan | null = lamaStr ? JSON.parse(lamaStr) : null;
  const lamaBanding = lama
    ? {
        versi: lama.versi,
        totalQty: lama.totalQty,
        totalNilai: lama.totalNilai,
        qtyTanpaHarga: lama.qtyTanpaHarga,
        produkTanpaHarga: lama.produkTanpaHarga,
        lokasi: lama.lokasi,
      }
    : null;
  if (lamaBanding !== null && JSON.stringify(lamaBanding) === JSON.stringify(dataBaru)) {
    return { waktu, totalQty, totalNilai, qtyTanpaHarga, takBerubah: true };
  }

  const tersimpan: NilaiTersimpan = { ...dataBaru, waktu, waktuSaldo: saldo.waktu };
  await env.KATALOG.put('nilai:v1', JSON.stringify(tersimpan));

  return { waktu, totalQty, totalNilai, qtyTanpaHarga };
}
