// Minimal Google Sheets helper using a service-account JWT — no external
// dependency. Signs an RS256 JWT with Node's crypto, exchanges it for an
// access token, and calls the Sheets REST API. We only need append for
// the leads flow, so we keep the surface tiny.

import crypto from 'crypto';

const DEFAULT_SPREADSHEET_ID = '1GVt0MqKgc5psukWdJLMFLdTlLFdOh5wFcaLGcqUElEE';
const LEADS_RANGE = 'leads AIAG!A:E';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

function loadServiceAccount(): ServiceAccountKey {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var is not set');
  }
  const sa = JSON.parse(raw) as ServiceAccountKey;
  if (!sa.client_email || !sa.private_key) {
    throw new Error('Service account JSON is missing client_email / private_key');
  }
  return sa;
}

function base64url(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf) : buf;
  return b.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.token;
  }

  const sa = loadServiceAccount();
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const toSign = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(toSign);
  const signature = base64url(signer.sign(sa.private_key));
  const jwt = `${toSign}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in,
  };
  return data.access_token;
}

export interface LeadPayload {
  createdAt?: string;
  whatsapp?: string;
  websiteUrl?: string;
  type?: string;
  id?: string;
}

export async function appendLeadRow(lead: LeadPayload): Promise<void> {
  const spreadsheetId = process.env.LEADS_SPREADSHEET_ID ?? DEFAULT_SPREADSHEET_ID;
  const token = await getAccessToken();

  const row = [
    lead.createdAt || new Date().toISOString(),
    lead.whatsapp || '',
    lead.websiteUrl || '',
    lead.type || 'simulator',
    lead.id || '',
  ];

  const range = encodeURIComponent(LEADS_RANGE);
  // valueInputOption=RAW prevents Sheets from interpreting cell values that
  // start with `+`, `-`, `=` or `@` as formulas. WhatsApp numbers come in
  // like "+5491100000000" and would otherwise render as "#ERROR!".
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append` +
    `?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [row] }),
  });

  if (!res.ok) {
    throw new Error(`Sheets append failed: ${res.status} ${await res.text()}`);
  }
}
