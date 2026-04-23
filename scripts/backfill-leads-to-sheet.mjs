#!/usr/bin/env node
// Backfill existing Upstash Redis leads into the "leads AIAG" tab of the
// master Google Sheet using the same service-account flow that the live
// /api/leads endpoint uses. Run this ONCE after setting up the service
// account and sharing the Sheet with it.
//
// Required env vars (from shell or .env.local):
//   - GOOGLE_SERVICE_ACCOUNT_JSON  full JSON content of the SA key file
//   - UPSTASH_REDIS_REST_URL
//   - UPSTASH_REDIS_REST_TOKEN
// Optional:
//   - LEADS_SPREADSHEET_ID         defaults to the master 3000 ID
//
// Usage: node scripts/backfill-leads-to-sheet.mjs

import crypto from 'node:crypto';
import fs from 'node:fs';

// Load .env.local if present (no dotenv dep).
try {
  const env = fs.readFileSync('.env.local', 'utf-8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch {
  /* no .env.local — fall through to shell env */
}

const {
  GOOGLE_SERVICE_ACCOUNT_JSON,
  UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN,
  LEADS_SPREADSHEET_ID,
} = process.env;

const SPREADSHEET_ID = LEADS_SPREADSHEET_ID || '1GVt0MqKgc5psukWdJLMFLdTlLFdOh5wFcaLGcqUElEE';
const RANGE = 'leads AIAG!A:E';

if (!GOOGLE_SERVICE_ACCOUNT_JSON) {
  console.error('ERROR: GOOGLE_SERVICE_ACCOUNT_JSON not set.');
  process.exit(1);
}
if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
  console.error('ERROR: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set.');
  process.exit(1);
}

function base64url(buf) {
  const b = typeof buf === 'string' ? Buffer.from(buf) : buf;
  return b.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken() {
  const sa = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const toSign = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const sig = base64url(crypto.createSign('RSA-SHA256').update(toSign).sign(sa.private_key));
  const jwt = `${toSign}.${sig}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

async function fetchLeads() {
  const res = await fetch(`${UPSTASH_REDIS_REST_URL}/lrange/leads:all/0/-1`, {
    headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Upstash fetch failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data.result || [])
    .map((s) => {
      try {
        return JSON.parse(s);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function appendBatch(token, rows) {
  const range = encodeURIComponent(RANGE);
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}:append` +
    `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: rows }),
  });
  if (!res.ok) throw new Error(`Append failed: ${res.status} ${await res.text()}`);
}

async function main() {
  console.log('Auth...');
  const token = await getAccessToken();

  console.log('Reading leads from Upstash...');
  const leads = await fetchLeads();
  console.log(`Found ${leads.length} leads.`);

  // Upstash lpush stores newest-first; reverse so the Sheet ends oldest-first.
  leads.reverse();

  // Build rows in the exact order we wrote the headers.
  const rows = leads.map((l) => [
    l.createdAt || '',
    l.whatsapp || '',
    l.websiteUrl || '',
    l.type || 'simulator',
    l.id || '',
  ]);

  if (rows.length === 0) {
    console.log('No leads to backfill.');
    return;
  }

  // Sheets API accepts batches of hundreds of rows in one call.
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await appendBatch(token, batch);
    console.log(`  appended ${i + batch.length}/${rows.length}`);
  }

  console.log(`Done. ${rows.length} rows appended to "leads AIAG".`);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
