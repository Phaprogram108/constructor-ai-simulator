import { NextRequest, NextResponse } from 'next/server';
import { scrapeWebsite, SCRAPING_FAILED_MARKER, isScrapeEmpty } from '@/lib/scraper';
import { generateSystemPromptWithCatalog, getWelcomeMessage } from '@/lib/prompt-generator';
import { createSession } from '@/lib/session-manager';

const PRELOAD_TTL_SECONDS = 72 * 60 * 60; // 72h
const PRELOAD_MAX_MESSAGES = 1000;

// Session can take 60-120s for slow sites; route allowed up to 300s.
export const maxDuration = 300;

interface PreloadBody {
  slug?: string;
  websiteUrl?: string;
  companyName?: string;
  tier?: string;
}

interface CachedSponsorAgent {
  sessionId: string;
  companyName: string;
  welcomeMessage: string;
  websiteUrl: string;
  generatedAt: string;
  tier: string;
}

function getRedisEnv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.LEADS_API_KEY;
  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: PreloadBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { slug, websiteUrl, companyName, tier } = body;
  if (!slug || !websiteUrl || !companyName) {
    return NextResponse.json(
      { error: 'Missing required fields: slug, websiteUrl, companyName' },
      { status: 400 },
    );
  }

  try {
    new URL(websiteUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid websiteUrl' }, { status: 400 });
  }

  try {
    const startTime = Date.now();
    console.log(`[Preload] Starting for slug=${slug} url=${websiteUrl}`);

    const scrapedContent = await scrapeWebsite(websiteUrl);

    if (scrapedContent.title === SCRAPING_FAILED_MARKER) {
      return NextResponse.json(
        { error: 'Scraping failed', code: 'SCRAPING_FAILED' },
        { status: 500 },
      );
    }
    if (isScrapeEmpty(scrapedContent)) {
      return NextResponse.json(
        { error: 'Scrape came back empty', code: 'SCRAPING_EMPTY' },
        { status: 500 },
      );
    }

    const systemPrompt = generateSystemPromptWithCatalog({ scrapedContent });
    const welcomeMessage = getWelcomeMessage(scrapedContent.title);

    const session = await createSession(scrapedContent.title, systemPrompt, {
      ttlSeconds: PRELOAD_TTL_SECONDS,
      maxMessages: PRELOAD_MAX_MESSAGES,
      preloadedWelcome: welcomeMessage,
    });

    // Mapping slug -> agent metadata, cached separately.
    const redis = getRedisEnv();
    const cachedPayload: CachedSponsorAgent = {
      sessionId: session.id,
      companyName: scrapedContent.title,
      welcomeMessage,
      websiteUrl,
      generatedAt: new Date().toISOString(),
      tier: tier || 'UNKNOWN',
    };

    if (redis) {
      const key = `sponsor-agent:${slug}`;
      const setUrl = `${redis.url}/set/${encodeURIComponent(key)}/${encodeURIComponent(
        JSON.stringify(cachedPayload),
      )}?EX=${PRELOAD_TTL_SECONDS}`;
      const res = await fetch(setUrl, {
        headers: { Authorization: `Bearer ${redis.token}` },
      });
      if (!res.ok) {
        console.warn(`[Preload] Redis SET failed for slug=${slug}: ${res.status}`);
      }
    } else {
      console.warn('[Preload] Redis not configured — sponsor-agent mapping not persisted');
    }

    const totalMs = Date.now() - startTime;
    console.log(`[Preload] Done slug=${slug} sessionId=${session.id} in ${totalMs}ms`);

    return NextResponse.json({
      sessionId: session.id,
      companyName: scrapedContent.title,
      welcomeMessage,
      durationMs: totalMs,
    });
  } catch (err) {
    console.error('[Preload] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Preload failed: ${message}` }, { status: 500 });
  }
}
