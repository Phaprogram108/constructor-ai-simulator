import { NextRequest, NextResponse } from 'next/server';
import { scrapeWebsite } from '@/lib/scraper';

// Debug endpoint to test scraping without full session creation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { websiteUrl } = body;

    if (!websiteUrl) {
      return NextResponse.json({ error: 'URL required' }, { status: 400 });
    }

    console.log('[DEBUG] Starting scrape for:', websiteUrl);

    const scrapedContent = await scrapeWebsite(websiteUrl);

    console.log('[DEBUG] Scraped content:', {
      title: scrapedContent.title,
      description: scrapedContent.description?.slice(0, 100),
      servicesCount: scrapedContent.services.length,
      productsCount: scrapedContent.products.length,
      rawTextLength: scrapedContent.rawText.length,
    });

    return NextResponse.json({
      success: true,
      scrapedContent: {
        title: scrapedContent.title,
        description: scrapedContent.description,
        services: scrapedContent.services,
        products: scrapedContent.products,
        models: scrapedContent.models || [],
        contactInfo: scrapedContent.contactInfo,
        rawTextPreview: scrapedContent.rawText.slice(0, 500),
      },
      welcomeMessagePreview: `¡Hola! Soy Sofia, asesora de ${scrapedContent.title}. ¿En qué puedo ayudarte hoy?`,
    });
  } catch (error) {
    console.error('[DEBUG] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
