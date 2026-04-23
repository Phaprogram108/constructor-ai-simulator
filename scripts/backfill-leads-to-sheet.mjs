#!/usr/bin/env node
// Backfill existing Upstash Redis leads to the Google Sheet via the
// Apps Script webhook. Run this ONCE after deploying the Apps Script
// and setting SHEETS_WEBHOOK_URL.
//
// Requires these env vars (read from shell or .env.local):
//   - SHEETS_WEBHOOK_URL     the Apps Script web app URL
//   - UPSTASH_REDIS_REST_URL same value as in Vercel
//   - UPSTASH_REDIS_REST_TOKEN
//
// Usage: node scripts/backfill-leads-to-sheet.mjs

import fs from 'node:fs';

// Manually load .env.local if present (no dotenv dependency needed).
try {
  const env = fs.readFileSync('.env.local', 'utf-8');
  for (const line of env.split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
} catch {
  // .env.local not present — fall back to shell env.
}

const { SHEETS_WEBHOOK_URL, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;

if (!SHEETS_WEBHOOK_URL) {
  console.error('ERROR: SHEETS_WEBHOOK_URL not set.');
  process.exit(1);
}
if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
  console.error('ERROR: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set.');
  process.exit(1);
}

async function fetchLeads() {
  const res = await fetch(`${UPSTASH_REDIS_REST_URL}/lrange/leads:all/0/-1`, {
    headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`Upstash fetch failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return (data.result || []).map((s) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

async function sendOne(lead) {
  const res = await fetch(SHEETS_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lead),
  });
  return { ok: res.ok, status: res.status };
}

async function main() {
  console.log('Reading leads from Upstash...');
  const leads = await fetchLeads();
  console.log(`Found ${leads.length} leads. Lpush returns newest first, so`);
  console.log('reversing order so the Sheet ends up oldest-first.');
  leads.reverse();

  let ok = 0;
  let failed = 0;
  for (const [i, lead] of leads.entries()) {
    try {
      const r = await sendOne(lead);
      if (r.ok) {
        ok += 1;
        process.stdout.write('.');
      } else {
        failed += 1;
        console.error(`\n[${i}] HTTP ${r.status} for lead`, lead.id ?? lead);
      }
    } catch (err) {
      failed += 1;
      console.error(`\n[${i}] fetch error:`, err.message);
    }
    // Mild pacing so Apps Script doesn't throttle
    await new Promise((r) => setTimeout(r, 120));
  }
  console.log(`\nDone. ${ok} OK, ${failed} failed.`);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
