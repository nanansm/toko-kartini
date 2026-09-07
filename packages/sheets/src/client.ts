const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
const TOKEN_EXPIRY_SKEW_MS = 5 * 60 * 1000;

export const SCOPE_READONLY = "https://www.googleapis.com/auth/spreadsheets.readonly";
export const SCOPE_READWRITE = "https://www.googleapis.com/auth/spreadsheets";

const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 500;

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
  cacheKey: string;
}

const tokenCache = new Map<string, CachedToken>();
const pendingTokenRequests = new Map<string, Promise<string>>();

function evictCachedToken(cacheKey: string): void {
  tokenCache.delete(cacheKey);
}

function loadCredentials(): ServiceAccountCredentials {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  if (b64) {
    try {
      const decoded = atob(b64);
      return JSON.parse(decoded) as ServiceAccountCredentials;
    } catch (err) {
      throw new Error(
        `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 invalid: ${
          err instanceof Error ? err.message : "parse error"
        }`
      );
    }
  }

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    try {
      return JSON.parse(raw) as ServiceAccountCredentials;
    } catch (err) {
      throw new Error(
        `GOOGLE_SERVICE_ACCOUNT_JSON invalid: ${
          err instanceof Error ? err.message : "parse error"
        }`
      );
    }
  }

  throw new Error(
    "Missing env: GOOGLE_SERVICE_ACCOUNT_JSON atau GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 harus di-set"
  );
}

function base64UrlEncode(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const unescaped = pem.replace(/\\n/g, "\n");
  const base64 = unescaped
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function signJwt(
  credentials: ServiceAccountCredentials,
  scope: string,
  tokenUri: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: credentials.client_email,
    scope,
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  };

  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(claims)
  )}`;

  const key = await importPrivateKey(credentials.private_key);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

async function getAccessToken(
  scope: string
): Promise<{ accessToken: string; cacheKey: string }> {
  const credentials = loadCredentials();
  const cacheKey = `${credentials.client_email}:${scope}`;
  const now = Date.now();

  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt - TOKEN_EXPIRY_SKEW_MS > now) {
    return { accessToken: cached.accessToken, cacheKey };
  }

  const pending = pendingTokenRequests.get(cacheKey);
  if (pending) {
    return { accessToken: await pending, cacheKey };
  }

  const requestPromise = (async () => {
    const tokenUri = credentials.token_uri || DEFAULT_TOKEN_URI;
    const jwt = await signJwt(credentials, scope, tokenUri);

    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    });

    const res = await fetch(tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Failed to obtain Google access token (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    const token: CachedToken = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      cacheKey,
    };
    tokenCache.set(cacheKey, token);
    return token.accessToken;
  })();

  pendingTokenRequests.set(cacheKey, requestPromise);
  try {
    const accessToken = await requestPromise;
    return { accessToken, cacheKey };
  } finally {
    pendingTokenRequests.delete(cacheKey);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let attempt = 0;
  for (;;) {
    const res = await fetch(url, init);
    if (res.ok || !RETRY_STATUSES.has(res.status) || attempt >= MAX_RETRIES - 1) {
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        const err = new Error(
          `Sheets API error (${res.status}): ${errText.slice(0, 500)}`
        ) as Error & { status?: number };
        err.status = res.status;
        throw err;
      }
      return res;
    }
    const backoff = BASE_DELAY_MS * 2 ** attempt;
    const jitter = backoff * 0.2 * (Math.random() * 2 - 1);
    await sleep(backoff + jitter);
    attempt++;
  }
}

async function apiRequest<T>(
  scope: string,
  method: string,
  url: string,
  body?: unknown
): Promise<T> {
  const { accessToken, cacheKey } = await getAccessToken(scope);
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  };

  let res: Response;
  try {
    res = await fetchWithRetry(url, init);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 401 || status === 403) {
      evictCachedToken(cacheKey);
      const retried = await getAccessToken(scope);
      res = await fetchWithRetry(url, {
        ...init,
        headers: {
          ...init.headers,
          Authorization: `Bearer ${retried.accessToken}`,
        },
      });
    } else {
      throw err;
    }
  }

  if (res.status === 204) {
    return {} as T;
  }
  return (await res.json()) as T;
}

export async function readSheet(sheetId: string, range: string): Promise<string[][]> {
  const url = `${SHEETS_API_BASE}/${sheetId}/values/${encodeURIComponent(range)}`;
  const data = await apiRequest<{ values?: string[][] }>(
    SCOPE_READONLY,
    "GET",
    url
  );
  return data.values ?? [];
}

export async function batchGet(
  sheetId: string,
  ranges: string[]
): Promise<Record<string, string[][]>> {
  const params = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
  const url = `${SHEETS_API_BASE}/${sheetId}/values:batchGet?${params}`;
  const data = await apiRequest<{
    valueRanges?: { range: string; values?: string[][] }[];
  }>(SCOPE_READONLY, "GET", url);

  const result: Record<string, string[][]> = {};
  const valueRanges = data.valueRanges ?? [];
  ranges.forEach((requestedRange, i) => {
    result[requestedRange] = valueRanges[i]?.values ?? [];
  });
  return result;
}

export async function appendRows(
  sheetId: string,
  range: string,
  rows: (string | number)[][]
): Promise<void> {
  const url = `${SHEETS_API_BASE}/${sheetId}/values/${encodeURIComponent(
    range
  )}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  await apiRequest(SCOPE_READWRITE, "POST", url, { values: rows });
}

export async function updateRange(
  sheetId: string,
  range: string,
  rows: (string | number)[][]
): Promise<void> {
  const url = `${SHEETS_API_BASE}/${sheetId}/values/${encodeURIComponent(
    range
  )}?valueInputOption=RAW`;
  await apiRequest(SCOPE_READWRITE, "PUT", url, { values: rows });
}
