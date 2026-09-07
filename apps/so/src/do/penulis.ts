import { DurableObject } from "cloudflare:workers";

interface AntreBody {
  client_id: string;
  muatan: unknown;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isAntreBody(value: unknown): value is AntreBody {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.client_id === "string" && record.client_id.length > 0;
}

export class Penulis extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS antrean (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id TEXT NOT NULL,
        muatan TEXT NOT NULL,
        dibuat INTEGER NOT NULL,
        terkirim INTEGER NOT NULL DEFAULT 0
      )
    `);
    this.ctx.storage.sql.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_antrean_client_id ON antrean(client_id)
    `);
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/antre") {
      return this.handleAntre(request);
    }

    if (request.method === "GET" && url.pathname === "/status") {
      return this.handleStatus();
    }

    return jsonResponse({ ok: false, error: "tidak dikenal" }, 404);
  }

  private async handleAntre(request: Request): Promise<Response> {
    let parsed: unknown;
    try {
      parsed = await request.json();
    } catch {
      return jsonResponse({ ok: false, error: "badan bukan JSON sah" }, 400);
    }

    if (!isAntreBody(parsed)) {
      return jsonResponse({ ok: false, error: "client_id wajib ada" }, 400);
    }

    const muatanText = JSON.stringify(parsed.muatan ?? null);
    const dibuat = Date.now();

    try {
      const cursor = this.ctx.storage.sql.exec(
        "INSERT INTO antrean (client_id, muatan, dibuat) VALUES (?, ?, ?) RETURNING id",
        parsed.client_id,
        muatanText,
        dibuat,
      );
      const row = cursor.one() as { id: number };
      return jsonResponse({ ok: true, duplikat: false, id: row.id }, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("UNIQUE") || message.includes("constraint")) {
        const existing = this.ctx.storage.sql
          .exec("SELECT id FROM antrean WHERE client_id = ?", parsed.client_id)
          .one() as { id: number };
        return jsonResponse({ ok: true, duplikat: true, id: existing.id }, 200);
      }
      return jsonResponse({ ok: false, error: message }, 400);
    }
  }

  private handleStatus(): Response {
    const antre = this.ctx.storage.sql
      .exec("SELECT COUNT(*) AS jumlah FROM antrean WHERE terkirim = 0")
      .one() as { jumlah: number };
    const total = this.ctx.storage.sql
      .exec("SELECT COUNT(*) AS jumlah FROM antrean")
      .one() as { jumlah: number };

    return jsonResponse(
      { ok: true, antre: antre.jumlah, total: total.jumlah },
      200,
    );
  }
}
