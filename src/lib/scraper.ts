import * as cheerio from 'cheerio';
import Anthropic from '@anthropic-ai/sdk';
import { ScrapedContent } from '@/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
    $('script, style, noscript, iframe').remove();

    // Get ALL text content - more comprehensive
    const rawText = $('body')
      .text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 15000); // More content for AI analysis

    // Get meta info
    const metaTitle = $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content') ||
                           $('meta[property="og:description"]').attr('content') || '';
    const ogSiteName = $('meta[property="og:site_name"]').attr('content') || '';

    // Try to get structured data if available
    const jsonLdScripts = $('script[type="application/ld+json"]');
    let structuredData = '';
    jsonLdScripts.each((_, el) => {
      try {
        const content = $(el).html();
        if (content) {
          structuredData += content + '\n';
        }
      } catch {
        // Ignore JSON parse errors
      }
    });

    // Use Claude to extract structured information
    const extractedInfo = await extractWithAI({
      url,
      metaTitle,
      metaDescription,
      ogSiteName,
      rawText,
      structuredData,
    });

    console.log('[Scraper] AI extracted:', {
      title: extractedInfo.title,
      servicesCount: extractedInfo.services.length,
      modelsCount: extractedInfo.models.length,
    });

    return extractedInfo;
  } catch (error) {
    console.error('[Scraper] Error:', error);
    // Fallback to basic scraping if AI fails
    return fallbackScrape(url);
  }
}

interface RawContent {
  url: string;
  metaTitle: string;
  metaDescription: string;
  ogSiteName: string;
  rawText: string;
  structuredData: string;
}

async function extractWithAI(content: RawContent): Promise<ScrapedContent> {
  const prompt = `Analiza el siguiente contenido de un sitio web de una constructora/empresa de viviendas y extrae la información de forma estructurada.

URL: ${content.url}
Título de página: ${content.metaTitle}
Meta descripción: ${content.metaDescription}
Nombre del sitio: ${content.ogSiteName}

CONTENIDO DEL SITIO:
${content.rawText}

${content.structuredData ? `DATOS ESTRUCTURADOS:\n${content.structuredData}` : ''}

Extrae y responde SOLO con un JSON válido (sin explicaciones ni markdown):
{
  "companyName": "nombre de la empresa (NO incluir 'Home', 'Inicio' u otras palabras genéricas)",
  "description": "descripción breve de la empresa y qué hace",
  "services": ["lista de servicios que ofrece"],
  "models": ["lista de modelos/productos con sus nombres COMPLETOS y características si están disponibles (ej: 'Modelo Aurora 85m² - 3 dormitorios')"],
  "prices": ["cualquier precio o rango de precios mencionado"],
  "contactInfo": "teléfonos, emails, WhatsApp encontrados",
  "locations": ["zonas o localidades donde operan"],
  "keyFeatures": ["características destacadas como 'llave en mano', 'financiación', 'steel frame', etc."]
}

IMPORTANTE:
- Si encuentras nombres de modelos específicos, inclúyelos con TODOS sus detalles (metros cuadrados, dormitorios, etc.)
- Si hay precios, inclúyelos exactamente como aparecen
- El nombre de la empresa debe ser SOLO el nombre comercial, sin "Home |" ni similares
- Si no encuentras algún dato, usa un array vacío [] o string vacío ""`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('');

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const extracted = JSON.parse(jsonMatch[0]);

    // Build comprehensive rawText with all extracted info
    const comprehensiveText = buildComprehensiveText(extracted, content.rawText);

    return {
      title: extracted.companyName || cleanCompanyName(content.metaTitle) || 'Empresa Constructora',
      description: extracted.description || content.metaDescription,
      services: Array.isArray(extracted.services) ? extracted.services : [],
      models: Array.isArray(extracted.models) ? extracted.models : [],
      contactInfo: extracted.contactInfo || '',
      rawText: comprehensiveText,
    };
  } catch (error) {
    console.error('[Scraper] AI extraction error:', error);
    // Return basic extraction if AI fails
    return {
      title: cleanCompanyName(content.metaTitle) || 'Empresa Constructora',
      description: content.metaDescription,
      services: [],
      models: [],
      contactInfo: '',
      rawText: content.rawText,
    };
  }
}

function buildComprehensiveText(extracted: Record<string, unknown>, originalText: string): string {
  const parts: string[] = [];

  if (extracted.description) {
    parts.push(`DESCRIPCIÓN: ${extracted.description}`);
  }

  if (Array.isArray(extracted.services) && extracted.services.length > 0) {
    parts.push(`SERVICIOS: ${extracted.services.join(', ')}`);
  }

  if (Array.isArray(extracted.models) && extracted.models.length > 0) {
    parts.push(`MODELOS/PRODUCTOS:\n${extracted.models.map((m: string) => `- ${m}`).join('\n')}`);
  }

  if (Array.isArray(extracted.prices) && extracted.prices.length > 0) {
    parts.push(`PRECIOS: ${extracted.prices.join(', ')}`);
  }

  if (Array.isArray(extracted.locations) && extracted.locations.length > 0) {
    parts.push(`ZONAS DE OPERACIÓN: ${extracted.locations.join(', ')}`);
  }

  if (Array.isArray(extracted.keyFeatures) && extracted.keyFeatures.length > 0) {
    parts.push(`CARACTERÍSTICAS: ${extracted.keyFeatures.join(', ')}`);
  }

  if (extracted.contactInfo) {
    parts.push(`CONTACTO: ${extracted.contactInfo}`);
  }

  // Add original text for additional context
  parts.push(`\nCONTENIDO ADICIONAL:\n${originalText.slice(0, 5000)}`);

  return parts.join('\n\n');
}

async function fallbackScrape(url: string): Promise<ScrapedContent> {
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

    $('script, style, noscript, iframe').remove();

    const rawTitle = $('title').text().trim() ||
                    $('h1').first().text().trim() ||
                    $('meta[property="og:site_name"]').attr('content') || '';

    const description = $('meta[name="description"]').attr('content') ||
                       $('meta[property="og:description"]').attr('content') || '';

    const rawText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 8000);

    return {
      title: cleanCompanyName(rawTitle) || 'Empresa Constructora',
      description,
      services: [],
      models: [],
      contactInfo: '',
      rawText,
    };
  } catch {
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

  let cleaned = title
    .replace(/^(home|inicio|principal|bienvenido|welcome)\s*[|–—-]\s*/i, '')
    .replace(/\s*[|–—-]\s*(home|inicio|principal|bienvenido|welcome)$/i, '')
    .replace(/\s*[|–—-]\s*.*?(home|inicio|principal|bienvenido|welcome).*$/i, '')
    .replace(/^home\s*[|]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length < 3 || cleaned.toLowerCase() === 'home') {
    const parts = title.split(/[|–—-]/);
    if (parts.length > 1) {
      const meaningfulPart = parts.find(p =>
        !/(home|inicio|principal|bienvenido|welcome)/i.test(p.trim())
      );
      if (meaningfulPart && meaningfulPart.trim().length > 2) {
        cleaned = meaningfulPart.trim();
      }
    }
  }

  cleaned = cleaned.replace(/[<>]/g, '').slice(0, 100);

  return cleaned;
}
