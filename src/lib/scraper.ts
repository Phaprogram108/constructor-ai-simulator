import * as cheerio from 'cheerio';
import { ScrapedContent } from '@/types';

export async function scrapeWebsite(url: string): Promise<ScrapedContent> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove scripts, styles, and hidden elements
    $('script, style, noscript, iframe, nav, footer, header').remove();

    // Extract title
    const title = $('title').text().trim() ||
                  $('h1').first().text().trim() ||
                  'Empresa Constructora';

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
  // Remove common suffixes and clean up
  return title
    .replace(/\s*[-|–]\s*.*$/, '')
    .replace(/\s*(inicio|home|principal).*$/i, '')
    .trim()
    .slice(0, 100);
}
