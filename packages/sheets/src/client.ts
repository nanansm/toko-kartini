import { google, sheets_v4 } from 'googleapis';

let cachedClient: sheets_v4.Sheets | null = null;

function loadCredentials(): Record<string, unknown> {
  // Prioritas: base64 > raw JSON (untuk backward compat)
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  if (b64) {
    try {
      const decoded = Buffer.from(b64, 'base64').toString('utf-8');
      return JSON.parse(decoded);
    } catch (err) {
      throw new Error(`GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 invalid: ${err instanceof Error ? err.message : 'parse error'}`);
    }
  }

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (err) {
      throw new Error(`GOOGLE_SERVICE_ACCOUNT_JSON invalid: ${err instanceof Error ? err.message : 'parse error'}`);
    }
  }

  throw new Error('Missing env: GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 atau GOOGLE_SERVICE_ACCOUNT_JSON harus di-set');
}

export function getSheetsClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;

  const credentials = loadCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  cachedClient = google.sheets({ version: 'v4', auth });
  return cachedClient;
}

export async function readSheet(sheetId: string, range: string): Promise<string[][]> {
  const client = getSheetsClient();
  const res = await client.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  return (res.data.values ?? []) as string[][];
}
