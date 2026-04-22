import { NextRequest } from 'next/server';
import { scrapeWebsite, SCRAPING_FAILED_MARKER } from '@/lib/scraper';
import { analyzePdfWithVision } from '@/lib/pdf-extractor';
import { generateSystemPromptWithCatalog, getWelcomeMessage } from '@/lib/prompt-generator';
import { createSession, addMessage } from '@/lib/session-manager';
import { rateLimit } from '@/lib/rate-limiter';
import {
  createEnhancedLog,
  appendEnhancedMessage,
  ScrapingMetadata,
} from '@/lib/conversation-logger';
import { CreateSessionRequest } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { trackEvent } from '@/lib/analytics-tracker';

type Event =
  | { type: 'status'; step: string; message: string }
  | {
      type: 'done';
      sessionId: string;
      companyName: string;
      websiteUrl: string;
      welcomeMessage: string;
      messagesRemaining: number;
    }
  | { type: 'error'; error: string; code?: string };

function sse(encoder: TextEncoder, event: Event): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = rateLimit(request, 'create');
  if (rateLimitResponse) return rateLimitResponse;

  const body: CreateSessionRequest = await request.json();
  const { websiteUrl, pdfUrl } = body;

  if (!websiteUrl) {
    return new Response(JSON.stringify({ error: 'La URL del sitio web es requerida' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    new URL(websiteUrl);
  } catch {
    return new Response(
      JSON.stringify({ error: 'URL inválida. Asegurate de incluir https://' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: Event) => {
        try {
          controller.enqueue(sse(encoder, event));
        } catch {
          // stream already closed
        }
      };

      try {
        emit({
          type: 'status',
          step: 'scraping',
          message: pdfUrl
            ? 'Analizando tu sitio web y catálogo PDF...'
            : 'Analizando tu sitio web...',
        });

        const startTime = Date.now();

        // Keepalive: every 8s, re-emit a status with a "still working" nudge so
        // the client knows the connection is healthy even if scraping is slow.
        const phaseMessages = [
          'Analizando productos y servicios...',
          'Extrayendo información de contacto...',
          'Procesando catálogo...',
          'Organizando la información...',
        ];
        let phaseIdx = 0;
        const keepalive = setInterval(() => {
          emit({
            type: 'status',
            step: 'scraping',
            message: phaseMessages[phaseIdx % phaseMessages.length],
          });
          phaseIdx += 1;
        }, 8000);

        const [scrapedContent, catalog] = await Promise.all([
          scrapeWebsite(websiteUrl),
          pdfUrl ? analyzePdfWithVision(pdfUrl) : Promise.resolve(undefined),
        ]);

        clearInterval(keepalive);

        const scrapingDuration = Date.now() - startTime;
        console.log('[CreateStream] Scrape+PDF duration:', scrapingDuration, 'ms');

        if (scrapedContent.title === SCRAPING_FAILED_MARKER) {
          emit({
            type: 'error',
            error:
              'No pudimos procesar este sitio web. Verificá que la URL sea correcta y que el sitio esté funcionando.',
            code: 'SCRAPING_FAILED',
          });
          controller.close();
          return;
        }

        emit({
          type: 'status',
          step: 'prompt',
          message: 'Generando la personalidad de tu agente...',
        });

        const systemPrompt = generateSystemPromptWithCatalog({ scrapedContent, catalog });

        emit({
          type: 'status',
          step: 'session',
          message: 'Configurando la sesión...',
        });

        const session = await createSession(scrapedContent.title, systemPrompt);

        const welcomeMessage = getWelcomeMessage(scrapedContent.title);
        const welcomeMessageObj = {
          id: uuidv4(),
          role: 'assistant' as const,
          content: welcomeMessage,
          timestamp: new Date(),
        };
        await addMessage(session.id, welcomeMessageObj);

        const scrapingMetadata: Partial<ScrapingMetadata> = {
          method: 'firecrawl',
          duration: scrapingDuration,
          modelsFound:
            scrapedContent.products.length + (catalog?.models?.length || 0),
          whatsappFound:
            scrapedContent.contactInfo?.toLowerCase().includes('whatsapp') ||
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
        appendEnhancedMessage(session.id, welcomeMessageObj);
        trackEvent('sessions_created');

        emit({
          type: 'done',
          sessionId: session.id,
          companyName: scrapedContent.title,
          websiteUrl,
          welcomeMessage,
          messagesRemaining: session.maxMessages,
        });
        controller.close();
      } catch (err) {
        console.error('[CreateStream] Error:', err);
        emit({
          type: 'error',
          error: 'Error al crear la sesión. Intentá de nuevo.',
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
