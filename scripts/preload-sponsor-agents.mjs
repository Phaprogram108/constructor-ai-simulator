#!/usr/bin/env node
/**
 * Pre-cache de agentes para los sponsors de ExpoConstruir 2026.
 *
 * Lanzar la noche del evento contra producción (agenteiagratis.com) para
 * que los 69 sponsors estén listos en Redis con TTL 72h. Una vez precacheados
 * el dropdown del simulador devuelve el agente instant en vez de scrapear+generar.
 *
 * Variables de entorno:
 *   BASE_URL       (default: https://agenteiagratis.com)
 *   LEADS_API_KEY  (default: pha@108)
 *   PAUSE_MS       (default: 8000) — pausa entre requests para no martillar el endpoint
 *
 * Uso:
 *   node scripts/preload-sponsor-agents.mjs
 *
 * Genera test-results/preload-summary.json con el resultado por sponsor.
 */

import { promises as fs } from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'https://agenteiagratis.com';
const API_KEY = process.env.LEADS_API_KEY || 'pha@108';
const PAUSE_MS = Number(process.env.PAUSE_MS || 8000);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function preload(sponsor) {
  const slug = sponsor.slug || slugify(sponsor.name);
  const res = await fetch(`${BASE_URL}/api/simulator/preload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'User-Agent': UA,
    },
    body: JSON.stringify({
      slug,
      websiteUrl: sponsor.websiteUrl,
      companyName: sponsor.name,
      tier: sponsor.tier,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 300)}`);
  }
  return await res.json();
}

async function main() {
  const sponsorsPath = path.resolve('src/data/sponsors-expoconstruir.json');
  const sponsors = JSON.parse(await fs.readFile(sponsorsPath, 'utf-8'));

  console.log(`Preloading ${sponsors.length} sponsors against ${BASE_URL}`);
  console.log(`Pause between requests: ${PAUSE_MS}ms`);
  console.log('');

  const results = [];
  const startedAt = Date.now();

  for (let i = 0; i < sponsors.length; i++) {
    const s = sponsors[i];
    const tag = `[${i + 1}/${sponsors.length}] ${s.name}`;
    process.stdout.write(`${tag} ... `);
    const t0 = Date.now();
    try {
      const r = await preload(s);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`OK sessionId=${String(r.sessionId).slice(0, 8)}... (${elapsed}s)`);
      results.push({
        ...s,
        slug: s.slug || slugify(s.name),
        status: 'ok',
        sessionId: r.sessionId,
        durationSec: Number(elapsed),
      });
    } catch (e) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`FAIL ${e.message} (${elapsed}s)`);
      results.push({
        ...s,
        slug: s.slug || slugify(s.name),
        status: 'fail',
        error: e.message,
        durationSec: Number(elapsed),
      });
    }
    if (i < sponsors.length - 1) {
      await sleep(PAUSE_MS);
    }
  }

  const totalSec = ((Date.now() - startedAt) / 1000).toFixed(0);
  const ok = results.filter((r) => r.status === 'ok').length;
  const fail = results.filter((r) => r.status === 'fail').length;

  await fs.mkdir('test-results', { recursive: true });
  const outPath = path.resolve('test-results/preload-summary.json');
  await fs.writeFile(outPath, JSON.stringify(results, null, 2));

  console.log('');
  console.log(`Done in ${totalSec}s. OK=${ok}, FAIL=${fail}`);
  console.log(`Summary written to ${outPath}`);

  if (fail > 0) {
    console.log('');
    console.log('Failures:');
    results
      .filter((r) => r.status === 'fail')
      .forEach((r) => console.log(`  - ${r.name} (${r.slug}): ${r.error}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
