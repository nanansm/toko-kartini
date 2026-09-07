// Hash & verifikasi PIN staf gudang (6 digit) — Cloudflare Workers, WebCrypto saja.

export const PBKDF2_ITERASI_BAKU = 100_000;

export interface HasilHashPin {
  hash: string; // base64
  garam: string; // base64
  iterasi: number;
}

function ambilPepper(): string {
  // Pepper wajib: ruang PIN 6 digit cuma sejuta kombinasi. Kalau spreadsheet
  // (berisi hash+garam) bocor, pepper adalah satu-satunya rahasia yang tidak
  // ikut bocor — ia cuma hidup sebagai secret Worker, tidak pernah ditulis.
  const pepper = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.PIN_PEPPER;
  if (!pepper) {
    throw new Error('PIN_PEPPER tidak diset');
  }
  return pepper;
}

function bytesKeBase64(bytes: Uint8Array): string {
  let biner = '';
  for (const b of bytes) {
    biner += String.fromCharCode(b);
  }
  return btoa(biner);
}

function base64KeBytes(base64: string): Uint8Array<ArrayBuffer> {
  const biner = atob(base64);
  const bytes = new Uint8Array(biner.length);
  for (let i = 0; i < biner.length; i++) {
    bytes[i] = biner.charCodeAt(i);
  }
  return bytes;
}

async function turunkanKunci(
  pin: string,
  garam: Uint8Array<ArrayBuffer>,
  iterasi: number
): Promise<Uint8Array> {
  const pepper = ambilPepper();
  const bahan = new TextEncoder().encode(pin + pepper);
  const kunciMentah = await crypto.subtle.importKey(
    'raw',
    bahan,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bitTurunan = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: garam,
      iterations: iterasi,
      hash: 'SHA-256',
    },
    kunciMentah,
    256
  );
  return new Uint8Array(bitTurunan);
}

export async function hashPin(
  pin: string,
  iterasi: number = PBKDF2_ITERASI_BAKU
): Promise<HasilHashPin> {
  const garam = crypto.getRandomValues(new Uint8Array(16));
  const hash = await turunkanKunci(pin, garam, iterasi);
  return {
    hash: bytesKeBase64(hash),
    garam: bytesKeBase64(garam),
    iterasi,
  };
}

function samaWaktuTetap(a: Uint8Array, b: Uint8Array): boolean {
  // Bandingkan SELURUH byte tanpa short-circuit — kalau berhenti di byte
  // pertama yang beda, durasi respons bocorkan posisi ketidakcocokan (timing attack).
  if (a.length !== b.length) return false;
  let selisih = 0;
  for (let i = 0; i < a.length; i++) {
    selisih |= (a[i] as number) ^ (b[i] as number);
  }
  return selisih === 0;
}

export async function verifikasiPin(
  pin: string,
  tersimpan: { hash: string; garam: string; iterasi: number }
): Promise<boolean> {
  // Pepper hilang = salah pasang, bukan PIN salah. Diperiksa di LUAR try supaya
  // gagal dengan berisik, bukan menyamar jadi "PIN salah" untuk semua orang.
  ambilPepper();
  try {
    if (!tersimpan.hash || !tersimpan.garam || !(tersimpan.iterasi > 0)) {
      return false;
    }
    const garam = base64KeBytes(tersimpan.garam);
    const hashTersimpan = base64KeBytes(tersimpan.hash);
    // Iterasi WAJIB dari data tersimpan (bukan PBKDF2_ITERASI_BAKU) supaya
    // angka baku bisa dinaikkan nanti tanpa mengunci pengguna dengan hash lama.
    const hashHitung = await turunkanKunci(pin, garam, tersimpan.iterasi);
    return samaWaktuTetap(hashHitung, hashTersimpan);
  } catch {
    // Masukan cacat (base64 tak sah dll) → false, bukan lempar galat, supaya
    // jalur login tidak bisa membedakan "akun tidak ada" dari "format rusak".
    return false;
  }
}
