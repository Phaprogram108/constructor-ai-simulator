import { NextRequest, NextResponse } from 'next/server';
import { scrapeWebsite } from '@/lib/scraper';
import { extractPdfFromUrl, formatPdfContent } from '@/lib/pdf-extractor';
import { generateSystemPromptWithClaude, getWelcomeMessage } from '@/lib/prompt-generator';
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

    // Scrape website
    console.log('[Create] Scraping website:', websiteUrl);
    const scrapedContent = await scrapeWebsite(websiteUrl);
    console.log('[Create] Scraped title:', scrapedContent.title);
    console.log('[Create] Scraped description:', scrapedContent.description?.slice(0, 100));

    // Extract PDF content if provided
    let pdfContent = '';
    if (pdfUrl) {
      console.log('[Create] Extracting PDF from URL:', pdfUrl);
      try {
        pdfContent = await extractPdfFromUrl(pdfUrl);
        console.log('[Create] PDF content length:', pdfContent.length);
      } catch (pdfError) {
        console.error('[Create] PDF extraction failed:', pdfError);
        // Continue without PDF - don't fail the whole request
      }
    }

    const formattedPdfContent = formatPdfContent(pdfContent);

    // Generate system prompt using Claude AI
    console.log('[Create] Generating system prompt with Claude...');
    const systemPrompt = await generateSystemPromptWithClaude({
      scrapedContent,
      pdfContent: formattedPdfContent,
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
    console.log('[Create] Company name:', scrapedContent.title);
    console.log('[Create] Max messages:', session.maxMessages);

    return NextResponse.json({
      sessionId: session.id,
      companyName: scrapedContent.title,
      welcomeMessage,
      messagesRemaining: session.maxMessages,
      systemPrompt, // Include for client-side chat
    });
  } catch (error) {
    console.error('Create session error:', error);
    return NextResponse.json(
      { error: 'Error al crear la sesión. Intentá de nuevo.' },
      { status: 500 }
    );
  }
}
