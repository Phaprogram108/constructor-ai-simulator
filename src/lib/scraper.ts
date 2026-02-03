import * as cheerio from 'cheerio';
import { ScrapedContent } from '@/types';

export async function scrapeWebsite(url: string): Promise<ScrapedContent> {
  try {
    console.log('[Scraper] Fetching URL:', url);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const html = await response.text();
    console.log('[Scraper] HTML length:', html.length);

    const $ = cheerio.load(html);

    // Remove scripts, styles, and hidden elements
    $('script, style, noscript, iframe, nav, footer, header').remove();

    // Extract title - try multiple sources
    let rawTitle = $('title').text().trim();
    console.log('[Scraper] Raw title from <title>:', rawTitle);

    if (!rawTitle || rawTitle.length < 3) {
      rawTitle = $('h1').first().text().trim();
      console.log('[Scraper] Raw title from <h1>:', rawTitle);
    }

    if (!rawTitle || rawTitle.length < 3) {
      rawTitle = $('meta[property="og:site_name"]').attr('content') || '';
      console.log('[Scraper] Raw title from og:site_name:', rawTitle);
    }

    if (!rawTitle || rawTitle.length < 3) {
      rawTitle = $('meta[property="og:title"]').attr('content') || '';
      console.log('[Scraper] Raw title from og:title:', rawTitle);
    }

    const title = cleanCompanyName(rawTitle) || 'Empresa Constructora';
    console.log('[Scraper] Final cleaned title:', title);

    // Extract meta description
    const description = $('meta[name="description"]').attr('content') ||
                       $('meta[property="og:description"]').attr('content') ||
                       $('p').first().text().trim().slice(0, 300) || '';

    // Extract services - look for common patterns
    const services: string[] = [];
    $('h2, h3, h4').each((_, el) => {
      const text = $(el).text().trim().toLowerCase();
      if (text.includes('servicio') || text.includes('ofrecemos') ||
          text.includes('hacemos') || text.includes('construimos')) {
        const nextList = $(el).next('ul, ol');
        if (nextList.length) {
          nextList.find('li').each((_, li) => {
            const service = $(li).text().trim();
            if (service.length > 2 && service.length < 200) {
              services.push(service);
            }
          });
        }
      }
    });

    // Look for model names (casas, cabañas, etc)
    const models: string[] = [];
    const modelPatterns = /(?:modelo|casa|cabaña|vivienda|departamento)\s*[:\s]*([A-Za-z0-9\s]+)/gi;
    const bodyText = $('body').text();
    let match;
    while ((match = modelPatterns.exec(bodyText)) !== null) {
      const model = match[1].trim();
      if (model.length > 2 && model.length < 50 && !models.includes(model)) {
        models.push(model);
      }
    }

    // Extract contact info
    const contactPatterns = {
      phone: /(?:\+?54)?[\s-]?(?:9)?[\s-]?(?:11|[2-9]\d{2,3})[\s-]?\d{3,4}[\s-]?\d{4}/g,
      email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      whatsapp: /(?:whatsapp|wa\.me)[:\s/]*(\+?\d[\d\s-]{8,})/gi,
    };

    const phones: string[] = bodyText.match(contactPatterns.phone) || [];
    const emails: string[] = bodyText.match(contactPatterns.email) || [];
    const allContacts = phones.concat(emails);
    const uniqueContacts = allContacts.filter((v, i, a) => a.indexOf(v) === i);
    const contactInfo = uniqueContacts.slice(0, 5).join(', ');

    // Get clean text content
    const rawText = $('body')
      .text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000);

    return {
      title: cleanCompanyName(title),
      description,
      services: services.slice(0, 10),
      models: models.slice(0, 10),
      contactInfo,
      rawText,
    };
  } catch (error) {
    console.error('Scraping error:', error);
    return {
      title: 'Empresa Constructora',
      description: '',
      services: [],
      models: [],
      contactInfo: '',
      rawText: '',
    };
  }
}

function cleanCompanyName(title: string): string {
  if (!title) return '';

  // Remove common suffixes and clean up
  let cleaned = title
    // Remove "Home | Company" or "Company | Home" patterns
    .replace(/^(home|inicio|principal|bienvenido|welcome)\s*[|–—-]\s*/i, '')
    .replace(/\s*[|–—-]\s*(home|inicio|principal|bienvenido|welcome)$/i, '')
    // Remove everything after pipe/dash if it contains common words
    .replace(/\s*[|–—-]\s*.*?(home|inicio|principal|bienvenido|welcome).*$/i, '')
    // If still has pipe, take the more meaningful part (usually after Home |)
    .replace(/^home\s*[|]\s*/i, '')
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  // If the result is too short or still has issues, try alternative parsing
  if (cleaned.length < 3 || cleaned.toLowerCase() === 'home') {
    // Try to get the part after the pipe
    const parts = title.split(/[|–—-]/);
    if (parts.length > 1) {
      // Find the part that's not "home", "inicio", etc.
      const meaningfulPart = parts.find(p =>
        !/(home|inicio|principal|bienvenido|welcome)/i.test(p.trim())
      );
      if (meaningfulPart && meaningfulPart.trim().length > 2) {
        cleaned = meaningfulPart.trim();
      }
    }
  }

  // Final cleanup - remove weird characters
  cleaned = cleaned
    .replace(/[<>]/g, '')
    .slice(0, 100);

  console.log('[Scraper] cleanCompanyName:', { input: title, output: cleaned });

  return cleaned;
}
