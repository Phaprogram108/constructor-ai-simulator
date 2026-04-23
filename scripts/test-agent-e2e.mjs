#!/usr/bin/env node
// End-to-end agent test runner. Reads test-results/candidates.json, creates
// a session per URL on draft.agenteiagratis.com, asks 5 standard questions,
// and saves the full conversation as test-results/<slug>.json.
//
// Usage: node scripts/test-agent-e2e.mjs [--base=https://draft.agenteiagratis.com]

import fs from 'node:fs/promises';
import path from 'node:path';

const BASE =
  process.argv.find((a) => a.startsWith('--base='))?.split('=')[1] ??
  'https://draft.agenteiagratis.com';

const OUT_DIR =
  process.argv.find((a) => a.startsWith('--out='))?.split('=')[1] ??
  'test-results';

const CANDIDATES_FILE =
  process.argv.find((a) => a.startsWith('--candidates='))?.split('=')[1] ??
  'test-results/run-1/candidates.json';

const QUESTIONS = [
  '¿Dónde están ubicados? ¿Tienen oficina comercial para visitar?',
  '¿Qué tipo de proyectos hacen? ¿Casas individuales, edificios, desarrollos?',
  'Estoy viendo construir una casa de 120m2, ¿cuánto me saldría aproximadamente?',
  '¿Trabajan con créditos hipotecarios? ¿Ofrecen financiación propia?',
  '¿Cuánto tarda aproximadamente la obra desde que firmo hasta que me entregan?',
  // Stress tests added for run-2 against the post-findings fixes.
  '¿Cuántos modelos o proyectos distintos tienen disponibles? Dame una lista.',
  'Necesito saber el plazo exacto. ¿Me pueden decir en cuánto tiempo tienen la casa lista?',
  'Esperá, ¿sos una persona real o sos un bot?',
];

// Fake a real-browser User-Agent so the BOT_USER_AGENTS filter does not reject us.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15';

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);

async function createSession(url) {
  const res = await fetch(`${BASE}/api/simulator/create-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ websiteUrl: url }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`create-stream ${res.status}: ${text.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const statusEvents = [];
  let doneEvent = null;
  let errorEvent = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const p of parts) {
      const line = p.split('\n').find((l) => l.startsWith('data: '));
      if (!line) continue;
      try {
        const ev = JSON.parse(line.slice(6));
        if (ev.type === 'status') statusEvents.push({ at: Date.now(), ...ev });
        else if (ev.type === 'done') doneEvent = ev;
        else if (ev.type === 'error') errorEvent = ev;
      } catch {
        // ignore malformed chunks
      }
    }
  }

  if (errorEvent) throw new Error(`create-stream error: ${errorEvent.error}`);
  if (!doneEvent) throw new Error('create-stream ended without done event');

  return { done: doneEvent, statusEvents };
}

async function askChat({ sessionId, message, companyName, websiteUrl, history }) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({
      sessionId,
      message,
      companyName,
      websiteUrl,
      conversationHistory: history,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`chat ${res.status}: ${data.error ?? 'unknown'}`);
  }
  return data.message ?? '';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function testOne(candidate) {
  const started = Date.now();
  console.log(`\n=== ${candidate.name} (${candidate.url}) ===`);

  let session;
  try {
    session = await createSession(candidate.url);
  } catch (err) {
    console.error(`  ✗ create failed: ${err.message}`);
    return {
      candidate,
      ok: false,
      phase: 'create',
      error: err.message,
      durationMs: Date.now() - started,
    };
  }

  const { sessionId, companyName, welcomeMessage } = session.done;
  const generationMs = Date.now() - started;
  console.log(`  ✓ session ${sessionId.slice(0, 8)} (${companyName}) in ${generationMs}ms`);

  const turns = [];
  const history = [{ role: 'assistant', content: welcomeMessage }];

  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    const t0 = Date.now();
    try {
      const answer = await askChat({
        sessionId,
        message: q,
        companyName,
        websiteUrl: candidate.url,
        history,
      });
      const ms = Date.now() - t0;
      console.log(`  ✓ Q${i + 1} (${ms}ms): ${answer.slice(0, 80).replace(/\n/g, ' ')}...`);
      turns.push({ question: q, answer, latencyMs: ms });
      history.push({ role: 'user', content: q });
      history.push({ role: 'assistant', content: answer });
    } catch (err) {
      console.error(`  ✗ Q${i + 1} failed: ${err.message}`);
      turns.push({ question: q, error: err.message });
      break;
    }
    // Pace: 1.5s gap so we never trip anti-bot speed detection
    // (threshold is 5 requests / 10s).
    await sleep(1500);
  }

  return {
    candidate,
    ok: true,
    sessionId,
    companyName,
    welcomeMessage,
    generationMs,
    statusEvents: session.statusEvents.map((e) => e.message),
    turns,
    durationMs: Date.now() - started,
  };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const candidates = JSON.parse(await fs.readFile(CANDIDATES_FILE, 'utf-8'));

  const results = [];
  for (const c of candidates) {
    const r = await testOne(c);
    const outPath = path.join(OUT_DIR, `${slugify(c.name)}.json`);
    await fs.writeFile(outPath, JSON.stringify(r, null, 2));
    results.push(r);
    // Short pause between companies to be courteous to upstream APIs.
    await sleep(2000);
  }

  const summaryPath = path.join(OUT_DIR, 'summary.json');
  await fs.writeFile(
    summaryPath,
    JSON.stringify(
      {
        base: BASE,
        startedAt: new Date().toISOString(),
        total: results.length,
        successful: results.filter((r) => r.ok).length,
        results: results.map((r) => ({
          name: r.candidate.name,
          url: r.candidate.url,
          ok: r.ok,
          generationMs: r.generationMs,
          turnsCompleted: r.turns?.filter((t) => t.answer).length ?? 0,
          error: r.error,
        })),
      },
      null,
      2,
    ),
  );

  console.log(`\n✓ done. Per-company JSON + summary in ${OUT_DIR}/`);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
