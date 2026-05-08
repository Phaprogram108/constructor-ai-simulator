import * as cheerio from 'cheerio';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { chromium, Browser, Page } from 'playwright';
import { ScrapedContent } from '@/types';
import { scrapeWithFirecrawl } from './firecrawl';
import type { VisionScrapedContent } from './vision-scraper';

// Inicialización lazy para evitar errores durante el build
let anthropicInstance: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicInstance) {
    anthropicInstance = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicInstance;
}

let openaiInstance: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiInstance;
}

// Feature flag: cuando true, usa OpenAI gpt-5.1 para extracción AI.
// Default false → mantiene comportamiento actual con Anthropic Sonnet 4.
const USE_OPENAI_SCRAPER = process.env.USE_OPENAI_SCRAPER === 'true';

// Marcador especial cuando el scraping falla - NO usar como nombre real
export const SCRAPING_FAILED_MARKER = '__SCRAPING_FAILED__';

/**
 * Returns true when the scraper technically succeeded (didn't throw) but
 * extracted so little content that the generated agent would be a hollow
 * "consult by WhatsApp" shell. We detected this on habitatypaisaje.com.ar
 * during E2E testing — the scrape returned in 8s with 0 products and
 * barely any raw text, and the resulting agent could not answer a single
 * real question.
 */
export function isScrapeEmpty(content: ScrapedContent): boolean {
  if (!content || content.title === SCRAPING_FAILED_MARKER) return true;
  const productsCount = content.products?.length ?? 0;
  const servicesCount = content.services?.length ?? 0;
  const rawTextLen = content.rawText?.length ?? 0;
  const descriptionLen = content.description?.length ?? 0;
  // Require at least one of: some products, some services, or meaningful
  // descriptive text. The 500-char threshold on rawText is a heuristic
  // tuned from real scrapes — valid sites come back with 5k-15k chars.
  if (productsCount > 0) return false;
  if (servicesCount > 0) return false;
  if (rawTextLen >= 500) return false;
  if (descriptionLen >= 80) return false;
  return true;
}

// Helper: extraer nombre de empresa de la URL como último fallback
function extractNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    const namePart = domain.split('.')[0];
    return prettifyBrandName(namePart);
  } catch {
    return 'Empresa';
  }
}

/**
 * Turn a raw brand string (slug, camelCase, ALLCAPS) into a human-readable
 * brand name. Handles three common patterns seen in the wild:
 *   - camelCase / PascalCase → "TuCasaAlValor" → "Tu Casa Al Valor"
 *   - ALLCAPS              → "ECOSAN S.A" is left alone (acronyms OK)
 *   - lowercase slug w/ Spanish connector → "habitatypaisaje" → "Habitat y Paisaje"
 *
 * The goal is "good enough" readability — never guess too hard. If nothing
 * obvious matches, we just title-case the whole thing.
 */
export function prettifyBrandName(raw: string): string {
  if (!raw) return '';

  const trimmed = raw.trim();
  // Already has spaces or looks acronym-y — leave alone, only title-case if
  // the caller explicitly asks (acronyms like ECOSAN S.A must survive).
  if (/\s/.test(trimmed)) return trimmed;

  // camelCase / PascalCase — insert space on lower→upper boundaries.
  if (/[a-z][A-Z]/.test(trimmed)) {
    return trimmed
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  // All lowercase (typical slug from domain). Try to split on common Spanish
  // connectors when they clearly sit in the middle of the string and are
  // flanked by letters — this is best-effort, not perfect.
  if (trimmed === trimmed.toLowerCase() && trimmed.length >= 8) {
    // Prefer longer connectors first to avoid "de" matching inside "deposito".
    const connectors = ['ypaisaje', 'ydesarrollo', 'yarquitectura', 'yasociados', 'yconstruccion', 'yconsulting', 'ydiseno', 'yobras'];
    for (const suffix of connectors) {
      if (trimmed.endsWith(suffix) && trimmed.length > suffix.length) {
        const stem = trimmed.slice(0, -suffix.length);
        const rest = suffix.slice(1); // drop the leading "y"
        return titleCase(`${stem} y ${rest}`);
      }
    }
    // Generic middle-of-string "y" connector (habitatypaisaje).
    // Require the stem and the rest to each be >= 4 chars to avoid weird splits.
    const yMatch = trimmed.match(/^([a-z]{4,})y([a-z]{4,})$/);
    if (yMatch) {
      return titleCase(`${yMatch[1]} y ${yMatch[2]}`);
    }
  }

  // Fallback: just capitalize the first letter, leave the rest as-is.
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

// Spanish connectors that should stay lowercase in brand names, unless
// they are the first word of the name.
const LOWERCASE_CONNECTORS = new Set(['y', 'e', 'de', 'del', 'la', 'el', 'los', 'las', 'al']);

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w, i) => {
      if (w.length === 0) return w;
      if (i > 0 && LOWERCASE_CONNECTORS.has(w.toLowerCase())) return w.toLowerCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

// Keywords que indican páginas con modelos/productos
const MODEL_KEYWORDS = [
  'modelo', 'modelos', 'casa', 'casas', 'vivienda', 'viviendas',
  'proyecto', 'proyectos', 'producto', 'productos', 'catalogo',
  'portfolio', 'obras', 'construcciones', 'planos', 'diseños',
  'cabana', 'cabañas', 'duplex', 'departamento', 'loft'
];

// Timeout para navegación
const NAV_TIMEOUT = 60000;  // 60 segundos para SPAs pesados
const MAX_PAGES_TO_CRAWL = 8; // Reducido de 15 para mejor performance
const WAIT_AFTER_LOAD = 2000; // Reducido de 5000ms

// Scroll gradual para activar lazy loading en SPAs
async function scrollToLoadContent(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
    const scrollHeight = document.body.scrollHeight;
    const viewportHeight = window.innerHeight;

    // Scroll gradual hacia abajo
    for (let y = 0; y < scrollHeight; y += viewportHeight) {
      window.scrollTo(0, y);
      await delay(300);
    }

    // Scroll al final para asegurar
    window.scrollTo(0, document.body.scrollHeight);
    await delay(500);

    // Volver arriba
    window.scrollTo(0, 0);
  });
}

// Hard timeout para evitar que la generación del agente bloquee al usuario
// más de 2 minutos. Si se excede, devolvemos lo que haya conseguido
// basicFetchScrape como último recurso.
const SCRAPE_HARD_TIMEOUT_MS = 120_000;

/**
 * Runs at the very end of every scrape path to clean up the company title
 * before it flows into the system prompt and the welcome message. We learned
 * in run-1/run-2 that extracted.companyName (coming from GPT extraction)
 * can arrive as a joined slug like "TuCasaAlValor" that never passes through
 * cleanCompanyName, so we apply the same prettifier universally here.
 *
 * We also guard against hallucinated / SEO-spam titles. Real construction
 * brand names almost never exceed ~50 characters. During the run-4 test we
 * saw conterhouse.com.ar return a Swedish casino-spam headline ("AI och
 * maskininlärning revolutionerar svenska nätcasinon för erfarna spelare")
 * because the site had injected SEO spam. When that happens we reject the
 * AI-extracted title and fall back to the domain — ugly but safe.
 */
const TITLE_SPAM_KEYWORDS = [
  'casino', 'casinos', 'betting', 'bookmaker', 'gambling', 'bitcoin',
  'crypto', 'viagra', 'porn', 'xxx', 'escort',
  // Non-Spanish stop words that signal a wrong-language scrape
  'och', 'för', 'erfarna', 'svenska', 'maskin',
];
const TITLE_MAX_LEN = 60;

function isSuspectTitle(title: string): boolean {
  if (!title) return true;
  if (title.length > TITLE_MAX_LEN) return true;
  const lower = title.toLowerCase();
  return TITLE_SPAM_KEYWORDS.some((kw) => lower.includes(kw));
}

function applyTitlePostProcessing(content: ScrapedContent, url: string): ScrapedContent {
  if (!content || content.title === SCRAPING_FAILED_MARKER) return content;

  let title = content.title;

  if (isSuspectTitle(title)) {
    console.warn(
      `[Scraper] Suspect title rejected: "${title.slice(0, 100)}" — falling back to domain name`,
    );
    title = extractNameFromUrl(url);
  }

  const pretty = prettifyBrandName(title);
  if (pretty && pretty !== content.title) {
    console.log(`[Scraper] Title cleaned: "${content.title}" -> "${pretty}"`);
    return { ...content, title: pretty };
  }
  return content;
}

export async function scrapeWebsite(url: string): Promise<ScrapedContent> {
  console.log('[Scraper] Starting scrape for:', url);

  const timeoutPromise = new Promise<ScrapedContent>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Scrape hard timeout (${SCRAPE_HARD_TIMEOUT_MS}ms)`)),
      SCRAPE_HARD_TIMEOUT_MS,
    ),
  );

  try {
    const raw = await Promise.race([scrapeWebsiteInner(url), timeoutPromise]);
    return applyTitlePostProcessing(raw, url);
  } catch (err) {
    console.warn('[Scraper] Hard timeout or fatal error, using basic fetch:', err);
    try {
      // Give the fallback at most 20s — we already blew through the main
      // timeout, so we can't afford another minute or more of Anthropic
      // waiting (run-4 saw one URL total out at 7.5 min because this path
      // had no timeout at all).
      const fallbackTimeout = new Promise<ScrapedContent>((_, reject) =>
        setTimeout(() => reject(new Error('basicFetch fallback timeout (20s)')), 20_000),
      );
      return applyTitlePostProcessing(
        await Promise.race([basicFetchScrape(url), fallbackTimeout]),
        url,
      );
    } catch (fallbackErr) {
      console.error('[Scraper] Basic fetch also failed:', fallbackErr);
      return {
        title: SCRAPING_FAILED_MARKER,
        description: '',
        products: [],
        services: [],
        socialLinks: {},
        contactInfo: '',
        rawText: '',
        profile: {
          identity: '',
          offering: '',
          differentiators: '',
          terminology: {
            productsLabel: 'productos',
            processLabel: 'proceso',
          },
        },
      };
    }
  }
}

async function scrapeWebsiteInner(url: string): Promise<ScrapedContent> {
  let result: ScrapedContent | null = null;

  // 1. Intentar con Firecrawl primero (mejor para SPAs)
  try {
    console.log('[Scraper] Trying Firecrawl...');
    result = await scrapeWithFirecrawl(url);

    if (result.products.length > 0) {
      console.log('[Scraper] Firecrawl success! Products:', result.products.length);
    } else {
      console.log('[Scraper] Firecrawl returned 0 products, trying Playwright...');
      result = null;
    }
  } catch (error) {
    console.error('[Scraper] Firecrawl failed:', error);
  }

  // 2. Fallback a Playwright
  if (!result) {
    try {
      console.log('[Scraper] Trying Playwright...');
      result = await deepScrapeWithPlaywright(url);
    } catch (error) {
      console.error('[Scraper] Playwright scraping failed:', error);
    }
  }

  // 3. Fallback a fetch basico
  if (!result) {
    console.log('[Scraper] Falling back to basic fetch scraping');
    result = await basicFetchScrape(url);
  }

  // Vision fallback y Linktree exploration se movieron al flujo on-demand
  // del chat (/api/chat/research). Los dejamos fuera de la generación inicial
  // porque suman 30-80s y rara vez aportan valor crítico para el primer turno.

  return result;
}

/**
 * Mergea resultados de Vision con los existentes.
 * Exportada porque el flujo de research on-demand (/api/chat/research)
 * la sigue usando para fusionar información extra cuando aplica.
 */
export function mergeVisionResults(
  original: ScrapedContent,
  vision: VisionScrapedContent
): ScrapedContent {
  const result = { ...original };

  // Si Vision encontró más modelos, usar esos (backwards compat: also populate models)
  const originalModelsCount = (original.models || []).length;
  if (vision.models.length > originalModelsCount) {
    result.models = vision.models.map(m =>
      `${m.name}${m.sqMeters ? ` - ${m.sqMeters}m²` : ''}${m.bedrooms ? ` - ${m.bedrooms} dorm` : ''}${m.bathrooms ? ` - ${m.bathrooms} baños` : ''}${m.price ? ` - ${m.price}` : ''}`
    );
    // Also update products array from vision results
    result.products = vision.models.map(m => ({
      name: m.name,
      specs: {
        ...(m.sqMeters ? { superficie: m.sqMeters } : {}),
        ...(m.bedrooms ? { dormitorios: m.bedrooms } : {}),
        ...(m.bathrooms ? { baños: m.bathrooms } : {}),
        ...(m.price ? { precio: m.price } : {}),
      },
      features: m.features || [],
    }));
    console.log(`[Scraper] Vision encontró más modelos: ${vision.models.length} vs ${originalModelsCount}`);
  }

  // Agregar rawText de Vision al existente
  if (vision.rawExtractedText) {
    result.rawText = result.rawText + '\n\n--- INFORMACIÓN EXTRAÍDA CON VISION ---\n' + vision.rawExtractedText;
  }

  // Agregar especificaciones al rawText
  if (vision.specifications.length > 0) {
    const specsText = vision.specifications.map(s => `${s.label}: ${s.value}`).join('\n');
    result.rawText = result.rawText + '\n\n--- ESPECIFICACIONES TÉCNICAS ---\n' + specsText;
  }

  // Agregar FAQs al rawText
  if (vision.faq.length > 0) {
    const faqText = vision.faq.map(f => `P: ${f.question}\nR: ${f.answer}`).join('\n\n');
    result.rawText = result.rawText + '\n\n--- FAQ EXTRAÍDO ---\n' + faqText;
  }

  return result;
}

async function deepScrapeWithPlaywright(url: string): Promise<ScrapedContent> {
  let browser: Browser | null = null;

  try {
    console.log('[Scraper] Launching Playwright browser');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 }
    });

    const page = await context.newPage();

    // 1. Navegar a la homepage con networkidle para SPAs
    console.log('[Scraper] Navigating to homepage:', url);
    try {
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: NAV_TIMEOUT
      });
    } catch {
      // Fallback si networkidle timeout (sitios con polling constante)
      console.log('[Scraper] networkidle timeout, retrying with domcontentloaded');
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: NAV_TIMEOUT
      });
    }

    // Esperar que JS renderice el contenido (importante para sitios Wix/React)
    console.log('[Scraper] Waiting for JS to render...');
    await page.waitForTimeout(WAIT_AFTER_LOAD);

    // Scroll para activar lazy loading
    console.log('[Scraper] Scrolling to trigger lazy loading...');
    await scrollToLoadContent(page);

    // Esperar contenido adicional después del scroll
    await page.waitForTimeout(WAIT_AFTER_LOAD);

    // Intentar esperar a que haya contenido visible
    try {
      await page.waitForSelector('body', { state: 'visible', timeout: 5000 });
    } catch {
      // Continuar aunque no se cumpla
    }

    // 2. Extraer contenido de la homepage
    let homepageContent = await extractPageContent(page);
    console.log('[Scraper] Homepage content length:', homepageContent.text.length);

    // Retry si homepage tiene muy poco contenido (SPA que no cargó bien)
    if (homepageContent.text.length < 500) {
      console.log('[Scraper] Low content detected, retrying with more wait time...');
      await page.waitForTimeout(5000); // Esperar 5 segundos más
      await scrollToLoadContent(page);
      await page.waitForTimeout(3000);
      homepageContent = await extractPageContent(page);
      console.log('[Scraper] After retry, content length:', homepageContent.text.length);
    }

    // 3. Extraer todos los links internos
    const baseUrl = new URL(url);
    const internalLinks = await extractInternalLinks(page, baseUrl);
    console.log('[Scraper] Found internal links:', internalLinks.length);

    // 4. Filtrar links que parecen tener modelos
    const modelLinks = filterModelLinks(internalLinks);
    console.log('[Scraper] Model-related links:', modelLinks);

    // 5. Visitar cada página de modelos y extraer contenido
    const allPageContents: PageContent[] = [homepageContent];

    for (const link of modelLinks.slice(0, MAX_PAGES_TO_CRAWL)) {
      try {
        console.log('[Scraper] Crawling:', link);
        try {
          await page.goto(link, {
            waitUntil: 'networkidle',
            timeout: NAV_TIMEOUT
          });
        } catch {
          // Fallback si networkidle falla
          await page.goto(link, {
            waitUntil: 'domcontentloaded',
            timeout: NAV_TIMEOUT
          });
        }
        // Esperar para que JS renderice
        await page.waitForTimeout(WAIT_AFTER_LOAD);
        // Scroll para lazy loading
        await scrollToLoadContent(page);

        const pageContent = await extractPageContent(page);
        console.log(`[Scraper] Page ${link} content length:`, pageContent.text.length);

        // Solo agregar si tiene contenido sustancial
        if (pageContent.text.length > 100) {
          allPageContents.push(pageContent);
        }
      } catch (error) {
        console.error(`[Scraper] Error crawling ${link}:`, error);
      }
    }

    // 6. Combinar todo el contenido
    const combinedContent = combinePageContents(allPageContents);
    console.log('[Scraper] Total combined content length:', combinedContent.length);

    // 7. Extraer metadatos de la homepage
    const metaTitle = await page.title() || '';
    const metaDescription = await page.$eval(
      'meta[name="description"]',
      el => el.getAttribute('content') || ''
    ).catch(() => '');
    const ogSiteName = await page.$eval(
      'meta[property="og:site_name"]',
      el => el.getAttribute('content') || ''
    ).catch(() => '');

    // 8. Extraer datos estructurados JSON-LD
    const structuredData = await extractJsonLd(page);

    await browser.close();
    browser = null;

    // 9. Usar Claude para extraer información estructurada
    const extractedInfo = await extractWithAI({
      url,
      metaTitle,
      metaDescription,
      ogSiteName,
      rawText: combinedContent,
      structuredData,
      pagesScraped: allPageContents.length,
    });

    console.log('[Scraper] AI extracted:', {
      title: extractedInfo.title,
      servicesCount: extractedInfo.services.length,
      productsCount: extractedInfo.products.length,
    });

    return extractedInfo;

  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

interface PageContent {
  url: string;
  title: string;
  text: string;
  headings: string[];
}

async function extractPageContent(page: Page): Promise<PageContent> {
  const url = page.url();
  const title = await page.title();

  // Extraer texto visible
  const text = await page.evaluate(() => {
    // Remover elementos no deseados
    const elementsToRemove = document.querySelectorAll('script, style, noscript, iframe, svg, nav, footer, header');
    elementsToRemove.forEach(el => el.remove());

    return document.body.innerText || '';
  });

  // Extraer headings para estructura
  const headings = await page.evaluate(() => {
    const h1s = Array.from(document.querySelectorAll('h1, h2, h3'));
    return h1s.map(h => h.textContent?.trim() || '').filter(t => t.length > 0);
  });

  return { url, title, text, headings };
}

async function extractInternalLinks(page: Page, baseUrl: URL): Promise<string[]> {
  // Esperar que el DOM se estabilice para links dinámicos
  await page.waitForTimeout(1000);

  // Extraer links tradicionales de <a href>
  const links = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    return anchors
      .map(a => a.getAttribute('href'))
      .filter((href): href is string => href !== null);
  });

  // Extraer links dinámicos de elementos con data-link, data-href, data-url
  const dynamicLinks = await page.evaluate(() => {
    const selectors = [
      '[data-link]',
      '[data-href]',
      '[data-url]',
      '[data-page-url]',
      '[onclick*="location"]',
      '[onclick*="href"]',
      'button[data-link]',
      '[role="link"]'
    ];
    const elements = document.querySelectorAll(selectors.join(', '));
    return Array.from(elements)
      .map(el => {
        return el.getAttribute('data-link') ||
               el.getAttribute('data-href') ||
               el.getAttribute('data-url') ||
               el.getAttribute('data-page-url') ||
               el.getAttribute('href');
      })
      .filter((href): href is string => href !== null && href.length > 0);
  });

  // Combinar todos los links
  const allLinks = [...links, ...dynamicLinks];

  // Normalizar y filtrar links internos
  const normalizedLinks = new Set<string>();

  for (const link of allLinks) {
    try {
      let fullUrl: URL;

      if (link.startsWith('http')) {
        fullUrl = new URL(link);
      } else if (link.startsWith('/')) {
        fullUrl = new URL(link, baseUrl.origin);
      } else if (!link.startsWith('#') && !link.startsWith('mailto:') && !link.startsWith('tel:') && !link.startsWith('javascript:')) {
        fullUrl = new URL(link, baseUrl.origin);
      } else {
        continue;
      }

      // Solo links del mismo dominio
      if (fullUrl.host === baseUrl.host) {
        // Limpiar hash y query params para evitar duplicados
        fullUrl.hash = '';
        normalizedLinks.add(fullUrl.href);
      }
    } catch {
      // Ignorar URLs inválidas
    }
  }

  return Array.from(normalizedLinks);
}

function filterModelLinks(links: string[]): string[] {
  const modelLinks: string[] = [];
  const seenPaths = new Set<string>();

  for (const link of links) {
    try {
      const url = new URL(link);
      const path = url.pathname.toLowerCase();

      // Evitar duplicados por path
      if (seenPaths.has(path)) continue;

      // Evitar la homepage
      if (path === '/' || path === '') continue;

      // Evitar links de navegación común
      if (/\/(contacto|contact|about|nosotros|quienes-somos|blog|news|login|registro|cart|checkout)/i.test(path)) {
        continue;
      }

      // Buscar keywords de modelos en el path
      const hasModelKeyword = MODEL_KEYWORDS.some(kw => path.includes(kw));

      if (hasModelKeyword) {
        seenPaths.add(path);
        modelLinks.push(link);
      }
    } catch {
      // Ignorar URLs inválidas
    }
  }

  // Si no encontramos links específicos de modelos, incluir algunas páginas principales
  if (modelLinks.length === 0) {
    console.log('[Scraper] No model-specific links found, including general pages');
    const generalLinks: string[] = [];

    for (const link of links) {
      try {
        const url = new URL(link);
        const path = url.pathname.toLowerCase();

        if (seenPaths.has(path)) continue;
        if (path === '/' || path === '') continue;

        // Incluir páginas que no sean de navegación
        if (!/\/(contacto|contact|login|registro|cart|checkout|privacy|terms|legal)/i.test(path)) {
          seenPaths.add(path);
          generalLinks.push(link);
        }
      } catch {
        // Ignorar
      }
    }

    return generalLinks.slice(0, 5);
  }

  return modelLinks;
}

async function extractJsonLd(page: Page): Promise<string> {
  try {
    const jsonLdData = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      return scripts
        .map(s => s.textContent || '')
        .filter(t => t.length > 0)
        .join('\n');
    });
    return jsonLdData;
  } catch {
    return '';
  }
}

function combinePageContents(pages: PageContent[]): string {
  const parts: string[] = [];

  for (const page of pages) {
    parts.push(`--- PÁGINA: ${page.title || page.url} ---`);
    if (page.headings.length > 0) {
      parts.push(`Secciones: ${page.headings.join(' | ')}`);
    }
    parts.push(page.text.replace(/\s+/g, ' ').trim());
    parts.push('');
  }

  // Limitar contenido total para no exceder límites de tokens
  return parts.join('\n').slice(0, 30000);
}

interface RawContent {
  url: string;
  metaTitle: string;
  metaDescription: string;
  ogSiteName: string;
  rawText: string;
  structuredData: string;
  pagesScraped?: number;
}

async function extractWithAnthropic(prompt: string): Promise<string> {
  const response = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('');
}

async function extractWithOpenAI(prompt: string): Promise<string> {
  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-5.1',
    messages: [{ role: 'user', content: prompt }],
    max_completion_tokens: 4000,
    temperature: 0.7,
  });
  return completion.choices[0]?.message?.content || '';
}

async function extractWithAI(content: RawContent): Promise<ScrapedContent> {
  const prompt = `Analiza el siguiente contenido de un sitio web de una constructora/empresa de viviendas y extrae la información de forma estructurada.

URL: ${content.url}
Título de página: ${content.metaTitle}
Meta descripción: ${content.metaDescription}
Nombre del sitio: ${content.ogSiteName}
${content.pagesScraped ? `Páginas analizadas: ${content.pagesScraped}` : ''}

CONTENIDO DEL SITIO (múltiples páginas combinadas):
${content.rawText}

${content.structuredData ? `DATOS ESTRUCTURADOS:\n${content.structuredData}` : ''}

Extrae y responde SOLO con un JSON válido (sin explicaciones ni markdown):
{
  "companyName": "nombre de la empresa (NO incluir 'Home', 'Inicio' u otras palabras genéricas)",
  "description": "descripción breve de la empresa y qué hace",
  "services": ["lista de servicios que ofrece"],
  "models": ["lista COMPLETA de modelos/productos - incluir TODOS los que encuentres con formato: 'Nombre del Modelo - X m² - Y dormitorios - Z baños - características'"],
  "prices": ["cualquier precio o rango de precios mencionado con el modelo correspondiente"],
  "contactInfo": "teléfonos, emails, WhatsApp encontrados",
  "locations": ["zonas o localidades donde operan"],
  "keyFeatures": ["características destacadas como 'llave en mano', 'financiación', 'steel frame', etc."]
}

IMPORTANTE:
- BUSCA EN TODO EL CONTENIDO los nombres de modelos que aparezcan en el sitio web (NO inventes nombres)
- Para cada modelo incluye TODOS los detalles: metros cuadrados, dormitorios, baños, características
- Si hay precios, inclúyelos exactamente como aparecen junto al modelo
- El nombre de la empresa debe ser SOLO el nombre comercial, sin "Home |" ni similares
- Si no encuentras algún dato, usa un array vacío [] o string vacío ""
- ES CRÍTICO que extraigas la lista completa de modelos con sus especificaciones

Responde SOLO con el JSON, sin texto adicional ni bloques de código.`;

  try {
    const responseText = USE_OPENAI_SCRAPER
      ? await extractWithOpenAI(prompt)
      : await extractWithAnthropic(prompt);

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const extracted = JSON.parse(jsonMatch[0]);

    // Build comprehensive rawText with all extracted info
    const comprehensiveText = buildComprehensiveText(extracted, content.rawText);

    const modelsArray: string[] = Array.isArray(extracted.models) ? extracted.models : [];
    return {
      title: extracted.companyName || cleanCompanyName(content.metaTitle) || extractNameFromUrl(content.url),
      description: extracted.description || content.metaDescription,
      services: Array.isArray(extracted.services) ? extracted.services : [],
      models: modelsArray,
      contactInfo: extracted.contactInfo || '',
      rawText: comprehensiveText,
      profile: {
        identity: extracted.description || content.metaDescription || '',
        offering: Array.isArray(extracted.services) ? extracted.services.join(', ') : '',
        differentiators: Array.isArray(extracted.keyFeatures) ? extracted.keyFeatures.join(', ') : '',
        terminology: { productsLabel: 'productos', processLabel: 'construcción' },
      },
      products: modelsArray.map(m => ({
        name: typeof m === 'string' ? m.split(' - ')[0] : String(m),
        specs: {} as Record<string, string | number>,
      })),
    };
  } catch (error) {
    console.error('[Scraper] AI extraction error:', error);
    // Return basic extraction if AI fails
    return {
      title: cleanCompanyName(content.metaTitle) || extractNameFromUrl(content.url),
      description: content.metaDescription,
      services: [],
      models: [],
      contactInfo: '',
      rawText: content.rawText,
      profile: {
        identity: content.metaDescription || '',
        offering: '',
        differentiators: '',
        terminology: { productsLabel: 'productos', processLabel: 'construcción' },
      },
      products: [],
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

// Fallback: método básico con fetch (para cuando Playwright falla)
async function basicFetchScrape(url: string): Promise<ScrapedContent> {
  try {
    console.log('[Scraper] Using basic fetch for:', url);

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
      .slice(0, 15000);

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
        const jsonContent = $(el).html();
        if (jsonContent) {
          structuredData += jsonContent + '\n';
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

    console.log('[Scraper] AI extracted (basic):', {
      title: extractedInfo.title,
      servicesCount: extractedInfo.services.length,
      productsCount: extractedInfo.products.length,
    });

    return extractedInfo;
  } catch (error) {
    console.error('[Scraper] Basic fetch error:', error);
    return fallbackScrape(url);
  }
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
      title: cleanCompanyName(rawTitle) || extractNameFromUrl(url),
      description,
      services: [],
      models: [],
      contactInfo: '',
      rawText,
      profile: {
        identity: description || '',
        offering: '',
        differentiators: '',
        terminology: { productsLabel: 'productos', processLabel: 'construcción' },
      },
      products: [],
    };
  } catch {
    return {
      title: extractNameFromUrl(url),
      description: '',
      services: [],
      models: [],
      contactInfo: '',
      rawText: '',
      profile: {
        identity: '',
        offering: '',
        differentiators: '',
        terminology: { productsLabel: 'productos', processLabel: 'construcción' },
      },
      products: [],
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

  // Final pass: if what we ended up with is a single squished token
  // (camelCase or joined lowercase), try to make it readable.
  if (cleaned && !/\s/.test(cleaned) && cleaned.length >= 8) {
    return prettifyBrandName(cleaned);
  }

  return cleaned;
}
