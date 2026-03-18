import { NextRequest, NextResponse } from 'next/server';

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisCommand(command: string): Promise<{ result: unknown }> {
  const res = await fetch(`${UPSTASH_URL}/${command}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  return res.json();
}

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key') || request.nextUrl.searchParams.get('key');
  const expectedKey = process.env.LEADS_API_KEY;

  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  // 1. Check Redis connectivity
  try {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) throw new Error('Env vars missing');
    const ping = await redisCommand('ping');
    checks.redis = { ok: ping.result === 'PONG' };
  } catch (e) {
    checks.redis = { ok: false, detail: String(e) };
  }

  // 2. Test Redis read/write (session-like round trip)
  try {
    const testKey = `health:${Date.now()}`;
    await redisCommand(`set/${testKey}/ok/ex/10`);
    const read = await redisCommand(`get/${testKey}`);
    await redisCommand(`del/${testKey}`);
    checks.session_roundtrip = { ok: read.result === 'ok' };
  } catch (e) {
    checks.session_roundtrip = { ok: false, detail: String(e) };
  }

  // 3. Verify landing page is up
  try {
    const res = await fetch(request.nextUrl.origin, { method: 'HEAD' });
    checks.landing = { ok: res.ok };
  } catch (e) {
    checks.landing = { ok: false, detail: String(e) };
  }

  // 4. Verify API key env vars are set (Anthropic needed for chat)
  checks.api_keys = {
    ok: !!process.env.ANTHROPIC_API_KEY,
    detail: !process.env.ANTHROPIC_API_KEY ? 'ANTHROPIC_API_KEY missing' : undefined,
  };

  const allOk = Object.values(checks).every(c => c.ok);

  return NextResponse.json(
    { status: allOk ? 'healthy' : 'degraded', checks, timestamp: new Date().toISOString() },
    { status: allOk ? 200 : 503 },
  );
}
