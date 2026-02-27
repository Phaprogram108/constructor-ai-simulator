import { NextRequest, NextResponse } from 'next/server';
import { scrapeWebsite, SCRAPING_FAILED_MARKER } from '@/lib/scraper';
import { analyzePdfWithVision } from '@/lib/pdf-extractor';
import { generateSystemPromptWithCatalog, getWelcomeMessage } from '@/lib/prompt-generator';
import { createSession, addMessage } from '@/lib/session-manager';
import { rateLimit } from '@/lib/rate-limiter';
import { createEnhancedLog, appendEnhancedMessage, ScrapingMetadata } from '@/lib/conversation-logger';
import { CreateSessionRequest } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { trackEvent } from '@/lib/analytics-tracker';

async function validateUrlReachable(url: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AgentIABot/1.0)' },
      });
    } catch {
      response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AgentIABot/1.0)' },
      });
    }

    clearTimeout(timeoutId);

    if (response.status >= 400) {
      return { ok: false, error: `El sitio web devolvió un error (${response.status}). Verificá que la URL sea correcta.` };
    }

    return { ok: true };
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        return { ok: false, error: 'El sitio web no responde. Verificá que esté funcionando.' };
      }
      if (err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
        return { ok: false, error: 'No pudimos encontrar el sitio web. Verificá que la URL sea correcta.' };
      }
    }
    return { ok: false, error: 'No pudimos acceder al sitio web. Verificá la URL e intentá de nuevo.' };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = rateLimit(request, 'create');
    if (rateLimitResponse) return rateLimitResponse;

    const body: CreateSessionRequest = await request.json();
    const { websiteUrl, pdfUrl } = body;

    // Validate URL
    if (!websiteUrl) {
      return NextResponse.json(
        { error: 'La URL del sitio web es requerida' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(websiteUrl);
    } catch {
      return NextResponse.json(
        { error: 'URL inválida. Asegurate de incluir https://' },
        { status: 400 }
      );
    }

    // Validate URL is reachable before scraping
    console.log('[Create] Validating URL reachability:', websiteUrl);
    const urlCheck = await validateUrlReachable(websiteUrl);
    if (!urlCheck.ok) {
      console.warn('[Create] URL validation failed:', urlCheck.error);
      return NextResponse.json(
        { error: urlCheck.error, code: 'URL_UNREACHABLE' },
        { status: 422 }
      );
    }
    console.log('[Create] URL validation passed');

    // Scrape website and analyze PDF in parallel
    console.log('[Create] Starting parallel scraping...');
    console.log('[Create] Website:', websiteUrl);
    if (pdfUrl) console.log('[Create] PDF:', pdfUrl);
    const startTime = Date.now();

    const [scrapedContent, catalog] = await Promise.all([
      scrapeWebsite(websiteUrl).then(result => {
        console.log('[Create] Web scrape completed in', Date.now() - startTime, 'ms');
        console.log('[Create] Scraped:', {
          title: result.title,
          productsCount: result.products.length,
          servicesCount: result.services.length,
        });
        return result;
      }),
      pdfUrl
        ? analyzePdfWithVision(pdfUrl).then(result => {
            console.log('[Create] PDF analysis completed in', Date.now() - startTime, 'ms');
            console.log('[Create] PDF Vision analysis:', {
              modelsCount: result.models.length,
              pricesCount: result.prices.length,
              featuresCount: result.features.length,
              hasRawText: !!result.rawText,
            });
            if (result.models.length > 0) {
              console.log('[Create] Models found:', result.models.map(m => m.name));
              console.log('[Create] First model details:', JSON.stringify(result.models[0], null, 2));
            } else {
              console.log('[Create] WARNING: No models extracted from PDF!');
            }
            return result;
          })
        : Promise.resolve(undefined)
    ]);

    const scrapingDuration = Date.now() - startTime;
    console.log('[Create] Total parallel time:', scrapingDuration, 'ms');

    // Check if scraping failed to extract company name
    if (scrapedContent.title === SCRAPING_FAILED_MARKER) {
      console.error('[Create] Scraping failed - could not extract company information');
      return NextResponse.json(
        {
          error: 'No pudimos procesar este sitio web. El sistema no logró extraer la información de la empresa. Por favor verificá que la URL sea correcta y que el sitio esté funcionando.',
          code: 'SCRAPING_FAILED'
        },
        { status: 422 }
      );
    }

    // Generate system prompt with all information directly included
    console.log('[Create] Generating system prompt...');
    const systemPrompt = generateSystemPromptWithCatalog({
      scrapedContent,
      catalog,
    });
    console.log('[Create] System prompt length:', systemPrompt.length);

    // Create session
    const session = await createSession(scrapedContent.title, systemPrompt);

    // Add welcome message
    const welcomeMessage = getWelcomeMessage(scrapedContent.title);
    console.log('[Create] Welcome message:', welcomeMessage);

    const welcomeMessageObj = {
      id: uuidv4(),
      role: 'assistant' as const,
      content: welcomeMessage,
      timestamp: new Date(),
    };

    await addMessage(session.id, welcomeMessageObj);

    console.log('[Create] Session created:', session.id);
    console.log('[Create] Company:', scrapedContent.title);
    console.log('[Create] Has catalog:', !!catalog);
    console.log('[Create] Catalog models:', catalog?.models.length || 0);

    // Crear enhanced log con metadata de scraping
    const scrapingMetadata: Partial<ScrapingMetadata> = {
      method: 'firecrawl', // Default, el scraper usa firecrawl principalmente
      duration: scrapingDuration,
      modelsFound: scrapedContent.products.length + (catalog?.models?.length || 0),
      whatsappFound: scrapedContent.contactInfo?.toLowerCase().includes('whatsapp') ||
                     scrapedContent.rawText?.toLowerCase().includes('whatsapp') ||
                     false,
      instagramFound: !!scrapedContent.socialLinks?.instagram,
      linktreeExplored: !!scrapedContent.socialLinks?.linktree,
      pdfAnalyzed: !!catalog,
    };

    createEnhancedLog({
      sessionId: session.id,
      companyName: scrapedContent.title,
      companyUrl: websiteUrl,
      scrapingMetadata,
    });

    // Agregar el mensaje de bienvenida al enhanced log
    appendEnhancedMessage(session.id, welcomeMessageObj);

    trackEvent('sessions_created');

    return NextResponse.json({
      sessionId: session.id,
      companyName: scrapedContent.title,
      websiteUrl,
      welcomeMessage,
      messagesRemaining: session.maxMessages,
      // Only expose systemPrompt in development for test scripts
      ...(process.env.NODE_ENV === 'development' && { systemPrompt: session.systemPrompt }),
    });
  } catch (error) {
    console.error('[Create] Error:', error);
    return NextResponse.json(
      { error: 'Error al crear la sesión. Intentá de nuevo.' },
      { status: 500 }
    );
  }
}
