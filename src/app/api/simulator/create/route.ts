import { NextRequest, NextResponse } from 'next/server';
import { scrapeWebsite } from '@/lib/scraper';
import { extractPdfFromUrl, formatPdfContent } from '@/lib/pdf-extractor';
import { generateSystemPrompt, getWelcomeMessage } from '@/lib/prompt-generator';
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
    console.log('Scraping website:', websiteUrl);
    const scrapedContent = await scrapeWebsite(websiteUrl);

    // Extract PDF content if provided
    let pdfContent = '';
    if (pdfUrl) {
      console.log('Extracting PDF from URL:', pdfUrl);
      pdfContent = await extractPdfFromUrl(pdfUrl);
    }

    const formattedPdfContent = formatPdfContent(pdfContent);

    // Generate system prompt
    const systemPrompt = generateSystemPrompt({
      scrapedContent,
      pdfContent: formattedPdfContent,
    });

    // Create session
    const session = createSession(scrapedContent.title, systemPrompt);

    // Add welcome message
    const welcomeMessage = getWelcomeMessage(scrapedContent.title);
    addMessage(session.id, {
      id: uuidv4(),
      role: 'assistant',
      content: welcomeMessage,
      timestamp: new Date(),
    });

    console.log('Session created:', session.id, 'Company:', scrapedContent.title);

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
