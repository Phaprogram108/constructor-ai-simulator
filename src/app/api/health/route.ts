import { NextRequest, NextResponse } from 'next/server';

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TEST_WEBSITE = 'https://www.test-health-check.com/';
const TEST_WHATSAPP = '+0000000000';

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
  const baseUrl = request.nextUrl.origin;

  // 1. Check Redis connectivity
  try {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) throw new Error('Env vars missing');
    await redisCommand('ping');
    checks.redis = { ok: true };
  } catch (e) {
    checks.redis = { ok: false, detail: String(e) };
  }

  // 2. Test simulator creation
  let sessionId: string | null = null;
  try {
    const res = await fetch(`${baseUrl}/api/simulator/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        websiteUrl: TEST_WEBSITE,
        whatsapp: TEST_WHATSAPP,
        catalogSource: 'link',
      }),
    });
    const data = await res.json();
    if (res.ok && data.sessionId) {
      sessionId = data.sessionId;
      checks.simulator = { ok: true };
    } else {
      checks.simulator = { ok: false, detail: data.error || `Status ${res.status}` };
    }
  } catch (e) {
    checks.simulator = { ok: false, detail: String(e) };
  }

  // 3. Test chat (if session was created)
  if (sessionId) {
    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: 'health check test' }),
      });
      if (res.ok) {
        checks.chat = { ok: true };
      } else {
        const data = await res.json();
        checks.chat = { ok: false, detail: data.error || `Status ${res.status}` };
      }
    } catch (e) {
      checks.chat = { ok: false, detail: String(e) };
    }

    // 4. Cleanup: delete test session from Redis
    try {
      await redisCommand(`del/session:${sessionId}`);
    } catch {
      // Non-critical
    }
  }

  // 5. Cleanup: remove test lead from Redis
  try {
    // Get all leads to find and remove test ones
    const leadsRes = await redisCommand('lrange/leads:all/0/-1');
    const leads = (leadsRes.result as string[]) || [];
    for (const lead of leads) {
      if (lead.includes(TEST_WHATSAPP) || lead.includes(TEST_WEBSITE)) {
        await redisCommand(`lrem/leads:all/0/${encodeURIComponent(lead)}`);
      }
    }
    // Also remove individual lead keys matching test data
    checks.cleanup = { ok: true };
  } catch (e) {
    checks.cleanup = { ok: false, detail: String(e) };
  }

  const allOk = Object.values(checks).every(c => c.ok);

  return NextResponse.json(
    { status: allOk ? 'healthy' : 'degraded', checks, timestamp: new Date().toISOString() },
    { status: allOk ? 200 : 503 },
  );
}
