// Aturan skor & urutan pencarian produk -- disalin dari `filterGroups` di
// aplikasi gudang tim (tkgh/src/lib/groupProducts.js) supaya staf yang sudah
// terbiasa dengan urutan hasil di sana tidak bingung waktu pindah ke aplikasi
// ini: kata kunci yang sama harus memberi urutan yang sama.

const BATAS_HASIL = 20

/**
 * Hitung skor kecocokan satu produk terhadap kata kunci.
 *
 * Kata kunci dipecah per spasi lalu dicocokkan kata-per-kata (bukan satu
 * `includes` atas seluruh string), jadi URUTAN KATA BEBAS -- staf yang
 * mengetik "gula pasir" maupun "pasir gula" tetap menemukan barang yang sama.
 *
 * Tingkat skor (5 tertinggi, 0 = tidak cocok, dibuang oleh pemanggil):
 *  5 - SKU cocok PERSIS (basis SKU `id` atau salah satu `satuan[].sku`)
 *  4 - nama produk cocok persis dengan kata kunci
 *  3 - nama produk berawalan kata kunci (apa adanya, belum dipecah)
 *  2 - kata kunci utuh muncul di dalam nama
 *  1 - semua kata dalam kata kunci muncul di nama, urutan bebas
 *  0 - tidak semua kata ditemukan di nama maupun SKU
 */
export function skorProduk<T extends { id: string; nama: string; satuan: { sku: string }[] }>(
  produk: T,
  kataKunci: string,
): number {
  const kata = kataKunci.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (kata.length === 0) return 0

  const nama = produk.nama.trim().toLowerCase()
  const daftarSku = [produk.id, ...produk.satuan.map((s) => s.sku)].map((sku) =>
    sku.trim().toLowerCase(),
  )

  // Jerami = gabungan nama + semua SKU. Kalau ada satu kata saja yang tidak
  // ketemu di sini, produk ini bukan kandidat -- tidak perlu dihitung skornya.
  const jerami = `${nama} ${daftarSku.join(' ')}`
  if (!kata.every((k) => jerami.includes(k))) return 0

  const gabung = kata.join(' ')
  if (daftarSku.some((sku) => sku === gabung)) return 5
  if (nama === gabung) return 4
  if (nama.startsWith(gabung)) return 3
  if (nama.includes(gabung)) return 2
  if (kata.every((k) => nama.includes(k))) return 1
  return 0
}

/**
 * Saring lalu urutkan produk berdasarkan kata kunci.
 *
 * Kata kunci kosong sengaja mengembalikan larik kosong -- daftar 1.130 barang
 * tanpa penyaring tidak berguna di layar HP. Pemanggil yang butuh daftar awal
 * (halaman telusur /barang) menangani keadaan kosong itu sendiri, dan surat
 * jalan Isi Ulang Display mengisinya dengan daftar "sering dipakai" dari
 * `GET /api/sering`.
 *
 * Skor besar dulu; skor seri diputus alfabet nama supaya urutan tidak
 * berubah-ubah sendiri di layar staf.
 */
export function saringUrut<T extends { id: string; nama: string; satuan: { sku: string }[] }>(
  daftar: T[],
  kataKunci: string,
  batas: number = BATAS_HASIL,
): T[] {
  if (kataKunci.trim().length === 0) return []

  const cocok = daftar
    .map((produk) => ({ produk, skor: skorProduk(produk, kataKunci) }))
    .filter((c) => c.skor > 0)

  cocok.sort((a, b) => b.skor - a.skor || a.produk.nama.localeCompare(b.produk.nama, 'id'))

  return cocok.slice(0, batas).map((c) => c.produk)
}
