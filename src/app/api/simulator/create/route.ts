import { NextRequest, NextResponse } from 'next/server';
import { scrapeWebsite } from '@/lib/scraper';
import { extractPdfFromUrl, analyzePdfWithAI, ExtractedCatalog } from '@/lib/pdf-extractor';
import { generateSystemPromptWithCatalog, getWelcomeMessage } from '@/lib/prompt-generator';
import { createSession, addMessage } from '@/lib/session-manager';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limiter';
import { CreateSessionRequest } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimitResult = checkRateLimit(clientId);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intentá de nuevo en un minuto.' },
        { status: 429 }
      );
    }

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

    // Scrape website with AI
    console.log('[Create] Scraping website:', websiteUrl);
    const scrapedContent = await scrapeWebsite(websiteUrl);
    console.log('[Create] Scraped:', {
      title: scrapedContent.title,
      modelsCount: scrapedContent.models.length,
      servicesCount: scrapedContent.services.length,
    });

    // Extract and analyze PDF if provided
    let catalog: ExtractedCatalog | undefined;
    if (pdfUrl) {
      console.log('[Create] Processing PDF:', pdfUrl);

      const pdfText = await extractPdfFromUrl(pdfUrl);
      console.log('[Create] PDF text extracted, length:', pdfText.length);

      if (pdfText && pdfText.length > 50) {
        // Analyze PDF with AI to extract structured data
        catalog = await analyzePdfWithAI(pdfText);
        console.log('[Create] PDF analyzed:', {
          modelsCount: catalog.models.length,
          pricesCount: catalog.prices.length,
          featuresCount: catalog.features.length,
        });

        // Log model names for debugging
        if (catalog.models.length > 0) {
          console.log('[Create] Models found:', catalog.models.map(m => m.name));
        }
      } else {
        console.log('[Create] PDF text too short or empty');
      }
    }

    // Generate system prompt with all information directly included
    console.log('[Create] Generating system prompt...');
    const systemPrompt = generateSystemPromptWithCatalog({
      scrapedContent,
      catalog,
    });
    console.log('[Create] System prompt length:', systemPrompt.length);

    // Create session
    const session = createSession(scrapedContent.title, systemPrompt);

    // Add welcome message
    const welcomeMessage = getWelcomeMessage(scrapedContent.title);
    console.log('[Create] Welcome message:', welcomeMessage);

    addMessage(session.id, {
      id: uuidv4(),
      role: 'assistant',
      content: welcomeMessage,
      timestamp: new Date(),
    });

    console.log('[Create] Session created:', session.id);
    console.log('[Create] Company:', scrapedContent.title);
    console.log('[Create] Has catalog:', !!catalog);
    console.log('[Create] Catalog models:', catalog?.models.length || 0);

    return NextResponse.json({
      sessionId: session.id,
      companyName: scrapedContent.title,
      welcomeMessage,
      messagesRemaining: session.maxMessages,
      systemPrompt, // Include for client-side chat
    });
  } catch (error) {
    console.error('[Create] Error:', error);
    return NextResponse.json(
      { error: 'Error al crear la sesión. Intentá de nuevo.' },
      { status: 500 }
    );
  }
}
