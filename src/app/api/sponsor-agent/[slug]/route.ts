import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-manager';

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

interface CachedSponsorAgent {
  sessionId: string;
  companyName: string;
  welcomeMessage: string;
  websiteUrl?: string;
  generatedAt?: string;
  tier?: string;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;

  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return NextResponse.json({ error: 'not_cached' }, { status: 404 });
  }

  try {
    const key = `sponsor-agent:${slug}`;
    const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      console.warn(`[sponsor-agent] Redis GET non-OK for slug=${slug}: ${res.status}`);
      return NextResponse.json({ error: 'not_cached' }, { status: 404 });
    }

    const data = await res.json();
    const raw = data?.result;
    if (!raw) {
      return NextResponse.json({ error: 'not_cached' }, { status: 404 });
    }

    let parsed: CachedSponsorAgent;
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return NextResponse.json({ error: 'not_cached' }, { status: 404 });
    }

    // Verify the underlying session is still alive — otherwise the
    // shortcut would push the user into a 404 demo page.
    const session = await getSession(parsed.sessionId);
    if (!session) {
      return NextResponse.json({ error: 'not_cached' }, { status: 404 });
    }

    return NextResponse.json({
      sessionId: parsed.sessionId,
      companyName: parsed.companyName,
      welcomeMessage: parsed.welcomeMessage,
    });
  } catch (err) {
    console.error('[sponsor-agent] Error:', err);
    return NextResponse.json({ error: 'not_cached' }, { status: 404 });
  }
}
