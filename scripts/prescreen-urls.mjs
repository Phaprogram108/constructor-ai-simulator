#!/usr/bin/env node
// Pre-screens a list of candidate URLs against a quick HTTP + text-length
// check so we don't send obviously unscrapeable sites to the agent generator.
// This approximates our isScrapeEmpty() server-side check without burning
// Firecrawl credits on sites that would fail.
//
// Usage:
//   node scripts/prescreen-urls.mjs \
//     --in=test-results/run-4/all-candidates.json \
//     --out=test-results/run-4/prescreened.json

import fs from 'node:fs/promises';

const IN =
  process.argv.find((a) => a.startsWith('--in='))?.split('=')[1] ??
  'test-results/run-4/all-candidates.json';
const OUT =
  process.argv.find((a) => a.startsWith('--out='))?.split('=')[1] ??
  'test-results/run-4/prescreened.json';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15';

const TIMEOUT_MS = 15_000;
const MIN_TEXT_LEN = 1500;

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,*/*' },
      redirect: 'follow',
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function check(candidate) {
  const url = candidate.url;
  const t0 = Date.now();
  try {
    const res = await fetchWithTimeout(url);
    const ms = Date.now() - t0;
    if (!res.ok) {
      return {
        ...candidate,
        passed: false,
        statusCode: res.status,
        textLen: 0,
        reason: `HTTP ${res.status}`,
        probeMs: ms,
      };
    }
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('html')) {
      return {
        ...candidate,
        passed: false,
        statusCode: res.status,
        textLen: 0,
        reason: `non-html content-type: ${ct}`,
        probeMs: ms,
      };
    }
    const html = await res.text();
    const text = stripHtml(html);
    const passed = text.length >= MIN_TEXT_LEN;
    return {
      ...candidate,
      passed,
      statusCode: res.status,
      textLen: text.length,
      reason: passed ? 'ok' : `text too short (${text.length} < ${MIN_TEXT_LEN})`,
      probeMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      ...candidate,
      passed: false,
      statusCode: 0,
      textLen: 0,
      reason: err.name === 'AbortError' ? 'timeout' : `fetch error: ${err.message}`,
      probeMs: Date.now() - t0,
    };
  }
}

async function main() {
  const candidates = JSON.parse(await fs.readFile(IN, 'utf-8'));
  console.log(`Pre-screening ${candidates.length} URLs (parallel, ${TIMEOUT_MS}ms timeout each)...`);

  const results = await Promise.all(candidates.map(check));

  for (const r of results) {
    const mark = r.passed ? '✓' : '✗';
    console.log(`${mark} ${r.url.padEnd(50)} ${String(r.textLen).padStart(6)} chars  ${r.reason}`);
  }

  const passed = results.filter((r) => r.passed);
  console.log(`\n${passed.length}/${results.length} passed.`);

  await fs.writeFile(OUT, JSON.stringify(results, null, 2));
  console.log(`Full report: ${OUT}`);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
