/**
 * Linktree Explorer - Extrae WhatsApp y catalogos de agregadores de links
 * Basado en phascraper/buscar_wa_mejorado.py lineas 524-596
 */

import { chromium, Browser, Page } from 'playwright';
import { validateWhatsAppNumber, isAlphanumericWaLink } from './whatsapp-validator';

// Lista de agregadores de links conocidos
const LINK_AGGREGATORS = [
  'linktr.ee',
  'linktree',
  'bio.link',
  'beacons.ai',
  'linkr.bio',
  'tap.bio',
  'campsite.bio',
  'hoo.be',
  'milkshake.app',
  'stan.store',
  'allmylinks',
  'contactinbio',
  'lnk.bio',
  'solo.to',
  'msha.ke',
];

// Keywords que indican un link de WhatsApp
const WHATSAPP_KEYWORDS = [
  'whatsapp',
  'wsp',
  'wa.me',
  'contacto',
  'contact',
  'asesor',
  'cotiza',
  'presupuesto',
  'consulta',
];

export interface LinktreeResult {
  whatsapp?: string;
  whatsappCountry?: string;
  catalogs: string[];      // URLs de PDFs encontrados
  otherLinks: string[];    // Otros links relevantes
  error?: string;
}

/**
 * Detecta si una URL es de un agregador de links
 */
export function isLinkAggregator(url: string): boolean {
  if (!url) return false;
  const urlLower = url.toLowerCase();
  return LINK_AGGREGATORS.some(agg => urlLower.includes(agg));
}

/**
 * Explora un linktree o agregador de links
 * Extrae WhatsApp, catalogos PDF y otros links utiles
 */
export async function exploreLinktree(url: string): Promise<LinktreeResult> {
  let browser: Browser | null = null;
  const result: LinktreeResult = {
    catalogs: [],
    otherLinks: [],
  };

  try {
    console.log('[LinktreeExplorer] Explorando:', url);

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 20000
    });

    // Esperar que cargue el contenido dinamico
    await page.waitForTimeout(2000);

    // Extraer todos los links de la pagina
    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      return anchors.map(a => ({
        href: a.getAttribute('href') || '',
        text: a.textContent?.trim() || '',
      }));
    });

    console.log(`[LinktreeExplorer] Encontrados ${links.length} links`);

    // Lista para guardar links alfanumericos de WA para explorar despues
    const alphanumericWaLinks: string[] = [];

    // Procesar cada link
    for (const link of links) {
      const href = link.href.toLowerCase();
      const text = link.text.toLowerCase();

      // 1. Links directos de WhatsApp con numero
      if (href.includes('wa.me/') || href.includes('whatsapp.com/send')) {
        // Si es alfanumerico, guardarlo para despues
        if (isAlphanumericWaLink(link.href)) {
          alphanumericWaLinks.push(link.href);
          continue;
        }

        // Intentar extraer numero directo
        const numberMatch = link.href.match(/wa\.me\/(\d{10,15})/i) ||
                           link.href.match(/phone=(\d{10,15})/i);
        if (numberMatch) {
          const validation = validateWhatsAppNumber(numberMatch[1]);
          if (validation.isValid) {
            result.whatsapp = numberMatch[1];
            result.whatsappCountry = validation.country;
            console.log(`[LinktreeExplorer] WhatsApp encontrado: ${result.whatsapp} (${result.whatsappCountry})`);
          }
        }
      }

      // 2. PDFs de catalogos
      if (href.endsWith('.pdf') ||
          /catalogo|catalogue|brochure|folleto/i.test(href) ||
          /catalogo|modelos|productos/i.test(text)) {
        result.catalogs.push(link.href);
        console.log(`[LinktreeExplorer] Catalogo PDF encontrado: ${link.href}`);
      }

      // 3. Links con keywords de WhatsApp en el texto
      if (!result.whatsapp && WHATSAPP_KEYWORDS.some(kw => text.includes(kw))) {
        if (href.includes('wa.me') || href.includes('whatsapp')) {
          if (isAlphanumericWaLink(link.href)) {
            alphanumericWaLinks.push(link.href);
          }
        }
      }

      // 4. Otros links potencialmente utiles (sitio web, cotizador)
      if (href.startsWith('http') &&
          !href.includes('instagram') &&
          !href.includes('facebook') &&
          !href.includes('twitter') &&
          !href.includes('tiktok') &&
          !href.includes('youtube')) {
        if (/cotiza|presupuesto|catalogo|modelos|web|sitio/i.test(text)) {
          result.otherLinks.push(link.href);
        }
      }
    }

    // Si no encontramos WA directo, intentar con links alfanumericos
    if (!result.whatsapp && alphanumericWaLinks.length > 0) {
      console.log(`[LinktreeExplorer] Intentando ${alphanumericWaLinks.length} links alfanumericos...`);

      for (const alphaLink of alphanumericWaLinks.slice(0, 2)) { // Max 2 intentos
        const extracted = await extractFromAlphanumericLink(page, alphaLink);
        if (extracted) {
          result.whatsapp = extracted.number;
          result.whatsappCountry = extracted.country;
          console.log(`[LinktreeExplorer] WhatsApp extraido de link alfanumerico: ${result.whatsapp}`);
          break;
        }
      }
    }

    await browser.close();
    browser = null;

    return result;

  } catch (error) {
    console.error('[LinktreeExplorer] Error:', error);
    result.error = error instanceof Error ? error.message : 'Unknown error';
    return result;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Extrae numero de un link alfanumerico de WhatsApp (wa.me/message/CODE)
 * Abre el link y captura la redireccion o el numero mostrado
 * Basado en phascraper/buscar_wa_mejorado.py lineas 598-714
 */
async function extractFromAlphanumericLink(
  page: Page,
  url: string
): Promise<{ number: string; country: string } | null> {
  let newPage: Page | null = null;

  try {
    console.log(`[LinktreeExplorer] Explorando link alfanumerico: ${url.slice(0, 50)}...`);

    const browser = page.context().browser();
    if (!browser) return null;

    const context = await browser.newContext();
    newPage = await context.newPage();

    // Variable para capturar URL final
    let finalUrl = '';

    // Listener para capturar redirecciones
    newPage.on('response', (response) => {
      const respUrl = response.url();
      if (respUrl.includes('wa.me') || respUrl.includes('whatsapp')) {
        finalUrl = respUrl;
      }
    });

    // Navegar al link
    try {
      await newPage.goto(url, {
        timeout: 15000,
        waitUntil: 'domcontentloaded'
      });
    } catch {
      // Puede dar timeout si redirecciona a la app
    }

    await newPage.waitForTimeout(3000);

    // Metodo 1: Verificar URL final
    const currentUrl = newPage.url();
    const urlsToCheck = [currentUrl, finalUrl].filter(Boolean);

    for (const checkUrl of urlsToCheck) {
      // Buscar numero en wa.me/NUMERO
      let match = checkUrl.match(/wa\.me\/(\d{10,15})/);
      if (match) {
        const validation = validateWhatsAppNumber(match[1]);
        if (validation.isValid) {
          return { number: match[1], country: validation.country };
        }
      }

      // Buscar en parametro phone=
      match = checkUrl.match(/phone=(\d{10,15})/);
      if (match) {
        const validation = validateWhatsAppNumber(match[1]);
        if (validation.isValid) {
          return { number: match[1], country: validation.country };
        }
      }
    }

    // Metodo 2: Buscar numero en el contenido de la pagina
    const bodyText = await newPage.textContent('body') || '';

    // Patrones de numero de telefono
    const phonePatterns = [
      /\+(\d{1,3})\s*(\d{2,4})[\s\-]?(\d{3,4})[\s\-]?(\d{3,4})/g,
      /(\d{10,15})/g,
    ];

    for (const pattern of phonePatterns) {
      const matches = bodyText.matchAll(pattern);
      for (const match of matches) {
        const num = match[0].replace(/[^\d]/g, '');
        if (num.length >= 10 && num.length <= 15) {
          const validation = validateWhatsAppNumber(num);
          if (validation.isValid) {
            return { number: num, country: validation.country };
          }
        }
      }
    }

    console.log('[LinktreeExplorer] No se pudo extraer numero del link alfanumerico');
    return null;

  } catch (error) {
    console.error('[LinktreeExplorer] Error en link alfanumerico:', error);
    return null;
  } finally {
    if (newPage) {
      await newPage.close();
    }
  }
}

/**
 * Funcion de alto nivel para integrar con el scraper
 * Detecta si hay linktree y lo explora
 */
export async function tryExploreLinktreeFromSocialLinks(
  socialLinks?: { linktree?: string }
): Promise<LinktreeResult | null> {
  if (!socialLinks?.linktree) {
    return null;
  }

  return exploreLinktree(socialLinks.linktree);
}
