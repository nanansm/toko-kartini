import { DurableObject } from "cloudflare:workers";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface SatuanQty {
  sku: string;
  nama: string;
  pengali: number;
  qty: number;
}

interface EntriMasuk {
  clientId: string;
  pengguna: string;
  rak: string;
  productId: string;
  namaProduk: string;
  satuan: SatuanQty[];
  expired: string | null;
}

interface MutasiMasuk {
  clientId: string;
  pengguna: string;
  jenis: string;
  dari: string;
  ke: string;
  nota: string;
  sebab: string;
  productId: string;
  namaProduk: string;
  satuan: SatuanQty[];
}

interface ClientIdBody {
  clientId: string;
}

interface EntriRow {
  id: number;
  client_id: string;
  dibuat: string;
  diubah: string;
  pengguna: string;
  rak: string;
  product_id: string;
  nama_produk: string;
  satuan: string;
  qty_total: number;
  expired: string | null;
  diunggah: string | null;
}

interface MutasiRow {
  id: number;
  client_id: string;
  dibuat: string;
  diubah: string;
  pengguna: string;
  jenis: string;
  dari: string;
  ke: string;
  nota: string;
  sebab: string;
  product_id: string;
  nama_produk: string;
  satuan: string;
  qty_total: number;
  diunggah: string | null;
}

function isSatuanQty(value: unknown): value is SatuanQty {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  if (typeof r.sku !== "string") return false;
  if (typeof r.nama !== "string") return false;
  if (typeof r.pengali !== "number" || !Number.isFinite(r.pengali)) return false;
  if (typeof r.qty !== "number" || !Number.isFinite(r.qty)) return false;
  return true;
}

function isSatuanArray(value: unknown): value is SatuanQty[] {
  return Array.isArray(value) && value.every(isSatuanQty);
}

function isEntriMasuk(value: unknown): value is EntriMasuk {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  if (typeof r.clientId !== "string" || r.clientId.length === 0) return false;
  if (typeof r.pengguna !== "string" || r.pengguna.length === 0) return false;
  if (typeof r.rak !== "string" || r.rak.length === 0) return false;
  if (typeof r.productId !== "string" || r.productId.length === 0) return false;
  if (typeof r.namaProduk !== "string") return false;
  if (!isSatuanArray(r.satuan)) return false;
  if (r.expired !== null && typeof r.expired !== "string") return false;
  return true;
}

function isMutasiMasuk(value: unknown): value is MutasiMasuk {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  if (typeof r.clientId !== "string" || r.clientId.length === 0) return false;
  if (typeof r.pengguna !== "string" || r.pengguna.length === 0) return false;
  if (typeof r.jenis !== "string") return false;
  if (typeof r.dari !== "string" || r.dari.length === 0) return false;
  if (typeof r.ke !== "string" || r.ke.length === 0) return false;
  if (typeof r.nota !== "string") return false;
  if (typeof r.sebab !== "string") return false;
  if (typeof r.productId !== "string" || r.productId.length === 0) return false;
  if (typeof r.namaProduk !== "string") return false;
  if (!isSatuanArray(r.satuan)) return false;
  return true;
}

function isClientIdBody(value: unknown): value is ClientIdBody {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return typeof r.clientId === "string" && r.clientId.length > 0;
}

interface RakPenggunaBody {
  rak: string;
  pengguna: string;
}

function isRakPenggunaBody(value: unknown): value is RakPenggunaBody {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.rak === "string" && r.rak.length > 0 &&
    typeof r.pengguna === "string" && r.pengguna.length > 0
  );
}

interface DariKePenggunaBody {
  dari: string;
  ke: string;
  pengguna: string;
}

function isDariKePenggunaBody(value: unknown): value is DariKePenggunaBody {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.dari === "string" && r.dari.length > 0 &&
    typeof r.ke === "string" && r.ke.length > 0 &&
    typeof r.pengguna === "string" && r.pengguna.length > 0
  );
}

interface IdsBody {
  ids: number[];
}

function isIdsBody(value: unknown): value is IdsBody {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return Array.isArray(r.ids) && r.ids.every((x) => Number.isInteger(x));
}

// qtyTotal dihitung di sini, bukan diterima dari klien -- angka yang masuk
// buku besar tidak boleh berasal dari sisi yang bisa dimodifikasi pengguna.
function hitungQtyTotal(satuan: SatuanQty[]): number {
  return satuan.reduce((jumlah, s) => jumlah + s.qty * s.pengali, 0);
}

const RUTE: Record<string, "GET" | "POST"> = {
  "/entri/simpan": "POST",
  "/entri/hapus": "POST",
  "/entri/daftar": "GET",
  "/entri/klaim": "POST",
  "/entri/batalklaim": "POST",
  "/mutasi/simpan": "POST",
  "/mutasi/hapus": "POST",
  "/mutasi/daftar": "GET",
  "/mutasi/klaim": "POST",
  "/mutasi/batalklaim": "POST",
  "/mutasi/sering": "GET",
  "/keadaan": "GET",
};

export class Buku extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS entri (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id TEXT NOT NULL UNIQUE,
        dibuat TEXT NOT NULL,
        diubah TEXT NOT NULL,
        pengguna TEXT NOT NULL,
        rak TEXT NOT NULL,
        product_id TEXT NOT NULL,
        nama_produk TEXT NOT NULL,
        satuan TEXT NOT NULL,
        qty_total REAL NOT NULL,
        expired TEXT,
        diunggah TEXT
      )
    `);
    // Satu baris terbuka per (rak, produk, orang) -- meniru aplikasi tim:
    // hitungan kedua untuk kombinasi yang sama menimpa yang lama, bukan
    // menumpuk jadi dua baris terbuka yang saling membingungkan saat upload.
    this.ctx.storage.sql.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS entri_terbuka
        ON entri (rak, product_id, pengguna) WHERE diunggah IS NULL
    `);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS mutasi (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id TEXT NOT NULL UNIQUE,
        dibuat TEXT NOT NULL,
        diubah TEXT NOT NULL,
        pengguna TEXT NOT NULL,
        jenis TEXT NOT NULL,
        dari TEXT NOT NULL,
        ke TEXT NOT NULL,
        nota TEXT NOT NULL DEFAULT '',
        sebab TEXT NOT NULL DEFAULT '',
        product_id TEXT NOT NULL,
        nama_produk TEXT NOT NULL,
        satuan TEXT NOT NULL,
        qty_total REAL NOT NULL,
        diunggah TEXT
      )
    `);
    // Sama alasannya dengan entri_terbuka: satu mutasi terbuka per rute
    // (dari, ke, produk) per orang.
    this.ctx.storage.sql.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS mutasi_terbuka
        ON mutasi (dari, ke, product_id, pengguna) WHERE diunggah IS NULL
    `);
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const metodeWajib = RUTE[url.pathname];

    if (metodeWajib === undefined) {
      return jsonResponse({ ok: false, pesan: "rute tidak dikenal" }, 404);
    }
    if (request.method !== metodeWajib) {
      return jsonResponse({ ok: false, pesan: "metode tidak didukung" }, 405);
    }

    if (url.pathname === "/keadaan") {
      return this.handleKeadaan();
    }
    if (url.pathname === "/entri/daftar") {
      return this.handleEntriDaftar(url);
    }
    if (url.pathname === "/mutasi/daftar") {
      return this.handleMutasiDaftar(url);
    }
    if (url.pathname === "/mutasi/sering") {
      return this.handleMutasiSering(url);
    }

    let parsed: unknown;
    try {
      parsed = await request.json();
    } catch {
      return jsonResponse({ ok: false, pesan: "badan bukan JSON sah" }, 400);
    }

    if (url.pathname === "/entri/simpan") return this.handleEntriSimpan(parsed);
    if (url.pathname === "/entri/hapus") return this.handleEntriHapus(parsed);
    if (url.pathname === "/entri/klaim") return this.handleEntriKlaim(parsed);
    if (url.pathname === "/entri/batalklaim") return this.handleEntriBatalKlaim(parsed);
    if (url.pathname === "/mutasi/simpan") return this.handleMutasiSimpan(parsed);
    if (url.pathname === "/mutasi/hapus") return this.handleMutasiHapus(parsed);
    if (url.pathname === "/mutasi/klaim") return this.handleMutasiKlaim(parsed);
    if (url.pathname === "/mutasi/batalklaim") return this.handleMutasiBatalKlaim(parsed);

    return jsonResponse({ ok: false, pesan: "rute tidak dikenal" }, 404);
  }

  private handleEntriSimpan(parsed: unknown): Response {
    if (!isEntriMasuk(parsed)) {
      return jsonResponse(
        { ok: false, pesan: "badan entri tidak sah: clientId, pengguna, rak, productId, namaProduk, satuan, expired wajib ada" },
        400,
      );
    }

    const qtyTotal = hitungQtyTotal(parsed.satuan);
    const satuanJson = JSON.stringify(parsed.satuan);
    const sekarang = new Date().toISOString();

    const samaClientId = this.ctx.storage.sql
      .exec("SELECT id, diunggah FROM entri WHERE client_id = ?", parsed.clientId)
      .toArray()[0] as { id: number; diunggah: string | null } | undefined;

    if (samaClientId !== undefined) {
      // Sudah terunggah: jawab SUKSES, bukan galat. Baris ini cuma sampai ke
      // sini lewat kiriman ulang antrean HP yang jawabannya hilang di jalan;
      // kalau dijawab 400, pengirim latar menghitungnya gagal dan mencoba
      // selamanya. Isinya sengaja tidak diperbarui — yang sudah masuk buku
      // besar tidak boleh berubah dari HP.
      if (samaClientId.diunggah !== null) {
        return jsonResponse(
          { ok: true, id: samaClientId.id, qtyTotal, ditimpa: false, sudahDiunggah: true },
          200,
        );
      }
      this.ctx.storage.sql.exec(
        "UPDATE entri SET diubah = ?, pengguna = ?, rak = ?, product_id = ?, nama_produk = ?, satuan = ?, qty_total = ?, expired = ? WHERE id = ?",
        sekarang,
        parsed.pengguna,
        parsed.rak,
        parsed.productId,
        parsed.namaProduk,
        satuanJson,
        qtyTotal,
        parsed.expired,
        samaClientId.id,
      );
      return jsonResponse({ ok: true, id: samaClientId.id, qtyTotal, ditimpa: false }, 200);
    }

    // Baris terbuka lain untuk rak+produk+pengguna yang sama -- itu yang
    // ditimpa (client_id-nya diganti ke yang baru), bukan menumpuk.
    const terbukaLain = this.ctx.storage.sql
      .exec(
        "SELECT id FROM entri WHERE rak = ? AND product_id = ? AND pengguna = ? AND diunggah IS NULL",
        parsed.rak,
        parsed.productId,
        parsed.pengguna,
      )
      .toArray()[0] as { id: number } | undefined;

    if (terbukaLain !== undefined) {
      this.ctx.storage.sql.exec(
        "UPDATE entri SET client_id = ?, dibuat = ?, diubah = ?, nama_produk = ?, satuan = ?, qty_total = ?, expired = ? WHERE id = ?",
        parsed.clientId,
        sekarang,
        sekarang,
        parsed.namaProduk,
        satuanJson,
        qtyTotal,
        parsed.expired,
        terbukaLain.id,
      );
      return jsonResponse({ ok: true, id: terbukaLain.id, qtyTotal, ditimpa: true }, 200);
    }

    this.ctx.storage.sql.exec(
      "INSERT INTO entri (client_id, dibuat, diubah, pengguna, rak, product_id, nama_produk, satuan, qty_total, expired, diunggah) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)",
      parsed.clientId,
      sekarang,
      sekarang,
      parsed.pengguna,
      parsed.rak,
      parsed.productId,
      parsed.namaProduk,
      satuanJson,
      qtyTotal,
      parsed.expired,
    );
    const id = this.ctx.storage.sql.exec("SELECT last_insert_rowid() AS id").toArray()[0] as { id: number };
    return jsonResponse({ ok: true, id: id.id, qtyTotal, ditimpa: false }, 200);
  }

  private handleEntriHapus(parsed: unknown): Response {
    if (!isClientIdBody(parsed)) {
      return jsonResponse({ ok: false, pesan: "clientId wajib ada" }, 400);
    }
    const cursor = this.ctx.storage.sql.exec(
      "DELETE FROM entri WHERE client_id = ? AND diunggah IS NULL",
      parsed.clientId,
    );
    return jsonResponse({ ok: true, terhapus: cursor.rowsWritten }, 200);
  }

  private handleEntriDaftar(url: URL): Response {
    const rak = url.searchParams.get("rak");
    if (!rak) {
      return jsonResponse({ ok: false, pesan: "rak wajib diisi" }, 400);
    }
    const pengguna = url.searchParams.get("pengguna");

    const baris = this.ctx.storage.sql
      .exec("SELECT * FROM entri WHERE rak = ? AND diunggah IS NULL", rak)
      .toArray() as unknown as EntriRow[];
    const diurai = baris.map((b) => ({ ...b, satuan: JSON.parse(b.satuan) }));

    const milik = pengguna ? diurai.filter((b) => b.pengguna === pengguna) : [];
    const lain = pengguna ? diurai.filter((b) => b.pengguna !== pengguna) : diurai;

    return jsonResponse({ ok: true, milik, lain }, 200);
  }

  // Klaim tidak menulis ke Sheets -- itu tugas pemanggil (route Next.js).
  // DO ini satu-utas, jadi SELECT lalu UPDATE di sini tidak bisa disela
  // pemanggilan lain: dua HP yang menekan Kirim berbarengan tidak akan
  // mengklaim baris yang sama.
  private handleEntriKlaim(parsed: unknown): Response {
    if (!isRakPenggunaBody(parsed)) {
      return jsonResponse({ ok: false, pesan: "rak dan pengguna wajib diisi" }, 400);
    }

    const baris = this.ctx.storage.sql
      .exec(
        "SELECT * FROM entri WHERE rak = ? AND pengguna = ? AND diunggah IS NULL",
        parsed.rak,
        parsed.pengguna,
      )
      .toArray() as unknown as EntriRow[];

    if (baris.length === 0) {
      return jsonResponse({ ok: true, ids: [], baris: [] }, 200);
    }

    const sekarang = new Date().toISOString();
    this.ctx.storage.sql.exec(
      "UPDATE entri SET diunggah = ? WHERE rak = ? AND pengguna = ? AND diunggah IS NULL",
      sekarang,
      parsed.rak,
      parsed.pengguna,
    );

    const diurai = baris.map((b) => ({ ...b, satuan: JSON.parse(b.satuan) }));
    return jsonResponse({ ok: true, ids: baris.map((b) => b.id), baris: diurai }, 200);
  }

  // Pembatalan klaim WAJIB berhasil dikembalikan sebisa mungkin: baris yang
  // telanjur diklaim tapi gagal ditulis ke Sheets akan hilang dari layar
  // staf selamanya kalau tidak dikembalikan -- tidak muncul lagi di daftar
  // terbuka, tidak juga sempat masuk ke spreadsheet.
  private handleEntriBatalKlaim(parsed: unknown): Response {
    if (!isIdsBody(parsed)) {
      return jsonResponse({ ok: false, pesan: "ids wajib berupa larik bilangan bulat" }, 400);
    }
    if (parsed.ids.length === 0) {
      return jsonResponse({ ok: true, dibatalkan: 0 }, 200);
    }

    const penampung = parsed.ids.map(() => "?").join(",");
    try {
      // Jalur cepat: semua id dalam satu UPDATE. Cuma gagal kalau salah satu
      // id bentrok dengan indeks unik entri_terbuka (rak+produk+pengguna
      // sudah dicatat ulang sejak diklaim).
      const cursor = this.ctx.storage.sql.exec(
        `UPDATE entri SET diunggah = NULL WHERE id IN (${penampung})`,
        ...parsed.ids,
      );
      return jsonResponse({ ok: true, dibatalkan: cursor.rowsWritten }, 200);
    } catch {
      // Jalur lambat: ulangi satu per satu supaya id yang tidak bentrok
      // tetap kembali, dan id yang bentrok dikumpulkan sebagai gagal
      // (baris itu tidak bisa dikembalikan tanpa melanggar unik terbuka).
      let dibatalkan = 0;
      const gagal: number[] = [];
      for (const id of parsed.ids) {
        try {
          const cursor = this.ctx.storage.sql.exec(
            "UPDATE entri SET diunggah = NULL WHERE id = ?",
            id,
          );
          dibatalkan += cursor.rowsWritten;
        } catch {
          gagal.push(id);
        }
      }
      return jsonResponse({ ok: true, dibatalkan, gagal }, 200);
    }
  }

  private handleMutasiSimpan(parsed: unknown): Response {
    if (!isMutasiMasuk(parsed)) {
      return jsonResponse(
        {
          ok: false,
          pesan: "badan mutasi tidak sah: clientId, pengguna, jenis, dari, ke, nota, sebab, productId, namaProduk, satuan wajib ada",
        },
        400,
      );
    }

    const qtyTotal = hitungQtyTotal(parsed.satuan);
    const satuanJson = JSON.stringify(parsed.satuan);
    const sekarang = new Date().toISOString();

    const samaClientId = this.ctx.storage.sql
      .exec("SELECT id, diunggah FROM mutasi WHERE client_id = ?", parsed.clientId)
      .toArray()[0] as { id: number; diunggah: string | null } | undefined;

    if (samaClientId !== undefined) {
      // Sudah terunggah: jawab SUKSES, bukan galat. Baris ini cuma sampai ke
      // sini lewat kiriman ulang antrean HP yang jawabannya hilang di jalan;
      // kalau dijawab 400, pengirim latar menghitungnya gagal dan mencoba
      // selamanya. Isinya sengaja tidak diperbarui — yang sudah masuk buku
      // besar tidak boleh berubah dari HP.
      if (samaClientId.diunggah !== null) {
        return jsonResponse(
          { ok: true, id: samaClientId.id, qtyTotal, ditimpa: false, sudahDiunggah: true },
          200,
        );
      }
      this.ctx.storage.sql.exec(
        "UPDATE mutasi SET diubah = ?, pengguna = ?, jenis = ?, dari = ?, ke = ?, nota = ?, sebab = ?, product_id = ?, nama_produk = ?, satuan = ?, qty_total = ? WHERE id = ?",
        sekarang,
        parsed.pengguna,
        parsed.jenis,
        parsed.dari,
        parsed.ke,
        parsed.nota,
        parsed.sebab,
        parsed.productId,
        parsed.namaProduk,
        satuanJson,
        qtyTotal,
        samaClientId.id,
      );
      return jsonResponse({ ok: true, id: samaClientId.id, qtyTotal, ditimpa: false }, 200);
    }

    const terbukaLain = this.ctx.storage.sql
      .exec(
        "SELECT id FROM mutasi WHERE dari = ? AND ke = ? AND product_id = ? AND pengguna = ? AND diunggah IS NULL",
        parsed.dari,
        parsed.ke,
        parsed.productId,
        parsed.pengguna,
      )
      .toArray()[0] as { id: number } | undefined;

    if (terbukaLain !== undefined) {
      this.ctx.storage.sql.exec(
        "UPDATE mutasi SET client_id = ?, dibuat = ?, diubah = ?, jenis = ?, nota = ?, sebab = ?, nama_produk = ?, satuan = ?, qty_total = ? WHERE id = ?",
        parsed.clientId,
        sekarang,
        sekarang,
        parsed.jenis,
        parsed.nota,
        parsed.sebab,
        parsed.namaProduk,
        satuanJson,
        qtyTotal,
        terbukaLain.id,
      );
      return jsonResponse({ ok: true, id: terbukaLain.id, qtyTotal, ditimpa: true }, 200);
    }

    this.ctx.storage.sql.exec(
      "INSERT INTO mutasi (client_id, dibuat, diubah, pengguna, jenis, dari, ke, nota, sebab, product_id, nama_produk, satuan, qty_total, diunggah) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)",
      parsed.clientId,
      sekarang,
      sekarang,
      parsed.pengguna,
      parsed.jenis,
      parsed.dari,
      parsed.ke,
      parsed.nota,
      parsed.sebab,
      parsed.productId,
      parsed.namaProduk,
      satuanJson,
      qtyTotal,
    );
    const id = this.ctx.storage.sql.exec("SELECT last_insert_rowid() AS id").toArray()[0] as { id: number };
    return jsonResponse({ ok: true, id: id.id, qtyTotal, ditimpa: false }, 200);
  }

  private handleMutasiHapus(parsed: unknown): Response {
    if (!isClientIdBody(parsed)) {
      return jsonResponse({ ok: false, pesan: "clientId wajib ada" }, 400);
    }
    const cursor = this.ctx.storage.sql.exec(
      "DELETE FROM mutasi WHERE client_id = ? AND diunggah IS NULL",
      parsed.clientId,
    );
    return jsonResponse({ ok: true, terhapus: cursor.rowsWritten }, 200);
  }

  private handleMutasiDaftar(url: URL): Response {
    const dari = url.searchParams.get("dari");
    const ke = url.searchParams.get("ke");
    if (!dari || !ke) {
      return jsonResponse({ ok: false, pesan: "dari dan ke wajib diisi" }, 400);
    }
    const pengguna = url.searchParams.get("pengguna");

    const baris = this.ctx.storage.sql
      .exec("SELECT * FROM mutasi WHERE dari = ? AND ke = ? AND diunggah IS NULL", dari, ke)
      .toArray() as unknown as MutasiRow[];
    const diurai = baris.map((b) => ({ ...b, satuan: JSON.parse(b.satuan) }));

    const milik = pengguna ? diurai.filter((b) => b.pengguna === pengguna) : diurai;

    return jsonResponse({ ok: true, milik }, 200);
  }

  // Barang "sering dipakai" dihitung dari BANYAKNYA KEJADIAN (COUNT baris),
  // bukan jumlah qty -- barang yang diisi ulang tiap hari sedikit-sedikit
  // (misalnya display) lebih layak muncul di daftar cepat daripada satu
  // kiriman besar yang cuma terjadi sekali. Riwayat yang sudah diunggah tetap
  // ikut dihitung karena baris mutasi tidak pernah dihapus setelah unggah.
  private handleMutasiSering(url: URL): Response {
    const jenis = url.searchParams.get("jenis");
    if (!jenis) {
      return jsonResponse({ ok: false, pesan: "jenis wajib diisi" }, 400);
    }

    const hariMentah = url.searchParams.get("hari");
    let hari = 30;
    if (hariMentah !== null) {
      const angka = Number(hariMentah);
      if (!Number.isFinite(angka) || !Number.isInteger(angka) || angka <= 0) {
        return jsonResponse({ ok: false, pesan: "hari wajib bilangan bulat positif" }, 400);
      }
      hari = angka;
    }

    const batasMentah = url.searchParams.get("batas");
    let batas = 8;
    if (batasMentah !== null) {
      const angka = Number(batasMentah);
      if (!Number.isFinite(angka) || !Number.isInteger(angka) || angka <= 0) {
        return jsonResponse({ ok: false, pesan: "batas wajib bilangan bulat positif" }, 400);
      }
      batas = angka;
    }

    const ambang = new Date(Date.now() - hari * 86400000).toISOString();

    const baris = this.ctx.storage.sql
      .exec(
        `SELECT product_id, nama_produk, COUNT(*) AS jumlah
         FROM mutasi
         WHERE jenis = ? AND dibuat >= ?
         GROUP BY product_id
         ORDER BY jumlah DESC
         LIMIT ?`,
        jenis,
        ambang,
        batas,
      )
      .toArray() as unknown as { product_id: string; nama_produk: string; jumlah: number }[];

    const produk = baris.map((b) => ({
      productId: b.product_id,
      namaProduk: b.nama_produk,
      jumlah: b.jumlah,
    }));

    return jsonResponse({ ok: true, produk }, 200);
  }

  // Sama alasannya dengan handleEntriKlaim: SELECT lalu UPDATE tidak bisa
  // disela dalam DO satu-utas ini, jadi klaim aman dari tabrakan dua HP.
  private handleMutasiKlaim(parsed: unknown): Response {
    if (!isDariKePenggunaBody(parsed)) {
      return jsonResponse({ ok: false, pesan: "dari, ke, dan pengguna wajib diisi" }, 400);
    }

    const baris = this.ctx.storage.sql
      .exec(
        "SELECT * FROM mutasi WHERE dari = ? AND ke = ? AND pengguna = ? AND diunggah IS NULL",
        parsed.dari,
        parsed.ke,
        parsed.pengguna,
      )
      .toArray() as unknown as MutasiRow[];

    if (baris.length === 0) {
      return jsonResponse({ ok: true, ids: [], baris: [] }, 200);
    }

    const sekarang = new Date().toISOString();
    this.ctx.storage.sql.exec(
      "UPDATE mutasi SET diunggah = ? WHERE dari = ? AND ke = ? AND pengguna = ? AND diunggah IS NULL",
      sekarang,
      parsed.dari,
      parsed.ke,
      parsed.pengguna,
    );

    const diurai = baris.map((b) => ({ ...b, satuan: JSON.parse(b.satuan) }));
    return jsonResponse({ ok: true, ids: baris.map((b) => b.id), baris: diurai }, 200);
  }

  // Pembatalan klaim WAJIB berhasil dikembalikan sebisa mungkin, sama
  // alasannya dengan handleEntriBatalKlaim: baris yang gagal ditulis ke
  // Sheets tidak boleh hilang dari layar staf selamanya.
  private handleMutasiBatalKlaim(parsed: unknown): Response {
    if (!isIdsBody(parsed)) {
      return jsonResponse({ ok: false, pesan: "ids wajib berupa larik bilangan bulat" }, 400);
    }
    if (parsed.ids.length === 0) {
      return jsonResponse({ ok: true, dibatalkan: 0 }, 200);
    }

    const penampung = parsed.ids.map(() => "?").join(",");
    try {
      // Jalur cepat: satu UPDATE untuk semua id. Gagal kalau ada id yang
      // bentrok dengan indeks unik mutasi_terbuka (dari+ke+produk+pengguna
      // sudah dicatat ulang sejak diklaim).
      const cursor = this.ctx.storage.sql.exec(
        `UPDATE mutasi SET diunggah = NULL WHERE id IN (${penampung})`,
        ...parsed.ids,
      );
      return jsonResponse({ ok: true, dibatalkan: cursor.rowsWritten }, 200);
    } catch {
      // Jalur lambat: ulangi satu per satu supaya id yang tidak bentrok
      // tetap kembali, id yang bentrok masuk daftar gagal.
      let dibatalkan = 0;
      const gagal: number[] = [];
      for (const id of parsed.ids) {
        try {
          const cursor = this.ctx.storage.sql.exec(
            "UPDATE mutasi SET diunggah = NULL WHERE id = ?",
            id,
          );
          dibatalkan += cursor.rowsWritten;
        } catch {
          gagal.push(id);
        }
      }
      return jsonResponse({ ok: true, dibatalkan, gagal }, 200);
    }
  }

  private handleKeadaan(): Response {
    const entriTerbuka = this.ctx.storage.sql
      .exec("SELECT COUNT(*) AS jumlah FROM entri WHERE diunggah IS NULL")
      .toArray()[0] as { jumlah: number } | undefined;
    const mutasiTerbuka = this.ctx.storage.sql
      .exec("SELECT COUNT(*) AS jumlah FROM mutasi WHERE diunggah IS NULL")
      .toArray()[0] as { jumlah: number } | undefined;

    return jsonResponse(
      { ok: true, entriTerbuka: entriTerbuka?.jumlah ?? 0, mutasiTerbuka: mutasiTerbuka?.jumlah ?? 0 },
      200,
    );
  }
}
