import { NextRequest, NextResponse } from 'next/server';
import Firecrawl from '@mendable/firecrawl-js';
import { rateLimit } from '@/lib/rate-limiter';

let firecrawlInstance: Firecrawl | null = null;

function getFirecrawl(): Firecrawl {
  if (!firecrawlInstance) {
    firecrawlInstance = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY! });
  }
  return firecrawlInstance;
}

const STOPWORDS = new Set([
  'que', 'como', 'cual', 'cuanto', 'tiene', 'tienen', 'hay',
  'son', 'del', 'las', 'los', 'una', 'con', 'por', 'para',
]);

const MAX_CONTENT_TOTAL = 30000;
const MAX_CONTENT_PER_PAGE = 10000;
const MAX_URLS_TO_SCRAPE = 3;

interface ResearchResult {
  found: boolean;
  content: string;
  sourceUrls: string[];
}

export async function POST(request: NextRequest): Promise<NextResponse<ResearchResult>> {
  try {
    const rateLimitResponse = rateLimit(request, 'research');
    if (rateLimitResponse) return rateLimitResponse as NextResponse<ResearchResult>;

    const { websiteUrl, query } = await request.json();

    if (!websiteUrl || !query) {
      return NextResponse.json({ found: false, content: '', sourceUrls: [] });
    }

    console.log('[Research] Starting research for:', { websiteUrl, query });

    // 1. Map the site to get all URLs
    const mapResult = await getFirecrawl().mapUrl(websiteUrl, { limit: 50 });
    if (!mapResult.success || !mapResult.links) {
      console.log('[Research] mapUrl failed or returned no links');
      return NextResponse.json({ found: false, content: '', sourceUrls: [] });
    }

    console.log('[Research] Found', mapResult.links.length, 'URLs in sitemap');

    // 2. Extract keywords from query (filter stopwords and short words)
    const queryWords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w: string) => w.length > 2)
      .filter((w: string) => !STOPWORDS.has(w));

    if (queryWords.length === 0) {
      console.log('[Research] No meaningful keywords extracted from query');
      return NextResponse.json({ found: false, content: '', sourceUrls: [] });
    }

    console.log('[Research] Keywords:', queryWords);

    // 3. Score URLs by keyword relevance in the path
    const scoredUrls = mapResult.links
      .map((url: string) => {
        try {
          const path = new URL(url).pathname.toLowerCase();
          const score = queryWords.reduce((s: number, word: string) => {
            return s + (path.includes(word) ? 1 : 0);
          }, 0);
          return { url, score };
        } catch {
          return { url, score: 0 };
        }
      })
      .filter((u: { url: string; score: number }) => u.score > 0)
      .sort((a: { url: string; score: number }, b: { url: string; score: number }) => b.score - a.score)
      .slice(0, MAX_URLS_TO_SCRAPE);

    if (scoredUrls.length === 0) {
      console.log('[Research] No URLs matched query keywords');
      return NextResponse.json({ found: false, content: '', sourceUrls: [] });
    }

    console.log('[Research] Top URLs to scrape:', scoredUrls.map((u: { url: string; score: number }) => `${u.url} (score: ${u.score})`));

    // 4. Scrape top matching URLs in parallel
    const scrapeResults = await Promise.all(
      scoredUrls.map(async ({ url }: { url: string }) => {
        try {
          const result = await getFirecrawl().scrapeUrl(url, {
            formats: ['markdown'],
            onlyMainContent: true,
            timeout: 15000,
          });
          if (result.success && result.markdown) {
            console.log('[Research] Scraped', url, '- content length:', result.markdown.length);
            return { url, markdown: result.markdown };
          }
          return null;
        } catch (err) {
          console.error('[Research] Failed to scrape', url, err);
          return null;
        }
      })
    );

    const validResults = scrapeResults.filter(
      (r): r is { url: string; markdown: string } => r !== null
    );

    if (validResults.length === 0) {
      console.log('[Research] No URLs returned valid content');
      return NextResponse.json({ found: false, content: '', sourceUrls: [] });
    }

    // 5. Combine content with per-page and total limits
    const content = validResults
      .map(r => `--- ${r.url} ---\n${r.markdown.slice(0, MAX_CONTENT_PER_PAGE)}`)
      .join('\n\n')
      .slice(0, MAX_CONTENT_TOTAL);

    console.log('[Research] Returning content:', content.length, 'chars from', validResults.length, 'pages');

    return NextResponse.json({
      found: true,
      content,
      sourceUrls: validResults.map(r => r.url),
    });
  } catch (error) {
    console.error('[Research] Error:', error);
    return NextResponse.json({ found: false, content: '', sourceUrls: [] });
  }
}
