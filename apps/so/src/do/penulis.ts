import { DurableObject } from "cloudflare:workers";
import { namaTabLog, ringkasLog, tambahBarisLog, barisLogKeArray, catatErrorSheet } from "@kartini/sheets";

const TIGA_PULUH_DETIK_MS = 30_000;
const EMPAT_PULUH_LIMA_HARI_MS = 45 * 24 * 60 * 60 * 1000;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface BarisMasuk {
  clientId: string;
  jenis: string;
  productId: string;
  namaSaatItu: string;
  qtyPokok: number;
  satuanInput: string;
  qtyInput: number;
  dari: string | null;
  ke: string | null;
  sebab: string | null;
  catatan: string | null;
  sesiId?: string | null;
}

interface TulisBody {
  sheetId: string;
  user: string;
  baris: BarisMasuk[];
}

interface KosongkanBody {
  sheetId: string;
}

interface MuatanAntre {
  jenis: string;
  productId: string;
  namaSaatItu: string;
  qtyPokok: number;
  satuanInput: string;
  qtyInput: number;
  dari: string | null;
  ke: string | null;
  sebab: string | null;
  catatan: string | null;
  user: string;
  sesiId: string | null;
}

interface AntreRow {
  client_id: string;
  muatan: string;
  waktu_server: string;
  dibuat: number;
}

function isBarisMasuk(value: unknown): value is BarisMasuk {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  if (typeof r.clientId !== "string" || r.clientId.length === 0) return false;
  if (typeof r.jenis !== "string") return false;
  if (typeof r.productId !== "string") return false;
  if (typeof r.namaSaatItu !== "string") return false;
  if (typeof r.qtyPokok !== "number") return false;
  if (typeof r.satuanInput !== "string") return false;
  if (typeof r.qtyInput !== "number") return false;
  if (r.dari !== null && typeof r.dari !== "string") return false;
  if (r.ke !== null && typeof r.ke !== "string") return false;
  if (r.sebab !== null && typeof r.sebab !== "string") return false;
  if (r.catatan !== null && typeof r.catatan !== "string") return false;
  if (r.sesiId !== undefined && r.sesiId !== null && typeof r.sesiId !== "string") return false;
  return true;
}

function isTulisBody(value: unknown): value is TulisBody {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  if (typeof r.sheetId !== "string" || r.sheetId.trim().length === 0) return false;
  if (typeof r.user !== "string" || r.user.trim().length === 0) return false;
  if (!Array.isArray(r.baris) || r.baris.length === 0) return false;
  return r.baris.every(isBarisMasuk);
}

function isKosongkanBody(value: unknown): value is KosongkanBody {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return typeof r.sheetId === "string" && r.sheetId.trim().length > 0;
}

export class Penulis extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS antre (
        client_id TEXT PRIMARY KEY,
        muatan TEXT NOT NULL,
        waktu_server TEXT NOT NULL,
        dibuat INTEGER NOT NULL
      )
    `);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS terkirim (
        client_id TEXT PRIMARY KEY,
        waktu INTEGER NOT NULL
      )
    `);
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // /keadaan tidak berbadan. Kalau JSON diurai di depan untuk semua rute,
    // rute itu selalu dijawab 400 dan pemeriksaan keadaan antrean mati.
    if (url.pathname === "/keadaan") {
      return this.handleKeadaan();
    }

    if (request.method !== "POST") {
      return jsonResponse({ ok: false, error: "metode tidak didukung" }, 405);
    }

    let parsed: unknown;
    try {
      parsed = await request.json();
    } catch {
      return jsonResponse({ ok: false, error: "badan bukan JSON sah" }, 400);
    }

    if (url.pathname === "/tulis") {
      return this.handleTulis(parsed);
    }

    if (url.pathname === "/kosongkan") {
      return this.handleKosongkan(parsed);
    }

    return jsonResponse({ ok: false, error: "tidak dikenal" }, 404);
  }

  private async handleTulis(parsed: unknown): Promise<Response> {
    if (!isTulisBody(parsed)) {
      return jsonResponse({ ok: false, error: "sheetId, user, dan baris (array tidak kosong) wajib ada" }, 400);
    }

    const { sheetId, user, baris } = parsed;
    await this.simpanSheetId(sheetId);

    const duplikat: string[] = [];
    const diantrekan: string[] = [];
    const sekarang = Date.now();
    const waktuServer = new Date(sekarang).toISOString();

    for (const b of baris) {
      const sudahTerkirim = this.ctx.storage.sql
        .exec("SELECT client_id FROM terkirim WHERE client_id = ?", b.clientId)
        .toArray()[0];
      const sudahAntre = this.ctx.storage.sql
        .exec("SELECT client_id FROM antre WHERE client_id = ?", b.clientId)
        .toArray()[0];

      if (sudahTerkirim || sudahAntre) {
        duplikat.push(b.clientId);
        continue;
      }

      const muatan: MuatanAntre = {
        jenis: b.jenis,
        productId: b.productId,
        namaSaatItu: b.namaSaatItu,
        qtyPokok: b.qtyPokok,
        satuanInput: b.satuanInput,
        qtyInput: b.qtyInput,
        dari: b.dari,
        ke: b.ke,
        sebab: b.sebab,
        catatan: b.catatan,
        user,
        sesiId: b.sesiId ?? null,
      };

      this.ctx.storage.sql.exec(
        "INSERT INTO antre (client_id, muatan, waktu_server, dibuat) VALUES (?, ?, ?, ?)",
        b.clientId,
        JSON.stringify(muatan),
        waktuServer,
        sekarang,
      );
      diantrekan.push(b.clientId);
    }

    const hasil = await this.kosongkanAntrean(sheetId);
    const diterimaSet = new Set(hasil.diterima);
    const tertundaSet = new Set(hasil.tertunda);

    return jsonResponse(
      {
        ok: true,
        diterima: diantrekan.filter((id) => diterimaSet.has(id)),
        duplikat,
        tertunda: diantrekan.filter((id) => tertundaSet.has(id)),
      },
      200,
    );
  }

  private async handleKosongkan(parsed: unknown): Promise<Response> {
    if (!isKosongkanBody(parsed)) {
      return jsonResponse({ ok: false, error: "sheetId wajib ada" }, 400);
    }

    await this.simpanSheetId(parsed.sheetId);
    const hasil = await this.kosongkanAntrean(parsed.sheetId);
    return jsonResponse({ ok: true, ...hasil }, 200);
  }

  private handleKeadaan(): Response {
    const antre = this.ctx.storage.sql.exec("SELECT COUNT(*) AS jumlah FROM antre").toArray()[0] as
      | { jumlah: number }
      | undefined;
    const terkirim = this.ctx.storage.sql.exec("SELECT COUNT(*) AS jumlah FROM terkirim").toArray()[0] as
      | { jumlah: number }
      | undefined;

    return jsonResponse(
      { ok: true, antre: antre?.jumlah ?? 0, terkirim: terkirim?.jumlah ?? 0 },
      200,
    );
  }

  // Durable Object menutup gerbang masukan selama operasi STORAGE saja, bukan
  // selama `await fetch()` ke Sheets. Tanpa kunci ini dua permintaan yang datang
  // bersamaan sama-sama membaca `idTerakhir` yang sama lalu sama-sama meng-append:
  // baris kembar dengan id kembar di spreadsheet, persis yang mau dicegah.
  private rantai: Promise<unknown> = Promise.resolve();

  private kosongkanAntrean(sheetId: string): Promise<{ diterima: string[]; tertunda: string[] }> {
    const jalan = () => this.jalankanPengosongan(sheetId);
    // then(jalan, jalan): pengosongan berikutnya tetap jalan walau yang
    // sebelumnya melempar -- satu kegagalan tidak boleh membekukan antrean.
    const hasil = this.rantai.then(jalan, jalan);
    this.rantai = hasil.then(
      () => undefined,
      () => undefined
    );
    return hasil;
  }

  private async simpanSheetId(sheetId: string): Promise<void> {
    const tersimpan = await this.ctx.storage.get<string>("sheetId");
    if (tersimpan === sheetId) return;
    await this.ctx.storage.put("sheetId", sheetId);
  }

  // Tidak pernah melempar -- pemanggil (rute HTTP maupun alarm) harus tetap
  // bisa membalas walau Sheets API sedang bermasalah.
  private async jalankanPengosongan(sheetId: string): Promise<{ diterima: string[]; tertunda: string[] }> {
    const baris = this.ctx.storage.sql
      .exec("SELECT client_id, muatan, waktu_server, dibuat FROM antre ORDER BY dibuat ASC")
      .toArray() as unknown as AntreRow[];

    if (baris.length === 0) {
      return { diterima: [], tertunda: [] };
    }

    const tab = namaTabLog(new Date());

    let ringkasan: { idTerakhir: number; clientIds: Set<string> };
    try {
      ringkasan = await ringkasLog(sheetId, tab);
    } catch (err) {
      const pesan = err instanceof Error ? err.message : String(err);
      await catatErrorSheet(sheetId, `gagal ringkasLog: ${pesan}`, tab);
      await this.pasangAlarmJikaBelum();
      return { diterima: [], tertunda: baris.map((b) => b.client_id) };
    }

    const diterima: string[] = [];
    const sisaKirim: AntreRow[] = [];

    for (const b of baris) {
      // clientId sudah ada di Sheets berarti percobaan sebelumnya sukses
      // tapi jawabannya tidak sampai -- jangan dikirim ulang, itu yang
      // menghasilkan baris kembar di spreadsheet.
      if (ringkasan.clientIds.has(b.client_id)) {
        this.pindahKeTerkirim(b.client_id);
        diterima.push(b.client_id);
      } else {
        sisaKirim.push(b);
      }
    }

    if (sisaKirim.length === 0) {
      return { diterima, tertunda: [] };
    }

    // id diambil dari Sheets (bukan hitungan DO) supaya percobaan ulang
    // yang gagal separuh menyambung nomor, bukan menimpa baris yang sudah
    // mendarat.
    let idBerikutnya = ringkasan.idTerakhir + 1;
    const semuaBaris: (string | number)[][] = [];

    for (const b of sisaKirim) {
      const muatan = JSON.parse(b.muatan) as MuatanAntre;
      semuaBaris.push(
        barisLogKeArray({
          id: idBerikutnya,
          waktuServer: b.waktu_server,
          jenis: muatan.jenis,
          productId: muatan.productId,
          namaSaatItu: muatan.namaSaatItu,
          qtyPokok: muatan.qtyPokok,
          satuanInput: muatan.satuanInput,
          qtyInput: muatan.qtyInput,
          dari: muatan.dari,
          ke: muatan.ke,
          qtyTerlihat: null,
          sebab: muatan.sebab,
          catatan: muatan.catatan,
          user: muatan.user,
          clientId: b.client_id,
          sesiId: muatan.sesiId,
        }),
      );
      idBerikutnya += 1;
    }

    try {
      // satu panggilan untuk seluruh baris -- Sheets API membatasi 60 tulis
      // per menit per akun layanan, dan satu akun dipakai seluruh toko.
      await tambahBarisLog(sheetId, tab, semuaBaris);
    } catch (err) {
      const pesan = err instanceof Error ? err.message : String(err);
      await catatErrorSheet(sheetId, `gagal tambahBarisLog: ${pesan}`, tab);
      await this.pasangAlarmJikaBelum();
      return { diterima, tertunda: sisaKirim.map((b) => b.client_id) };
    }

    const sekarang = Date.now();
    for (const b of sisaKirim) {
      this.pindahKeTerkirim(b.client_id, sekarang);
      diterima.push(b.client_id);
    }

    this.pangkasTerkirimLama();

    return { diterima, tertunda: [] };
  }

  private pindahKeTerkirim(clientId: string, waktu: number = Date.now()): void {
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO terkirim (client_id, waktu) VALUES (?, ?)",
      clientId,
      waktu,
    );
    this.ctx.storage.sql.exec("DELETE FROM antre WHERE client_id = ?", clientId);
  }

  private pangkasTerkirimLama(): void {
    const ambang = Date.now() - EMPAT_PULUH_LIMA_HARI_MS;
    this.ctx.storage.sql.exec("DELETE FROM terkirim WHERE waktu < ?", ambang);
  }

  private async pasangAlarmJikaBelum(): Promise<void> {
    const ada = await this.ctx.storage.getAlarm();
    if (ada === null) {
      await this.ctx.storage.setAlarm(Date.now() + TIGA_PULUH_DETIK_MS);
    }
  }

  override async alarm(): Promise<void> {
    const sheetId = await this.ctx.storage.get<string>("sheetId");
    if (!sheetId) return;

    const hasil = await this.kosongkanAntrean(sheetId);
    if (hasil.tertunda.length > 0) {
      await this.ctx.storage.setAlarm(Date.now() + TIGA_PULUH_DETIK_MS);
    }
  }
}
