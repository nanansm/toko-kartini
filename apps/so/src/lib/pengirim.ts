import {
  ambilSiapKirim,
  tandaiTerkirim,
  tandaiGagal,
  tundaKirim,
  hitungMenunggu,
  pangkasTerkirimLama,
} from './antrean';

export interface KeadaanKirim {
  daring: boolean;
  menunggu: number;
  sibuk: boolean;
  sesiHabis: boolean;
  terakhirGalat: string | null;
}

type Pelanggan = (k: KeadaanKirim) => void;

const BATAS_AMBIL = 20;
const JEDA_INTERVAL_MS = 15_000;
const PANGKAS_TIAP_N_PUTARAN = 10;

const pelanggan = new Set<Pelanggan>();

let keadaan: KeadaanKirim = {
  daring: true,
  menunggu: 0,
  sibuk: false,
  sesiHabis: false,
  terakhirGalat: null,
};

// Penghitung rujukan: beberapa komponen boleh panggil mulaiPengirim(),
// listener & interval cuma dipasang sekali sampai pemanggil terakhir berhenti.
let refCount = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;
let penangaOnline: (() => void) | null = null;
let penangaVisibility: (() => void) | null = null;
let penangaLuring: (() => void) | null = null;

// Kunci putaran: dua putaran bersamaan bisa mengirim baris yang sama dua kali.
let sedangJalan = false;
let jalankanLagi = false;
let hitungPutaran = 0;

function beriTahu(): void {
  for (const cb of pelanggan) cb(keadaan);
}

function ubahKeadaan(patch: Partial<KeadaanKirim>): void {
  // Tanpa gerbang ini tiap denyut 15 detik mengirim objek keadaan baru ke React
  // dan seluruh formulir digambar ulang — padahal isinya sama persis. Staf yang
  // sedang mengetik jumlah tidak boleh terganggu detak pengirim latar.
  let berubah = false;
  for (const k of Object.keys(patch) as (keyof KeadaanKirim)[]) {
    if (patch[k] !== keadaan[k]) {
      berubah = true;
      break;
    }
  }
  if (!berubah) return;
  keadaan = { ...keadaan, ...patch };
  beriTahu();
}

export function langgananKirim(cb: Pelanggan): () => void {
  pelanggan.add(cb);
  cb(keadaan);
  return () => {
    pelanggan.delete(cb);
  };
}

interface JawabanCatat {
  ok: boolean;
  diterima?: string[];
  duplikat?: string[];
  tertunda?: string[];
  ditolak?: { clientId: string; pesan: string }[];
  pesan?: string;
}

function isJawabanCatat(v: unknown): v is JawabanCatat {
  if (typeof v !== 'object' || v === null) return false;
  return typeof (v as Record<string, unknown>).ok === 'boolean';
}

async function satuPutaran(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    ubahKeadaan({ daring: false });
    return false;
  }
  ubahKeadaan({ daring: true });

  const item = await ambilSiapKirim(Date.now(), BATAS_AMBIL);
  if (item.length === 0) return false;
  ubahKeadaan({ sibuk: true });

  let res: Response;
  try {
    // `/api/mutasi`, bukan `/api/catat`: yang pertama masuk DO `Buku` lalu
    // diunggah ke tab `Mutasi` milik tim -- buku besar yang dibaca semua
    // hitungan hilir. `/api/catat` menulis buku besar kedua (Log_YYYY-MM di
    // spreadsheet kita sendiri) yang tidak dibaca satu pun hitungan itu.
    res = await fetch('/api/mutasi', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ baris: item.map((it) => it.muatan) }),
    });
  } catch {
    // luring / sinyal putus di tengah — semua ditunda, dicoba lagi nanti
    for (const it of item) await tundaKirim(it.clientId, 'Jaringan terputus');
    ubahKeadaan({ terakhirGalat: 'Jaringan terputus' });
    return false;
  }

  if (res.status === 401) {
    // Barisnya masih sah, orangnya cuma perlu masuk lagi — jangan tandaiGagal.
    ubahKeadaan({ sesiHabis: true, terakhirGalat: 'Sesi berakhir, masuk lagi.' });
    for (const it of item) await tundaKirim(it.clientId, 'Sesi berakhir, masuk lagi.');
    return false;
  }
  // Server tersentuh (status apa pun selain 401) — sesi dianggap masih hidup.
  ubahKeadaan({ sesiHabis: false });

  const contentType = res.headers.get('content-type') ?? '';
  let body: unknown = null;
  if (contentType.includes('application/json')) {
    try {
      body = await res.json();
    } catch {
      body = null;
    }
  }

  if (!isJawabanCatat(body)) {
    // 302/HTML muncul saat sesi/gerbang kedaluwarsa — kalau ini dianggap
    // sukses, barisnya terbuang tanpa pernah sampai ke spreadsheet.
    const pesan = 'jawaban server tidak dikenali';
    for (const it of item) await tundaKirim(it.clientId, pesan);
    ubahKeadaan({ terakhirGalat: pesan });
    return false;
  }

  if (res.status === 400) {
    // 400 berarti ditolak permanen — yang disebut di `ditolak` tidak diulang.
    const ditolakMap = new Map((body.ditolak ?? []).map((d) => [d.clientId, d.pesan]));
    for (const it of item) {
      const pesanTolak = ditolakMap.get(it.clientId);
      if (pesanTolak !== undefined) {
        await tandaiGagal(it.clientId, pesanTolak);
      } else {
        await tundaKirim(it.clientId, body.pesan ?? 'Ditolak server');
      }
    }
    ubahKeadaan({ terakhirGalat: body.pesan ?? 'Sebagian baris ditolak' });
    return false;
  }

  if (res.status >= 500) {
    const pesan = body.pesan ?? 'Server bermasalah, dicoba lagi';
    for (const it of item) await tundaKirim(it.clientId, pesan);
    ubahKeadaan({ terakhirGalat: pesan });
    return false;
  }

  if (res.status !== 200) {
    // Status di luar 200/400/401/5xx (mis. 403) — jangan diasumsikan sukses.
    const pesan = body.pesan ?? `Status ${res.status} tak dikenal`;
    for (const it of item) await tundaKirim(it.clientId, pesan);
    ubahKeadaan({ terakhirGalat: pesan });
    return false;
  }

  const diterima = new Set(body.diterima ?? []);
  const duplikat = new Set(body.duplikat ?? []);
  const tertunda = new Set(body.tertunda ?? []);
  const ditolakMap = new Map((body.ditolak ?? []).map((d) => [d.clientId, d.pesan]));

  for (const it of item) {
    if (diterima.has(it.clientId) || duplikat.has(it.clientId)) {
      await tandaiTerkirim(it.clientId);
    } else if (tertunda.has(it.clientId)) {
      await tundaKirim(it.clientId, 'Tertunda di server');
    } else if (ditolakMap.has(it.clientId)) {
      await tandaiGagal(it.clientId, ditolakMap.get(it.clientId) ?? 'Ditolak');
    } else {
      // clientId tidak disebut di daftar mana pun — jangan diasumsikan sukses.
      await tundaKirim(it.clientId, 'Tidak dikonfirmasi server');
    }
  }
  ubahKeadaan({ terakhirGalat: null });
  // Batch penuh berarti kemungkinan masih ada sisa. Kirim lagi sekarang, jangan
  // menunggu denyut 15 detik — 100 baris tertimbun akan makan lebih dari semenit.
  return item.length === BATAS_AMBIL;
}

async function jalankanPutaran(): Promise<void> {
  if (sedangJalan) {
    jalankanLagi = true;
    return;
  }
  sedangJalan = true;
  try {
    if (await satuPutaran()) jalankanLagi = true;
  } catch {
    // Tidak satu pun fungsi boleh melempar keluar dari pengirim latar.
  } finally {
    hitungPutaran += 1;
    if (hitungPutaran % PANGKAS_TIAP_N_PUTARAN === 0) {
      try {
        await pangkasTerkirimLama();
      } catch {
        // diam — pemangkasan gagal tidak fatal
      }
    }
    let menunggu = keadaan.menunggu;
    try {
      menunggu = await hitungMenunggu();
    } catch {
      // pertahankan angka lama kalau gagal dihitung ulang
    }
    sedangJalan = false;
    ubahKeadaan({ sibuk: false, menunggu });
    if (jalankanLagi) {
      jalankanLagi = false;
      void jalankanPutaran();
    }
  }
}

export function picuKirim(): void {
  void jalankanPutaran();
}

export function mulaiPengirim(): () => void {
  refCount += 1;
  if (refCount === 1) {
    penangaOnline = () => {
      ubahKeadaan({ daring: true });
      picuKirim();
    };
    penangaVisibility = () => {
      if (document.visibilityState === 'visible') picuKirim();
    };
    // Tanpa penanganan `offline`, lencana "Luring" baru muncul di denyut 15 detik
    // berikutnya — staf sempat menyimpan beberapa baris sambil mengira terkirim.
    penangaLuring = () => {
      ubahKeadaan({ daring: false });
    };
    window.addEventListener('offline', penangaLuring);
    window.addEventListener('online', penangaOnline);
    document.addEventListener('visibilitychange', penangaVisibility);
    intervalId = setInterval(picuKirim, JEDA_INTERVAL_MS);
    picuKirim();
  }

  let sudahBerhenti = false;
  return () => {
    if (sudahBerhenti) return;
    sudahBerhenti = true;
    refCount -= 1;
    if (refCount <= 0) {
      refCount = 0;
      if (penangaOnline) window.removeEventListener('online', penangaOnline);
      if (penangaLuring) window.removeEventListener('offline', penangaLuring);
      if (penangaVisibility) document.removeEventListener('visibilitychange', penangaVisibility);
      if (intervalId !== null) clearInterval(intervalId);
      penangaOnline = null;
      penangaVisibility = null;
      penangaLuring = null;
      intervalId = null;
    }
  };
}
