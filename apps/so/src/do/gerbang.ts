import { DurableObject } from "cloudflare:workers";

const BATAS_GAGAL = 5;
const DURASI_KUNCI_DETIK = 900;
const DURASI_KUNCI_MS = DURASI_KUNCI_DETIK * 1000;

interface GerbangBody {
  username: string;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isGerbangBody(value: unknown): value is GerbangBody {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.username === "string" && record.username.trim().length > 0;
}

interface PercobaanRow {
  username: string;
  gagal: number;
  terkunci_sampai: number;
}

export class Gerbang extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS percobaan (
        username TEXT PRIMARY KEY,
        gagal INTEGER NOT NULL DEFAULT 0,
        terkunci_sampai INTEGER NOT NULL DEFAULT 0
      )
    `);
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    let parsed: unknown;
    try {
      parsed = await request.json();
    } catch {
      return jsonResponse({ ok: false, error: "badan bukan JSON sah" }, 400);
    }

    if (!isGerbangBody(parsed)) {
      return jsonResponse({ ok: false, error: "username wajib ada" }, 400);
    }

    const username = parsed.username.trim().toLowerCase();

    if (request.method === "POST" && url.pathname === "/cek") {
      return this.handleCek(username);
    }

    if (request.method === "POST" && url.pathname === "/gagal") {
      return this.handleGagal(username);
    }

    if (request.method === "POST" && url.pathname === "/berhasil") {
      return this.handleBerhasil(username);
    }

    return jsonResponse({ ok: false, error: "tidak dikenal" }, 404);
  }

  private ambilBaris(username: string): PercobaanRow {
    // toArray()[0], bukan one(): one() MELEMPAR kalau barisnya nol, dan nol
    // baris justru keadaan normal — pengguna yang belum pernah salah PIN.
    const rows = this.ctx.storage.sql
      .exec("SELECT username, gagal, terkunci_sampai FROM percobaan WHERE username = ?", username)
      .toArray() as unknown as PercobaanRow[];
    const existing = rows[0];
    if (existing) return existing;
    return { username, gagal: 0, terkunci_sampai: 0 };
  }

  private handleCek(username: string): Response {
    const baris = this.ambilBaris(username);
    const sekarang = Date.now();

    if (baris.terkunci_sampai > sekarang) {
      const sisaDetik = Math.ceil((baris.terkunci_sampai - sekarang) / 1000);
      return jsonResponse({ ok: true, terkunci: true, sisaDetik }, 200);
    }

    return jsonResponse({ ok: true, terkunci: false }, 200);
  }

  private handleGagal(username: string): Response {
    const baris = this.ambilBaris(username);
    const sekarang = Date.now();

    if (baris.terkunci_sampai > sekarang) {
      const sisaDetik = Math.ceil((baris.terkunci_sampai - sekarang) / 1000);
      return jsonResponse({ ok: true, gagal: baris.gagal, terkunci: true, sisaDetik }, 200);
    }

    const kadaluarsa = baris.terkunci_sampai > 0;
    const gagalDasar = kadaluarsa ? 0 : baris.gagal;
    const gagal = gagalDasar + 1;

    let terkunciSampai = 0;
    let terkunci = false;
    if (gagal >= BATAS_GAGAL) {
      terkunciSampai = sekarang + DURASI_KUNCI_MS;
      terkunci = true;
    }

    this.ctx.storage.sql.exec(
      "INSERT INTO percobaan (username, gagal, terkunci_sampai) VALUES (?, ?, ?) ON CONFLICT(username) DO UPDATE SET gagal = excluded.gagal, terkunci_sampai = excluded.terkunci_sampai",
      username,
      gagal,
      terkunciSampai,
    );

    if (terkunci) {
      const sisaDetik = Math.ceil((terkunciSampai - sekarang) / 1000);
      return jsonResponse({ ok: true, gagal, terkunci: true, sisaDetik }, 200);
    }

    return jsonResponse({ ok: true, gagal, terkunci: false }, 200);
  }

  private handleBerhasil(username: string): Response {
    this.ctx.storage.sql.exec(
      "INSERT INTO percobaan (username, gagal, terkunci_sampai) VALUES (?, 0, 0) ON CONFLICT(username) DO UPDATE SET gagal = 0, terkunci_sampai = 0",
      username,
    );
    return jsonResponse({ ok: true }, 200);
  }
}
