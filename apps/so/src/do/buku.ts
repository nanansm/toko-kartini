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

// qtyTotal dihitung di sini, bukan diterima dari klien -- angka yang masuk
// buku besar tidak boleh berasal dari sisi yang bisa dimodifikasi pengguna.
function hitungQtyTotal(satuan: SatuanQty[]): number {
  return satuan.reduce((jumlah, s) => jumlah + s.qty * s.pengali, 0);
}

const RUTE: Record<string, "GET" | "POST"> = {
  "/entri/simpan": "POST",
  "/entri/hapus": "POST",
  "/entri/daftar": "GET",
  "/mutasi/simpan": "POST",
  "/mutasi/hapus": "POST",
  "/mutasi/daftar": "GET",
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

    let parsed: unknown;
    try {
      parsed = await request.json();
    } catch {
      return jsonResponse({ ok: false, pesan: "badan bukan JSON sah" }, 400);
    }

    if (url.pathname === "/entri/simpan") return this.handleEntriSimpan(parsed);
    if (url.pathname === "/entri/hapus") return this.handleEntriHapus(parsed);
    if (url.pathname === "/mutasi/simpan") return this.handleMutasiSimpan(parsed);
    if (url.pathname === "/mutasi/hapus") return this.handleMutasiHapus(parsed);

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
