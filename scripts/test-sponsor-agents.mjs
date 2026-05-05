import { promises as fs } from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const QUESTIONS = [
  'Hola, ¿qué hacen ustedes? Contame un poco de la empresa.',
  '¿En qué zona geográfica operan?',
  '¿Tienen catálogo o lista de precios para enviarme?',
  'Si quisiera empezar un proyecto, ¿cuánto sale aproximadamente algo básico?',
  '¿Cómo me contacto con un vendedor? Dame un teléfono o email.',
];

const PROHIBITED = ['no tengo información', 'no sé', 'no dispongo de', 'lo siento, no puedo'];
const OUTPUT_DIR = path.resolve('test-results/expoconstruir-2026');

const MAX_CREATE_RETRIES = 3;
const PAUSE_BETWEEN_SPONSORS_MS = 8000; // throttle so we don't trip the create rate-limit

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function createAgentOnce(websiteUrl) {
  const res = await fetch(`${BASE_URL}/api/simulator/create-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'sponsor-test/1.0' },
    body: JSON.stringify({ websiteUrl }),
  });
  if (!res.ok || !res.body) throw new Error(`create-stream HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let done = null;

  while (true) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const part of parts) {
      const line = part.split('\n').find(l => l.startsWith('data: '));
      if (!line) continue;
      let ev;
      try {
        ev = JSON.parse(line.slice(6));
      } catch {
        continue;
      }
      if (ev.type === 'status' && ev.message) {
        console.log(`    · ${ev.message}`);
      }
      if (ev.type === 'done') done = ev;
      if (ev.type === 'error') throw new Error(`agent build error: ${ev.error}`);
    }
  }
  if (!done) throw new Error('stream ended without done event');
  return done;
}

async function createAgent(websiteUrl) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_CREATE_RETRIES; attempt++) {
    try {
      return await createAgentOnce(websiteUrl);
    } catch (err) {
      lastErr = err;
      console.log(`    create attempt ${attempt}/${MAX_CREATE_RETRIES} failed: ${err.message}`);
      if (attempt < MAX_CREATE_RETRIES) {
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }
  }
  throw lastErr;
}

async function chat(sessionId, message) {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'sponsor-test/1.0' },
    body: JSON.stringify({ sessionId, message }),
  });
  if (!res.ok) throw new Error(`chat HTTP ${res.status}: ${await res.text().catch(() => '')}`);
  const data = await res.json();
  // /api/chat returns { message: <string>, researched }
  if (typeof data.message === 'string') return data.message;
  if (typeof data.message?.content === 'string') return data.message.content;
  if (typeof data.content === 'string') return data.content;
  return '';
}

function flagConversation(answers) {
  const fails = [];
  for (let i = 0; i < answers.length; i++) {
    const raw = answers[i] || '';
    const a = raw.toLowerCase();
    if (raw.startsWith('[ERROR') || a.includes('http 429') || a.includes('http 500') || a.includes('chat_limit_reached')) {
      fails.push(`Q${i + 1}: chat error`);
      continue;
    }
    if (a.length < 30) fails.push(`Q${i + 1}: too short`);
    for (const tok of PROHIBITED) {
      if (a.includes(tok)) fails.push(`Q${i + 1}: contains "${tok}"`);
    }
  }
  return fails;
}

async function readExistingTxt(slug) {
  try {
    return await fs.readFile(path.join(OUTPUT_DIR, `${slug}.txt`), 'utf-8');
  } catch {
    return null;
  }
}

function isExistingTxtClean(content) {
  if (!content) return false;
  if (content.includes('FAILED:')) return false;
  if (content.includes('[ERROR')) return false;
  // count IA: lines (welcome + 5 chats = 6)
  const iaCount = (content.match(/^IA[:\s]/gm) || []).length;
  return iaCount >= 5;
}

function txtFor({ name, websiteUrl, welcomeMessage, qa }) {
  const lines = [
    `Sponsor: ${name}`,
    `Website: ${websiteUrl}`,
    `Date: ${new Date().toISOString()}`,
    '',
    `IA (welcome): ${welcomeMessage || '(none)'}`,
    '',
  ];
  for (let i = 0; i < qa.length; i++) {
    lines.push(`U: ${qa[i].q}`);
    lines.push(`IA: ${qa[i].a}`);
    lines.push('');
  }
  return lines.join('\n');
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const sponsorsAll = JSON.parse(await fs.readFile('src/data/sponsors-expoconstruir.json', 'utf-8'));
  const sponsors = sponsorsAll.filter(s => s.category === 'approved');

  console.log(`Testing ${sponsors.length} approved sponsors against ${BASE_URL}...`);
  const summary = [];
  const startedAt = Date.now();

  for (const s of sponsors) {
    const slug = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const existing = await readExistingTxt(slug);
    if (isExistingTxtClean(existing)) {
      console.log(`\n[${s.name}] SKIP — TXT already clean`);
      summary.push({ name: s.name, slug, status: 'OK (cached)', fails: [], durationS: '0.0' });
      continue;
    }
    console.log(`\n[${s.name}] start (${s.websiteUrl})`);
    const t0 = Date.now();
    try {
      const agent = await createAgent(s.websiteUrl);
      console.log(`  agent ready in ${((Date.now() - t0) / 1000).toFixed(1)}s — sessionId=${agent.sessionId}`);
      const qa = [];
      for (const q of QUESTIONS) {
        try {
          const a = await chat(agent.sessionId, q);
          qa.push({ q, a });
          console.log(`  Q: ${q.slice(0, 50)}...\n  A: ${(a || '').slice(0, 100).replace(/\n/g, ' ')}...`);
        } catch (chatErr) {
          qa.push({ q, a: `[ERROR: ${chatErr.message}]` });
          console.log(`  Q: ${q.slice(0, 50)}... → CHAT ERROR: ${chatErr.message}`);
        }
      }
      const fails = flagConversation(qa.map(x => x.a));
      const status = fails.length === 0 ? 'OK' : 'REVISAR';
      const txt = txtFor({ name: s.name, websiteUrl: s.websiteUrl, welcomeMessage: agent.welcomeMessage, qa });
      await fs.writeFile(path.join(OUTPUT_DIR, `${slug}.txt`), txt);
      summary.push({ name: s.name, slug, status, fails, durationS: ((Date.now() - t0) / 1000).toFixed(1) });
      console.log(`[${s.name}] ${status}${fails.length ? ' — ' + fails.join('; ') : ''} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    } catch (err) {
      console.error(`[${s.name}] FAILED: ${err.message}`);
      summary.push({ name: s.name, slug, status: 'FAILED', fails: [err.message], durationS: ((Date.now() - t0) / 1000).toFixed(1) });
      await fs.writeFile(path.join(OUTPUT_DIR, `${slug}.txt`), `Sponsor: ${s.name}\nWebsite: ${s.websiteUrl}\nFAILED: ${err.message}\n`);
    }
    // Throttle to avoid create rate-limit (RATE_LIMITS.create.max per minute)
    await sleep(PAUSE_BETWEEN_SPONSORS_MS);
  }

  const totalS = ((Date.now() - startedAt) / 1000).toFixed(1);

  const md = [
    '# ExpoConstruir 2026 — Sponsor Agent Tests',
    `Date: ${new Date().toISOString()}`,
    `Total runtime: ${totalS}s`,
    '',
    '| Sponsor | Status | Duration | Issues |',
    '|---------|--------|----------|--------|',
    ...summary.map(s => `| ${s.name} | ${s.status === 'OK' ? '✅ OK' : s.status === 'FAILED' ? '🔴 FAILED' : '⚠️ REVISAR'} | ${s.durationS}s | ${s.fails.join('; ') || '—'} |`),
    '',
    `Totals: OK=${summary.filter(s => s.status === 'OK').length}, REVISAR=${summary.filter(s => s.status === 'REVISAR').length}, FAILED=${summary.filter(s => s.status === 'FAILED').length}`,
  ].join('\n');
  await fs.writeFile(path.join(OUTPUT_DIR, 'summary.md'), md);

  console.log(`\nDone in ${totalS}s. Outputs in ${OUTPUT_DIR}`);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
