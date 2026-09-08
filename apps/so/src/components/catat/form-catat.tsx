'use client';

import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LembarQty, type SatuanTingkat } from '@/components/catat/lembar-qty';
import { type KodeLokasi, LABEL_LOKASI } from '@/lib/lokasi';
import {
  type JenisMutasi,
  type SebabRusak,
  type MasukanMutasiTim,
  LABEL_JENIS,
  LABEL_SEBAB,
  ARAH_SAH,
  satuanTampil,
} from '@/lib/mutasi';
import { cariLokal, katalogSiap, segarkanKatalogLokal, type ProdukRingkas } from '@/lib/katalog-lokal';
import { ambilSemua, tambahAntre, type ItemAntre, type StatusAntre } from '@/lib/antrean';
import { type KeadaanKirim, langgananKirim, mulaiPengirim, picuKirim } from '@/lib/pengirim';
import {
  type ItemKeranjang,
  ambilKeranjang,
  hapusKeranjang,
  kosongkanKeranjang,
  pulihkanKeranjang,
  tambahKeranjang,
  ubahKeranjang,
} from '@/lib/keranjang';

// Opname (hitung stok) punya jalur sendiri yang belum dibangun — jangan ditampilkan di sini.
type TabJenis = Exclude<JenisMutasi, 'OPNAME'>;
const TAB_JENIS: readonly TabJenis[] = ['DATANG', 'ISI_DISPLAY', 'PINDAH', 'RUSAK'];

function isTabJenis(nilai: string): nilai is TabJenis {
  return (TAB_JENIS as readonly string[]).includes(nilai);
}

// Bentuk balasan GET /api/sering — beda dengan ProdukRingkas (katalog) karena
// baris ini datang dari rekap pemakaian, bukan dari daftar barang lengkap.
interface ProdukSering {
  productId: string;
  namaProduk: string;
  jumlah: number;
}

const LABEL_STATUS_ANTRE: Record<StatusAntre, string> = {
  terkirim: 'Tersimpan',
  menunggu: 'Menunggu',
  gagal: 'Gagal',
};

// Badge bawaan cuma punya default/secondary/destructive/outline — tak ada hijau/kuning,
// jadi warna status ditimpa lewat className di atas variant "outline".
const KELAS_STATUS_ANTRE: Record<StatusAntre, string> = {
  terkirim: 'border-transparent bg-green-600 text-white',
  menunggu: 'border-transparent bg-yellow-500 text-black',
  gagal: 'border-transparent bg-destructive text-white',
};

// Baris keranjang cuma menyimpan qty per nama satuan, bukan pengalinya — untuk
// menyunting/menampilkan totalnya perlu satuan produk itu dicari ulang dari
// katalog lokal (bukan disimpan dobel di keranjang.ts).
async function cariSatuanProduk(productId: string): Promise<SatuanTingkat[] | null> {
  const hasil = await cariLokal(productId, 5);
  const cocok = hasil.find((p) => p.id === productId);
  return cocok ? cocok.satuan : null;
}

function ringkasQtySatuan(qtySatuan: Record<string, number>): string {
  return Object.entries(qtySatuan)
    .filter(([, q]) => q > 0)
    .map(([nama, q]) => `${q} ${nama}`)
    .join(' + ');
}

// Total dalam satuan pokok (pengali terkecil) — rumus sama persis dengan TOTAL
// di LembarQty, supaya angka yang dilihat staf konsisten di kedua tempat.
function totalPokokKeranjang(
  qtySatuan: Record<string, number>,
  satuan: readonly SatuanTingkat[],
): { total: number; namaPokok: string } | null {
  if (satuan.length === 0) return null;
  // satuanTampil() dulu: qtySatuan dikunci per nama satuan, jadi menjumlah
  // langsung dari katalog akan menghitung nama kembar (130 produk) dua kali.
  const urut = satuanTampil(satuan).sort((a, b) => a.pengali - b.pengali);
  const pokok = urut[0];
  if (!pokok) return null;
  let total = 0;
  for (const s of urut) {
    const q = qtySatuan[s.nama];
    if (q) total += q * s.pengali;
  }
  return { total, namaPokok: pokok.nama };
}

export function FormCatat(): React.JSX.Element {
  const [jenis, setJenis] = React.useState<TabJenis>('DATANG');
  // true kalau jenis datang dari kueri `?jenis=` beranda — layar lokasi lalu
  // menampilkan namanya sebagai judul (bukan Tabs pemilih), sesuai alur yang
  // sudah dipakai staf di beranda gudang.
  const [jenisTerkunci, setJenisTerkunci] = React.useState(false);

  // Layar dua langkah: pilih lokasi dulu (medan sedikit, cocok dipakai sambil
  // berdiri), baru cari & timbang barang. Mulai dari 'lokasi'.
  const [langkah, setLangkah] = React.useState<'lokasi' | 'isi'>('lokasi');
  const [pesanSukses, setPesanSukses] = React.useState<string | null>(null);
  const [seringDiisi, setSeringDiisi] = React.useState<ProdukSering[]>([]);

  const [katalogAda, setKatalogAda] = React.useState(false);
  const [kataKunci, setKataKunci] = React.useState('');
  const [hasilCari, setHasilCari] = React.useState<ProdukRingkas[]>([]);
  const [mencari, setMencari] = React.useState(false);
  const [errorCari, setErrorCari] = React.useState<string | null>(null);
  const [produkTerpilih, setProdukTerpilih] = React.useState<ProdukRingkas | null>(null);

  const arahSah = ARAH_SAH[jenis];
  const asalLocked = arahSah.dari.length === 1;
  const tujuanLocked = arahSah.ke.length === 1;

  const [dari, setDari] = React.useState<KodeLokasi | null>(
    arahSah.dari.length === 1 ? (arahSah.dari[0] ?? null) : null,
  );
  const [ke, setKe] = React.useState<KodeLokasi | null>(
    arahSah.ke.length === 1 ? (arahSah.ke[0] ?? null) : null,
  );

  const [sebab, setSebab] = React.useState<SebabRusak | ''>('');
  const [catatan, setCatatan] = React.useState('');

  // Sheet qty: `lembarProduk` non-null artinya lembar terbuka. `lembarEditId`
  // null = mengisi entri baru dari hasil pencarian; terisi = menyunting baris
  // keranjang yang sudah ada (cuma qty-nya yang boleh berubah).
  const [lembarProduk, setLembarProduk] = React.useState<{
    productId: string;
    nama: string;
    satuan: SatuanTingkat[];
  } | null>(null);
  const [lembarNilaiAwal, setLembarNilaiAwal] = React.useState<Record<string, number> | undefined>(
    undefined,
  );
  const [lembarEditId, setLembarEditId] = React.useState<string | null>(null);

  // Cache satuan per productId supaya baris keranjang tidak perlu mencari
  // katalog berulang tiap render.
  const [satuanCache, setSatuanCache] = React.useState<Record<string, SatuanTingkat[]>>({});

  const [keranjang, setKeranjang] = React.useState<ItemKeranjang[]>([]);
  const [notifHapus, setNotifHapus] = React.useState<ItemKeranjang | null>(null);

  const [errorSimpan, setErrorSimpan] = React.useState<string | null>(null);
  const [daftar, setDaftar] = React.useState<ItemAntre[]>([]);
  const [keadaan, setKeadaan] = React.useState<KeadaanKirim>({
    daring: true,
    menunggu: 0,
    sibuk: false,
    sesiHabis: false,
    terakhirGalat: null,
  });

  const muatUlangDaftar = React.useCallback(async () => {
    setDaftar(await ambilSemua());
  }, []);

  const muatUlangKeranjang = React.useCallback(async () => {
    setKeranjang(await ambilKeranjang());
  }, []);

  // Pengirim jalan di latar belakang selama formulir dipasang — bukan cuma
  // saat tombol Kirim semua ditekan, supaya antrean lama juga ikut tercicil.
  React.useEffect(() => {
    const berhentiPengirim = mulaiPengirim();
    const berhentiLanggan = langgananKirim((k) => {
      setKeadaan(k);
      void muatUlangDaftar();
    });
    void muatUlangDaftar();
    return () => {
      berhentiLanggan();
      berhentiPengirim();
    };
  }, [muatUlangDaftar]);

  React.useEffect(() => {
    void muatUlangKeranjang();
  }, [muatUlangKeranjang]);

  // Katalog disegarkan di latar belakang — formulir tidak menunggunya supaya
  // tetap bisa dipakai walau sinyal Gudang Ciherang lagi jelek.
  React.useEffect(() => {
    let dibatalkan = false;
    void katalogSiap().then((siap) => {
      if (!dibatalkan) setKatalogAda(siap);
    });
    void segarkanKatalogLokal().then(() => {
      if (dibatalkan) return;
      void katalogSiap().then((siap) => setKatalogAda(siap));
    });
    return () => {
      dibatalkan = true;
    };
  }, []);

  // Jenis mutasi ditentukan lewat kueri `?jenis=` dari beranda. `useSearchParams`
  // menuntut halaman pemanggil terbungkus <Suspense>, dan `app/catat/page.tsx`
  // belum begitu — jadi kueri dibaca manual dari location, sekali saat pasang,
  // biar tak perlu menyunting berkas lain.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dariUrl = params.get('jenis');
    if (dariUrl !== null && isTabJenis(dariUrl)) {
      gantiTab(dariUrl);
      setJenisTerkunci(true);
    }
    // Cuma dibaca sekali saat pasang — kueri tak berubah selama form dipakai.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Sering diisi ulang" cuma buat ISI_DISPLAY, cuma di langkah 'isi', dan
  // cuma dipanggil sekali per kunjungan langkah — kenyamanan staf gudang biar
  // tak ketik ulang barang yang itu-itu saja saat kotak cari masih kosong.
  React.useEffect(() => {
    if (langkah !== 'isi' || jenis !== 'ISI_DISPLAY') {
      setSeringDiisi([]);
      return;
    }
    let dibatalkan = false;
    fetch('/api/sering?jenis=ISI_DISPLAY&batas=8')
      .then((r) => (r.ok ? (r.json() as Promise<{ ok: boolean; produk: ProdukSering[] }>) : null))
      .then((data) => {
        if (dibatalkan || !data || !data.ok) return;
        setSeringDiisi(data.produk);
      })
      .catch(() => {
        // Kenyamanan, bukan kebutuhan — gagal diam-diam, jangan ganggu alur catat.
      });
    return () => {
      dibatalkan = true;
    };
  }, [langkah, jenis]);

  // Isi cache satuan buat baris keranjang yang productId-nya belum pernah
  // muncul di hasil pencarian — supaya rincian & total di daftar tetap terisi
  // walau baris itu dibuat sebelum sesi ini (katalog beda perangkat).
  React.useEffect(() => {
    const belum = keranjang.filter((it) => !satuanCache[it.productId]);
    if (belum.length === 0) return;
    let dibatalkan = false;
    void Promise.all(belum.map((it) => cariSatuanProduk(it.productId))).then((hasil) => {
      if (dibatalkan) return;
      setSatuanCache((prev) => {
        const salinan = { ...prev };
        belum.forEach((it, i) => {
          const s = hasil[i];
          if (s) salinan[it.productId] = s;
        });
        return salinan;
      });
    });
    return () => {
      dibatalkan = true;
    };
  }, [keranjang, satuanCache]);

  const opsiTujuan =
    jenis === 'PINDAH' ? arahSah.ke.filter((k) => k !== dari) : arahSah.ke;

  function tutupLembar(): void {
    if (lembarEditId === null) {
      // Batal saat mengisi entri baru — kembali ke pencarian, bukan menggantung
      // di kartu produk tanpa cara membuka lembarnya lagi.
      setProdukTerpilih(null);
      setKataKunci('');
    }
    setLembarProduk(null);
    setLembarEditId(null);
    setLembarNilaiAwal(undefined);
  }

  function gantiTab(nilai: string): void {
    if (!isTabJenis(nilai)) return;
    const arahBaru = ARAH_SAH[nilai];
    setJenis(nilai);
    setKataKunci('');
    setHasilCari([]);
    setErrorCari(null);
    setProdukTerpilih(null);
    setLembarProduk(null);
    setLembarEditId(null);
    setLembarNilaiAwal(undefined);
    setSebab('');
    setCatatan('');
    setErrorSimpan(null);
    setNotifHapus(null);
    setDari(arahBaru.dari.length === 1 ? (arahBaru.dari[0] ?? null) : null);
    setKe(arahBaru.ke.length === 1 ? (arahBaru.ke[0] ?? null) : null);
    // Keranjang SENGAJA tidak dikosongkan — tiap item sudah menyimpan jenisnya
    // sendiri, mengosongkannya di sini berarti membuang pekerjaan staf.
  }

  React.useEffect(() => {
    if (produkTerpilih) return; // sudah pilih barang, tak perlu cari lagi
    const kata = kataKunci.trim();
    if (kata === '') {
      setHasilCari([]);
      setErrorCari(null);
      setMencari(false);
      return;
    }
    if (!katalogAda) {
      setErrorCari('Barang belum bisa dicari. Buka aplikasi ini sekali saat ada sinyal.');
      setHasilCari([]);
      return;
    }
    const timer = setTimeout(() => {
      setMencari(true);
      cariLokal(kata, 20)
        .then((hasil) => {
          setErrorCari(null);
          setHasilCari(hasil);
          setSatuanCache((prev) => {
            const salinan = { ...prev };
            for (const p of hasil) {
              if (!salinan[p.id]) salinan[p.id] = p.satuan;
            }
            return salinan;
          });
        })
        .finally(() => setMencari(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [kataKunci, produkTerpilih, katalogAda]);

  // Sisi bebas dipilih pakai daftar tombol, bukan Select — dropdown menuntut
  // dua ketukan dan menutupi layar; di gudang pilihannya cuma 3-5 dan semuanya
  // muat sebagai tombol besar.
  function pilihDari(k: KodeLokasi): void {
    setDari(k);
    // Tujuan yang sudah dipilih bisa jadi sama dgn asal baru — batalkan.
    setKe((prev) => (jenis === 'PINDAH' && prev === k ? null : prev));
  }

  async function pilihProdukSering(productId: string): Promise<void> {
    const hasil = await cariLokal(productId, 5);
    const produk = hasil.find((p) => p.id === productId);
    if (!produk) return; // tak ada di katalog lokal — lewati diam-diam
    pilihProduk(produk);
  }

  function pilihProduk(p: ProdukRingkas): void {
    setProdukTerpilih(p);
    setHasilCari([]);
    setErrorSimpan(null);
    setNotifHapus(null);
    setLembarProduk({ productId: p.id, nama: p.nama, satuan: p.satuan });
    setLembarNilaiAwal(undefined);
    setLembarEditId(null);
  }

  function gantiProduk(): void {
    setProdukTerpilih(null);
    setKataKunci('');
    setHasilCari([]);
    setLembarProduk(null);
    setLembarEditId(null);
    setLembarNilaiAwal(undefined);
  }

  async function bukaSuntingBaris(item: ItemKeranjang): Promise<void> {
    setNotifHapus(null);
    setErrorSimpan(null);
    const dariCache = satuanCache[item.productId];
    const satuan = dariCache ?? (await cariSatuanProduk(item.productId));
    setLembarProduk({
      productId: item.productId,
      nama: item.nama,
      // Katalog lokal mungkin belum sinkron utk produk lama — fallback pakai
      // satuan yang sudah tercatat di baris ini sendiri (pengali dianggap 1,
      // cuma memengaruhi tampilan TOTAL, bukan qty yang disimpan).
      satuan: satuan ?? Object.keys(item.qtySatuan).map((nama) => ({ nama, pengali: 1 })),
    });
    setLembarNilaiAwal(item.qtySatuan);
    setLembarEditId(item.id);
  }

  function simpanLembar(qtySatuan: Record<string, number>): void {
    if (!lembarProduk) return;

    if (lembarEditId) {
      const id = lembarEditId;
      void (async () => {
        const hasil = await ubahKeranjang(id, { qtySatuan });
        if (!hasil) {
          setErrorSimpan('Gagal mengubah barang di keranjang. Coba lagi.');
          return;
        }
        setErrorSimpan(null);
        tutupLembar();
        await muatUlangKeranjang();
      })();
      return;
    }

    // Entri baru: lembar cuma tahu qty, jadi arah & sebab divalidasi di sini
    // sebelum masuk keranjang.
    if (dari === null || ke === null) {
      setErrorSimpan('Asal dan tujuan wajib diisi.');
      return;
    }
    if (jenis === 'PINDAH' && dari === ke) {
      setErrorSimpan('Asal dan tujuan tidak boleh sama.');
      return;
    }
    if (jenis === 'RUSAK' && sebab === '') {
      setErrorSimpan('Sebab wajib diisi untuk barang rusak.');
      return;
    }

    const produk = lembarProduk;
    void (async () => {
      // DO `Buku` menyimpan SATU baris terbuka per (dari, ke, produk, orang) --
      // kiriman kedua untuk kunci yang sama MENIMPA yang pertama, bukan
      // menambah baris (lihat indeks `mutasi_terbuka` di src/do/buku.ts). Kalau
      // keranjang membolehkan dua baris untuk kunci itu, qty baris pertama
      // lenyap tanpa satu pun tanda saat dikirim. Digabung di sini, di tempat
      // staf masih bisa melihat hasilnya.
      const kembar = keranjang.find(
        (k) => k.jenis === jenis && k.dari === dari && k.ke === ke && k.productId === produk.productId,
      );
      if (kembar) {
        const gabung: Record<string, number> = { ...kembar.qtySatuan };
        for (const [nama, q] of Object.entries(qtySatuan)) {
          gabung[nama] = (gabung[nama] ?? 0) + q;
        }
        const hasil = await ubahKeranjang(kembar.id, { qtySatuan: gabung });
        if (!hasil) {
          setErrorSimpan('Gagal menyimpan ke keranjang di HP ini. Coba lagi.');
          return;
        }
        setErrorSimpan(null);
        setPesanSukses(`${produk.nama} digabung ke baris yang sudah ada di keranjang.`);
        tutupLembar();
        await muatUlangKeranjang();
        return;
      }

      const item = await tambahKeranjang({
        jenis,
        productId: produk.productId,
        nama: produk.nama,
        qtySatuan,
        dari,
        ke,
        sebab: jenis === 'RUSAK' ? sebab : null,
        catatan: catatan.trim() === '' ? null : catatan.trim(),
      });
      if (!item) {
        // IndexedDB tak tersedia — jangan pura-pura tersimpan.
        setErrorSimpan('Gagal menyimpan ke keranjang di HP ini. Coba lagi.');
        return;
      }
      setErrorSimpan(null);
      tutupLembar();
      await muatUlangKeranjang();
    })();
  }

  async function hapusBaris(id: string): Promise<void> {
    setNotifHapus(null);
    const dihapus = await hapusKeranjang(id);
    if (dihapus) setNotifHapus(dihapus);
    await muatUlangKeranjang();
  }

  async function urungkanHapus(): Promise<void> {
    if (!notifHapus) return;
    const berhasil = await pulihkanKeranjang(notifHapus);
    setNotifHapus(null);
    if (!berhasil) setErrorSimpan('Gagal mengurungkan penghapusan.');
    await muatUlangKeranjang();
  }

  async function kirimSemua(): Promise<void> {
    if (keranjang.length === 0) return;
    setNotifHapus(null);

    const totalDikirim = keranjang.length;
    const idBerhasil: string[] = [];
    let adaGagal = false;

    for (const item of keranjang) {
      const qtySatuan = Object.fromEntries(
        Object.entries(item.qtySatuan).filter(([, q]) => q > 0),
      );
      if (Object.keys(qtySatuan).length === 0) {
        adaGagal = true;
        continue;
      }
      // SATU baris antrean memuat SEMUA satuan barang ini sekaligus, tidak
      // dipecah per satuan. Tab `Mutasi` tim mencatat "1 Pack (10 Bks) + 1 Bks"
      // sebagai satu catatan dengan satu qty pokok; memecahnya jadi dua baris
      // membuat riwayat kita tidak sebentuk dengan yang sudah ada di sana, dan
      // dua baris terpisah tidak bisa lagi dibatalkan sebagai satu kesatuan.
      const muatan: MasukanMutasiTim = {
        clientId: crypto.randomUUID(),
        jenis: item.jenis,
        productId: item.productId,
        namaSaatItu: item.nama,
        // Asal/tujuan dikunci per jenis surat jalan, jadi keduanya SELALU
        // terisi saat sampai di sini -- beda dengan MasukanMutasi lama yang
        // masih membolehkan null.
        dari: item.dari ?? '',
        ke: item.ke ?? '',
        nota: item.catatan ?? '',
        sebab: item.sebab,
        qtySatuan,
      };
      const hasil = await tambahAntre(muatan);
      if (hasil) {
        idBerhasil.push(item.id);
      } else {
        adaGagal = true;
      }
    }

    if (idBerhasil.length > 0) await kosongkanKeranjang(idBerhasil);
    setErrorSimpan(
      adaGagal ? 'Sebagian barang gagal diantre — tetap di keranjang, coba lagi.' : null,
    );

    if (!adaGagal) {
      // Semua terkirim — balik ke langkah lokasi dgn asal/tujuan direset ke
      // bawaan jenis ini, siap buat mutasi berikutnya tanpa isi ulang.
      setPesanSukses(`${totalDikirim} barang tercatat sebagai ${LABEL_JENIS[jenis]}.`);
      const arahBaru = ARAH_SAH[jenis];
      setDari(arahBaru.dari.length === 1 ? (arahBaru.dari[0] ?? null) : null);
      setKe(arahBaru.ke.length === 1 ? (arahBaru.ke[0] ?? null) : null);
      setSebab('');
      setCatatan('');
      setLangkah('lokasi');
    }

    await muatUlangKeranjang();
    await muatUlangDaftar();
    picuKirim();
  }

  // Siap lanjut ke langkah isi: asal & tujuan terisi & berbeda, dan sebab
  // wajib terisi kalau jenisnya RUSAK.
  const siapLanjut = dari !== null && ke !== null && dari !== ke && (jenis !== 'RUSAK' || sebab !== '');

  // DATANG dicatat dari nota supplier, bukan catatan bebas — labelnya
  // menyesuaikan supaya staf tahu apa yang diketik.
  const labelCatatan = jenis === 'DATANG' ? 'Nota' : 'Catatan (opsional)';
  const placeholderCatatan = jenis === 'DATANG' ? 'Nama supplier atau nomor nota' : undefined;

  const teksKirim =
    keadaan.daring === false
      ? `${keranjang.length} barang — kirim nanti kalau ada sinyal`
      : `Kirim ${keranjang.length} barang`;

  return (
    <div className="flex flex-col gap-4 pb-4">
      {(keadaan.daring === false || keadaan.menunggu > 0) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {keadaan.daring === false && (
            <Badge variant="secondary">Luring — catatan disimpan di HP</Badge>
          )}
          {keadaan.menunggu > 0 && (
            <span className="text-xs text-muted-foreground">{keadaan.menunggu} menunggu terkirim</span>
          )}
        </div>
      )}
      {keadaan.sesiHabis && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          Sesi berakhir. Masuk lagi supaya catatan terkirim.{' '}
          <a href="/masuk" className="font-semibold underline">
            Masuk
          </a>
        </div>
      )}

      {langkah === 'lokasi' && (
        <>
          {pesanSukses && (
            <div className="rounded-md border border-green-600 bg-green-50 p-3 text-sm text-green-800">
              {pesanSukses}
            </div>
          )}

          {jenisTerkunci ? (
            // Jenis sudah ditentukan dari beranda — tampilkan sebagai judul,
            // bukan Tabs, biar tak kelihatan seperti masih bisa diganti bebas.
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{LABEL_JENIS[jenis]}</h2>
              <a href="/" className="text-xs font-medium text-muted-foreground underline">
                Ganti jenis
              </a>
            </div>
          ) : (
            <Tabs value={jenis} onValueChange={gantiTab}>
              <TabsList className="grid w-full grid-cols-4">
                {TAB_JENIS.map((t) => (
                  <TabsTrigger key={t} value={t}>
                    {LABEL_JENIS[t]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Asal</Label>
              {asalLocked ? (
                <div className="rounded-md border border-border bg-muted p-3 text-sm font-medium">
                  {dari ? LABEL_LOKASI[dari] : '-'} (terkunci)
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {arahSah.dari.map((k) => (
                    <Button
                      key={k}
                      type="button"
                      variant={dari === k ? 'default' : 'outline'}
                      className="h-12 w-full text-base"
                      onClick={() => pilihDari(k)}
                    >
                      {LABEL_LOKASI[k]}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Tujuan</Label>
              {tujuanLocked ? (
                <div className="rounded-md border border-border bg-muted p-3 text-sm font-medium">
                  {ke ? LABEL_LOKASI[ke] : '-'} (terkunci)
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {opsiTujuan.map((k) => (
                    <Button
                      key={k}
                      type="button"
                      variant={ke === k ? 'default' : 'outline'}
                      className="h-12 w-full text-base"
                      onClick={() => setKe(k)}
                    >
                      {LABEL_LOKASI[k]}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {jenis === 'RUSAK' && (
            <div className="space-y-2">
              <Label>Sebab</Label>
              <div className="grid grid-cols-1 gap-2">
                {(Object.keys(LABEL_SEBAB) as SebabRusak[]).map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant={sebab === s ? 'default' : 'outline'}
                    className="h-12 w-full text-base"
                    onClick={() => setSebab(s)}
                  >
                    {LABEL_SEBAB[s]}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>{labelCatatan}</Label>
            <Input
              value={catatan}
              placeholder={placeholderCatatan}
              onChange={(e) => setCatatan(e.target.value)}
            />
          </div>

          {/* Tombol lanjut ditaruh sticky sama seperti tombol kirim di langkah
              isi — biar staf tak perlu gulir ke bawah cuma buat lanjut. */}
          <div className="sticky bottom-0 -mx-4 border-t border-border bg-background p-4">
            <Button
              className="h-12 w-full text-base"
              disabled={!siapLanjut}
              onClick={() => {
                setPesanSukses(null);
                setLangkah('isi');
              }}
            >
              {siapLanjut ? 'Lanjut, pilih barang' : 'Pilih lokasi dulu'}
            </Button>
          </div>
        </>
      )}

      {langkah === 'isi' && (
        <>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-semibold">{LABEL_JENIS[jenis]}</div>
              <div className="text-xs text-muted-foreground">
                {dari ? LABEL_LOKASI[dari] : '-'} → {ke ? LABEL_LOKASI[ke] : '-'}
                {jenis === 'RUSAK' && sebab ? ` · ${LABEL_SEBAB[sebab]}` : ''}
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setLangkah('lokasi')}>
              Ubah lokasi
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Barang</Label>
            {produkTerpilih ? (
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <div className="font-semibold">{produkTerpilih.nama}</div>
                  <div className="text-xs text-muted-foreground">
                    {produkTerpilih.id} · {produkTerpilih.kategori}
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={gantiProduk}>
                  Ganti
                </Button>
              </div>
            ) : (
              <>
                <Input
                  placeholder="Ketik nama produk atau SKU"
                  value={kataKunci}
                  onChange={(e) => setKataKunci(e.target.value)}
                />
                {mencari && <div className="text-xs text-muted-foreground">Mencari...</div>}
                {errorCari && <div className="text-xs text-destructive">{errorCari}</div>}
                {!errorCari && hasilCari.length > 0 && (
                  <div className="flex flex-col divide-y divide-border rounded-md border border-border">
                    {hasilCari.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="p-3 text-left hover:bg-accent"
                        onClick={() => pilihProduk(p)}
                      >
                        <div className="font-semibold">{p.nama}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.id} · {p.kategori}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {jenis === 'ISI_DISPLAY' && kataKunci.trim() === '' && seringDiisi.length > 0 && (
                  <div className="space-y-2">
                    <Label>Sering diisi ulang</Label>
                    <div className="flex flex-col divide-y divide-border rounded-md border border-border">
                      {seringDiisi.map((p) => (
                        <button
                          key={p.productId}
                          type="button"
                          className="p-3 text-left hover:bg-accent"
                          onClick={() => void pilihProdukSering(p.productId)}
                        >
                          <div className="font-semibold">{p.namaProduk}</div>
                          <div className="text-xs text-muted-foreground">{p.jumlah}x diisi ulang</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <Separator />

          {errorSimpan && <div className="text-sm text-destructive">{errorSimpan}</div>}

          <div className="space-y-2">
            <Label>Keranjang</Label>
            {notifHapus && (
              <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted p-3 text-sm">
                <span>Entri dihapus</span>
                <Button type="button" variant="outline" size="sm" onClick={() => void urungkanHapus()}>
                  Urungkan
                </Button>
              </div>
            )}
            {keranjang.length === 0 ? (
              <div className="text-xs text-muted-foreground">Belum ada barang di keranjang.</div>
            ) : (
              <div className="flex flex-col divide-y divide-border rounded-md border border-border">
                {keranjang.map((it) => {
                  const satuan = satuanCache[it.productId] ?? [];
                  const total = totalPokokKeranjang(it.qtySatuan, satuan);
                  return (
                    <div key={it.id} className="flex items-center gap-2 p-3">
                      <button
                        type="button"
                        className="flex-1 text-left"
                        onClick={() => void bukaSuntingBaris(it)}
                      >
                        <div className="font-semibold">{it.nama}</div>
                        <div className="text-xs text-muted-foreground">
                          {ringkasQtySatuan(it.qtySatuan)}
                          {total ? ` · ${total.total} ${total.namaPokok}` : ''}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {it.dari ? LABEL_LOKASI[it.dari as KodeLokasi] : '-'} →{' '}
                          {it.ke ? LABEL_LOKASI[it.ke as KodeLokasi] : '-'}
                        </div>
                      </button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 w-12 shrink-0"
                        aria-label="Hapus dari keranjang"
                        onClick={() => void hapusBaris(it.id)}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {daftar.length > 0 && (
            <div className="space-y-2">
              <Label>Tercatat sesi ini</Label>
              <div className="flex flex-col divide-y divide-border rounded-md border border-border">
                {daftar.slice(0, 30).map((it) => (
                  <div key={it.clientId} className="flex items-center justify-between gap-2 p-3">
                    <div>
                      <div className="font-semibold">{it.muatan.namaSaatItu}</div>
                      <div className="text-xs text-muted-foreground">
                        {ringkasQtySatuan(it.muatan.qtySatuan)} ·{' '}
                        {it.muatan.dari ? LABEL_LOKASI[it.muatan.dari as KodeLokasi] : '-'} →{' '}
                        {it.muatan.ke ? LABEL_LOKASI[it.muatan.ke as KodeLokasi] : '-'}
                      </div>
                      {it.pesan && <div className="text-xs text-destructive">{it.pesan}</div>}
                    </div>
                    <Badge variant="outline" className={KELAS_STATUS_ANTRE[it.status]}>
                      {LABEL_STATUS_ANTRE[it.status]}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tombol kirim ditaruh PALING BAWAH di DOM, bukan di atas keranjang:
              `sticky bottom-0` berhenti menempel begitu posisi aslinya tercapai,
              jadi kalau ia diletakkan sebelum daftar keranjang, di ujung gulir
              tombolnya mendarat di tengah halaman dengan keranjang di bawahnya. */}
          <div className="sticky bottom-0 -mx-4 border-t border-border bg-background p-4">
            <Button
              className="h-12 w-full text-base"
              disabled={keranjang.length === 0}
              onClick={() => void kirimSemua()}
            >
              {teksKirim}
            </Button>
          </div>
        </>
      )}

      <LembarQty
        terbuka={lembarProduk !== null}
        namaProduk={lembarProduk?.nama ?? ''}
        satuan={lembarProduk?.satuan ?? []}
        nilaiAwal={lembarNilaiAwal}
        onSimpan={simpanLembar}
        onBatal={tutupLembar}
      />
    </div>
  );
}
