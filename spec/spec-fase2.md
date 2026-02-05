# SPEC FASE 2: Mejoras al Scraping

## Resumen Ejecutivo

La Fase 2 implementa mejoras criticas al sistema de scraping para aumentar la tasa de extraccion de:
- **WhatsApp**: de ~5% a >50%
- **Instagram/redes sociales**: desde 0% a >70%
- **Informacion oculta en Linktrees**: contenido de catalogos y contacto

Esta fase se basa en codigo probado del `phascraper/buscar_wa_mejorado.py` que ya tiene validaciones robustas.

---

## Arquitectura de Cambios

```
src/
  lib/
    firecrawl.ts         # MODIFICAR - agregar extractSocialLinks(), extractWhatsAppImproved()
    whatsapp-validator.ts # NUEVO - port de validaciones del phascraper
    linktree-explorer.ts  # NUEVO - explorador de agregadores de links
  types/
    index.ts             # MODIFICAR - agregar SocialLinks, WhatsAppValidation
```

---

## FASE 2.1: Extraer Instagram/Redes Sociales desde Web

### Objetivo
Detectar y extraer links de redes sociales (Instagram, Facebook, Linktree) del HTML/markdown scrapeado.

### Archivo a modificar: `src/lib/firecrawl.ts`

**Ubicacion**: Despues de linea 680 (dentro del loop de procesamiento de catalogo)

```typescript
// ===========================================================
// AGREGAR DESPUES DE LINEA 680 (extraction de contacto)
// ===========================================================

/**
 * Patrones para extraer redes sociales del contenido
 */
const SOCIAL_PATTERNS = {
  instagram: [
    /(?:instagram\.com|instagr\.am)\/([a-zA-Z0-9._]{1,30})/gi,
    /(?:@)([a-zA-Z0-9._]{1,30})(?:\s|$|,)/g, // @usuario en texto
  ],
  facebook: [
    /facebook\.com\/([a-zA-Z0-9.]{1,50})/gi,
    /fb\.com\/([a-zA-Z0-9.]{1,50})/gi,
  ],
  linktree: [
    /linktr\.ee\/([a-zA-Z0-9._]{1,30})/gi,
    /bio\.link\/([a-zA-Z0-9._]{1,30})/gi,
    /beacons\.ai\/([a-zA-Z0-9._]{1,30})/gi,
    /linkr\.bio\/([a-zA-Z0-9._]{1,30})/gi,
  ],
  tiktok: [
    /tiktok\.com\/@([a-zA-Z0-9._]{1,30})/gi,
  ],
  youtube: [
    /youtube\.com\/(?:c\/|channel\/|@)?([a-zA-Z0-9._-]{1,50})/gi,
  ],
};

/**
 * Extrae links de redes sociales del markdown
 */
function extractSocialLinks(markdown: string): SocialLinks {
  const socialLinks: SocialLinks = {};

  for (const [platform, patterns] of Object.entries(SOCIAL_PATTERNS)) {
    for (const pattern of patterns) {
      const matches = markdown.matchAll(pattern);
      for (const match of matches) {
        const username = match[1];
        if (username && username.length > 1 && !username.includes('.com')) {
          // Construir URL completa
          let fullUrl: string;
          switch (platform) {
            case 'instagram':
              fullUrl = `https://instagram.com/${username}`;
              break;
            case 'facebook':
              fullUrl = `https://facebook.com/${username}`;
              break;
            case 'linktree':
              fullUrl = match[0].includes('bio.link')
                ? `https://bio.link/${username}`
                : match[0].includes('beacons.ai')
                ? `https://beacons.ai/${username}`
                : `https://linktr.ee/${username}`;
              break;
            case 'tiktok':
              fullUrl = `https://tiktok.com/@${username}`;
              break;
            case 'youtube':
              fullUrl = `https://youtube.com/@${username}`;
              break;
            default:
              fullUrl = match[0];
          }

          // Solo guardar si no tenemos ya uno para esta plataforma
          if (!socialLinks[platform as keyof SocialLinks]) {
            socialLinks[platform as keyof SocialLinks] = fullUrl;
          }
        }
      }
    }
  }

  return socialLinks;
}
```

**Integracion en el flujo principal** (modificar linea ~940, dentro de la funcion `scrapeWithFirecrawl`):

```typescript
// Antes del return final, agregar:
const socialLinks = extractSocialLinks(combinedMarkdown);
console.log('[Firecrawl] Social links found:', socialLinks);

// Convertir al formato ScrapedContent
return {
  title: companyName || SCRAPING_FAILED_MARKER,
  description: buildDescription(companyDescription, constructionMethod, hasFinancing),
  services: buildServices(constructionMethod, hasFinancing, locations),
  models: allModels.map(formatModelString),
  contactInfo: formatContactInfo(contactInfo),
  rawText: combinedMarkdown.slice(0, 20000),
  faqs: faqs.length > 0 ? faqs : undefined,
  socialLinks, // NUEVO
};
```

### Archivo a modificar: `src/types/index.ts`

**Agregar al final del archivo**:

```typescript
// ===========================================================
// AGREGAR AL FINAL DE src/types/index.ts
// ===========================================================

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  linktree?: string;
  tiktok?: string;
  youtube?: string;
}

export interface ScrapedContent {
  title: string;
  description: string;
  services: string[];
  models: string[];
  contactInfo: string;
  rawText: string;
  faqs?: { question: string; answer: string }[];
  socialLinks?: SocialLinks;  // NUEVO
  constructoraType?: 'modular' | 'tradicional' | 'mixta';  // NUEVO - para Fase 4
}
```

### Test de verificacion

```bash
# Test rapido de extraccion de redes sociales
npx tsx -e "
const markdown = 'Contactanos en instagram.com/vibert_casas o por linktr.ee/vibert';
const patterns = { instagram: /instagram\.com\/([a-zA-Z0-9._]+)/gi };
const match = markdown.match(patterns.instagram);
console.log('Instagram match:', match);
"
```

---

## FASE 2.2: Explorar Linktrees con Playwright

### Objetivo
Crear un modulo que explore linktrees y agregadores de links para extraer:
- Links de WhatsApp (incluyendo alfanumericos)
- PDFs de catalogos
- Otros links utiles

### Archivo nuevo: `src/lib/linktree-explorer.ts`

```typescript
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
          /catalogo|catalague|brochure|folleto/i.test(href) ||
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
```

### Test de verificacion

```bash
# Test de exploracion de linktree
npx tsx -e "
import { exploreLinktree, isLinkAggregator } from './src/lib/linktree-explorer';

// Test deteccion
console.log('linktr.ee/test:', isLinkAggregator('https://linktr.ee/test'));
console.log('google.com:', isLinkAggregator('https://google.com'));

// Test exploracion (requiere conexion)
// exploreLinktree('https://linktr.ee/vibert').then(console.log);
"
```

---

## FASE 2.3: Mejorar Extraccion de WhatsApp

### Objetivo
Implementar validaciones robustas para numeros de WhatsApp, evitando falsos positivos (numeros de ejemplo, secuencias, placeholders).

### Archivo nuevo: `src/lib/whatsapp-validator.ts`

```typescript
/**
 * WhatsApp Validator - Validaciones robustas para numeros de WhatsApp
 * Port de phascraper/buscar_wa_mejorado.py lineas 93-186
 */

// Codigos de pais validos con sus nombres
export const VALID_COUNTRY_CODES: Record<string, string> = {
  '1': 'USA/Canada',
  '54': 'Argentina',
  '56': 'Chile',
  '52': 'Mexico',
  '51': 'Peru',
  '57': 'Colombia',
  '58': 'Venezuela',
  '598': 'Uruguay',
  '595': 'Paraguay',
  '591': 'Bolivia',
  '593': 'Ecuador',
  '55': 'Brasil',
  '34': 'Espana',
  '48': 'Polonia',
  '49': 'Alemania',
  '44': 'UK',
  '33': 'Francia',
  '39': 'Italia',
  '31': 'Holanda',
  '41': 'Suiza',
  '43': 'Austria',
  '32': 'Belgica',
  '61': 'Australia',
  '64': 'Nueva Zelanda',
  '27': 'Sudafrica',
  '971': 'UAE',
  '966': 'Arabia Saudita',
  '972': 'Israel',
  '91': 'India',
  '86': 'China',
  '81': 'Japon',
  '82': 'Corea Sur',
  '65': 'Singapur',
  '60': 'Malasia',
  '62': 'Indonesia',
  '63': 'Filipinas',
  '66': 'Tailandia',
  '84': 'Vietnam',
};

export interface WhatsAppValidation {
  isValid: boolean;
  reason: string;
  country: string;
  cleanNumber: string;
}

/**
 * Detecta numeros sospechosos/falsos
 * Port de buscar_wa_mejorado.py lineas 92-136
 */
export function isSuspiciousNumber(number: string): { suspicious: boolean; reason: string } {
  if (!number) {
    return { suspicious: true, reason: 'Numero vacio' };
  }

  const clean = number.replace(/[^\d]/g, '');

  // Muy corto o muy largo
  if (clean.length < 10) {
    return { suspicious: true, reason: `Muy corto (${clean.length} digitos)` };
  }
  if (clean.length > 15) {
    return { suspicious: true, reason: `Muy largo (${clean.length} digitos)` };
  }

  // Secuencias ascendentes/descendentes (123456789, 987654321)
  for (let seqLen = 5; seqLen < 10; seqLen++) {
    for (let start = 0; start <= clean.length - seqLen; start++) {
      const substr = clean.slice(start, start + seqLen);

      // Verificar secuencia ascendente
      let isAscending = true;
      for (let i = 1; i < substr.length; i++) {
        if (parseInt(substr[i]) !== (parseInt(substr[i - 1]) + 1) % 10) {
          isAscending = false;
          break;
        }
      }
      if (isAscending) {
        return { suspicious: true, reason: `Secuencia ascendente: ${substr}` };
      }

      // Verificar secuencia descendente
      let isDescending = true;
      for (let i = 1; i < substr.length; i++) {
        if (parseInt(substr[i]) !== (parseInt(substr[i - 1]) - 1 + 10) % 10) {
          isDescending = false;
          break;
        }
      }
      if (isDescending) {
        return { suspicious: true, reason: `Secuencia descendente: ${substr}` };
      }
    }
  }

  // Digitos repetidos (11111, 00000, etc.)
  for (const digit of '0123456789') {
    if (clean.includes(digit.repeat(5))) {
      return { suspicious: true, reason: `Digitos repetidos: ${digit.repeat(5)}` };
    }
  }

  // Patrones conocidos de placeholder
  const suspiciousPatterns = [
    '1234567890',
    '0987654321',
    '1111111111',
    '0000000000',
    '9999999999',
    '1122334455',
    '5544332211',
  ];

  for (const pattern of suspiciousPatterns) {
    if (clean.includes(pattern)) {
      return { suspicious: true, reason: `Patron placeholder: ${pattern}` };
    }
  }

  return { suspicious: false, reason: '' };
}

/**
 * Verifica si el numero tiene un codigo de pais valido
 * Port de buscar_wa_mejorado.py lineas 138-158
 */
export function hasValidCountryCode(number: string): { valid: boolean; country: string } {
  const clean = number.replace(/[^\d]/g, '');

  // Verificar codigos de 3 digitos primero (mas especificos)
  const threeDigitCodes = ['598', '595', '591', '593', '971', '966', '972'];
  for (const code of threeDigitCodes) {
    if (clean.startsWith(code)) {
      return { valid: true, country: VALID_COUNTRY_CODES[code] || 'Unknown' };
    }
  }

  // Luego codigos de 2 digitos
  const twoDigitCodes = ['54', '56', '52', '51', '57', '58', '55', '34', '48', '49', '44',
                         '33', '39', '31', '41', '43', '32', '61', '64', '27', '91', '86',
                         '81', '82', '65', '60', '62', '63', '66', '84'];
  for (const code of twoDigitCodes) {
    if (clean.startsWith(code)) {
      return { valid: true, country: VALID_COUNTRY_CODES[code] || 'Unknown' };
    }
  }

  // Codigo de 1 digito (USA/Canada)
  if (clean.startsWith('1') && clean.length === 11) {
    return { valid: true, country: 'USA/Canada' };
  }

  return { valid: false, country: 'Unknown' };
}

/**
 * Valida completamente un numero de WhatsApp
 * Port de buscar_wa_mejorado.py lineas 161-186
 */
export function validateWhatsAppNumber(number: string): WhatsAppValidation {
  if (!number) {
    return { isValid: false, reason: 'Numero vacio', country: '', cleanNumber: '' };
  }

  const clean = number.replace(/[^\d]/g, '');

  // Verificar longitud
  if (clean.length < 10) {
    return { isValid: false, reason: `Muy corto (${clean.length} digitos)`, country: '', cleanNumber: clean };
  }
  if (clean.length > 15) {
    return { isValid: false, reason: `Muy largo (${clean.length} digitos)`, country: '', cleanNumber: clean };
  }

  // Verificar secuencias sospechosas
  const suspiciousCheck = isSuspiciousNumber(clean);
  if (suspiciousCheck.suspicious) {
    return { isValid: false, reason: suspiciousCheck.reason, country: '', cleanNumber: clean };
  }

  // Verificar codigo de pais
  const countryCheck = hasValidCountryCode(clean);
  if (!countryCheck.valid) {
    // Si no tiene codigo de pais conocido, solo aceptar si tiene 10-11 digitos (formato local)
    if (clean.length !== 10 && clean.length !== 11) {
      return {
        isValid: false,
        reason: `Sin codigo de pais valido y longitud inusual (${clean.length})`,
        country: 'Local',
        cleanNumber: clean
      };
    }
    // Aceptar como numero local
    return { isValid: true, reason: 'Numero local valido', country: 'Local', cleanNumber: clean };
  }

  return { isValid: true, reason: 'Numero valido', country: countryCheck.country, cleanNumber: clean };
}

/**
 * Verifica si es un link alfanumerico de WhatsApp (wa.me/message/CODE)
 * Port de buscar_wa_mejorado.py lineas 219-224
 */
export function isAlphanumericWaLink(url: string): boolean {
  if (!url) return false;
  const urlLower = url.toLowerCase();
  return urlLower.includes('/message/') &&
         (urlLower.includes('wa.me') || urlLower.includes('whatsapp'));
}

/**
 * Extrae numero de una URL de WhatsApp
 * Port de buscar_wa_mejorado.py lineas 189-216
 */
export function extractFromWaUrl(url: string): WhatsAppValidation | null {
  if (!url) return null;

  // Links alfanumericos se manejan aparte
  if (isAlphanumericWaLink(url)) {
    return null; // Sera procesado por linktree-explorer
  }

  // Patrones para extraer numero
  const patterns = [
    /wa\.me\/(\d{10,15})/i,
    /phone=(\d{10,15})/i,
    /whatsapp\.com\/send\?phone=(\d{10,15})/i,
    /api\.whatsapp\.com.*?phone=(\d{10,15})/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const validation = validateWhatsAppNumber(match[1]);
      if (validation.isValid) {
        return validation;
      }
      console.log(`[WhatsApp] Numero extraido pero invalido: ${match[1]} (${validation.reason})`);
    }
  }

  return null;
}

/**
 * Extrae numero de telefono de texto libre
 * Port de buscar_wa_mejorado.py lineas 226-264
 */
export function extractPhoneFromText(text: string): WhatsAppValidation | null {
  if (!text) return null;

  const patterns = [
    // Formato internacional con +
    /\+\s*1\s*[\(\s]*\d{3}[\)\s\-\.]*\d{3}[\s\-\.]*\d{4}/g,  // USA +1 (xxx) xxx-xxxx
    /\+\s*48\s*\d{3}[\s\-\.]*\d{3}[\s\-\.]*\d{3}/g,          // Polonia +48 xxx xxx xxx
    /\+\s*5[4-8]\s*9?\s*[\d\s\-\.]{8,12}/g,                  // LATAM
    /\+\s*598\s*9?\s*[\d\s\-\.]{7,9}/g,                      // Uruguay
    /\+\s*49\s*[\d\s\-\.]{10,12}/g,                          // Alemania
    /\+\s*44\s*[\d\s\-\.]{10,12}/g,                          // UK

    // Sin + pero con codigo de pais
    /(?<!\d)1[\s\-\.]?\d{3}[\s\-\.]\d{3}[\s\-\.]\d{4}(?!\d)/g,      // USA sin +
    /(?<!\d)5[4-8]\s*9?\s*\d{2,4}[\s\-\.]*\d{4}[\s\-\.]*\d{4}(?!\d)/g, // LATAM sin +
  ];

  interface Candidate {
    number: string;
    validation: WhatsAppValidation;
  }

  const candidates: Candidate[] = [];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const num = match[0].replace(/[^\d]/g, '');
      const validation = validateWhatsAppNumber(num);
      if (validation.isValid) {
        candidates.push({ number: num, validation });
      }
    }
  }

  // Priorizar numeros con codigo de pais conocido
  const withCountryCode = candidates.find(c => c.validation.country !== 'Local');
  if (withCountryCode) {
    return withCountryCode.validation;
  }

  // Si solo hay locales, retornar el primero
  if (candidates.length > 0) {
    return candidates[0].validation;
  }

  return null;
}
```

### Integracion en firecrawl.ts

**Modificar la extraccion de WhatsApp existente** (linea ~684):

```typescript
// ===========================================================
// REEMPLAZAR lineas 684-687 en firecrawl.ts
// ===========================================================

import { validateWhatsAppNumber, extractFromWaUrl, extractPhoneFromText } from './whatsapp-validator';

// Dentro del loop de procesamiento:

// Extraer WhatsApp mejorado (reemplaza el regex basico)
if (!contactInfo.whatsapp) {
  // Buscar links wa.me directos
  const waLinkMatches = markdown.matchAll(/(?:wa\.me\/\d+|whatsapp\.com\/send\?phone=\d+|api\.whatsapp\.com[^"'\s]*phone=\d+)/gi);
  for (const match of waLinkMatches) {
    const extracted = extractFromWaUrl(match[0]);
    if (extracted && extracted.isValid) {
      contactInfo.whatsapp = extracted.cleanNumber;
      console.log(`[Firecrawl] WhatsApp validado: ${contactInfo.whatsapp} (${extracted.country})`);
      break;
    }
  }
}

// Si no encontramos en links, buscar en texto
if (!contactInfo.whatsapp) {
  // Buscar patrones de texto cerca de keywords de WhatsApp
  const waTextPatterns = [
    /whatsapp[:\s]*(\+?[\d\s\-()]{10,20})/gi,
    /wsp[:\s]*(\+?[\d\s\-()]{10,20})/gi,
    /wa[:\s]*(\+?[\d\s\-()]{10,20})/gi,
  ];

  for (const pattern of waTextPatterns) {
    const match = markdown.match(pattern);
    if (match && match[1]) {
      const extracted = extractPhoneFromText(match[1]);
      if (extracted && extracted.isValid) {
        contactInfo.whatsapp = extracted.cleanNumber;
        console.log(`[Firecrawl] WhatsApp de texto: ${contactInfo.whatsapp} (${extracted.country})`);
        break;
      }
    }
  }
}
```

### Test de verificacion

```bash
# Test de validacion de WhatsApp
npx tsx -e "
import { validateWhatsAppNumber, isSuspiciousNumber } from './src/lib/whatsapp-validator';

// Casos validos
console.log('5491123456789:', validateWhatsAppNumber('5491123456789'));
console.log('541155551234:', validateWhatsAppNumber('541155551234'));

// Casos invalidos
console.log('1234567890:', validateWhatsAppNumber('1234567890'));
console.log('11111111111:', validateWhatsAppNumber('11111111111'));
console.log('12345:', validateWhatsAppNumber('12345'));

// Test de secuencias
console.log('Secuencia 12345678:', isSuspiciousNumber('12345678'));
"
```

---

## FASE 2.4: Busqueda en Google como Fallback (Opcional)

### Objetivo
Si FireCrawl encontro 0 modelos, usar busqueda en Google para encontrar paginas de catalogo.

**NOTA**: Esta fase es OPCIONAL y se implementara solo si las mejoras anteriores no son suficientes.

### Archivo nuevo: `src/lib/google-search-fallback.ts`

```typescript
/**
 * Google Search Fallback - Busca catalogos cuando scraping falla
 * OPCIONAL - Solo implementar si FASE 2.1-2.3 no son suficientes
 */

// Requiere SerpAPI o similar
// npm install serpapi (cuando se implemente)

export interface GoogleSearchResult {
  possibleUrls: string[];
  confidence: number;
}

export async function searchForModels(companyName: string): Promise<GoogleSearchResult> {
  // TODO: Implementar cuando sea necesario
  // 1. Query: "[companyName] modelos casas catalogo"
  // 2. Usar SerpAPI o alternativa
  // 3. VALIDAR que resultados pertenecen a la empresa
  // 4. Solo usar si confidence > 0.8

  console.log('[GoogleFallback] No implementado aun');
  return { possibleUrls: [], confidence: 0 };
}
```

---

## Integracion Final en scraper.ts

**Modificar `src/lib/scraper.ts`** para integrar todas las mejoras:

```typescript
// ===========================================================
// AGREGAR imports al inicio de scraper.ts
// ===========================================================

import { exploreLinktree, isLinkAggregator } from './linktree-explorer';
import { validateWhatsAppNumber } from './whatsapp-validator';

// ===========================================================
// AGREGAR despues de la linea 106 (despues de vision fallback)
// ===========================================================

// 5. Linktree exploration: si encontramos linktree, explorarlo
if (result.socialLinks?.linktree) {
  console.log(`[Scraper] Encontrado Linktree: ${result.socialLinks.linktree}, explorando...`);

  try {
    const linktreeResult = await exploreLinktree(result.socialLinks.linktree);

    // Actualizar WhatsApp si encontramos uno valido
    if (linktreeResult.whatsapp && !result.contactInfo.includes('WhatsApp')) {
      const currentContact = result.contactInfo;
      result.contactInfo = currentContact
        ? `${currentContact} | WhatsApp: ${linktreeResult.whatsapp}`
        : `WhatsApp: ${linktreeResult.whatsapp}`;
      console.log(`[Scraper] WhatsApp de Linktree: ${linktreeResult.whatsapp} (${linktreeResult.whatsappCountry})`);
    }

    // Agregar URLs de catalogos al rawText
    if (linktreeResult.catalogs.length > 0) {
      result.rawText += '\n\n--- CATALOGOS ENCONTRADOS EN LINKTREE ---\n';
      result.rawText += linktreeResult.catalogs.join('\n');
    }

  } catch (linktreeError) {
    console.error('[Scraper] Error explorando Linktree:', linktreeError);
  }
}

return result;
```

---

## Orden de Implementacion

| Paso | Archivo | Tarea | Complejidad | Dependencias |
|------|---------|-------|-------------|--------------|
| 1 | `src/types/index.ts` | Agregar tipos SocialLinks | Baja | Ninguna |
| 2 | `src/lib/whatsapp-validator.ts` | Crear archivo nuevo | Media | Ninguna |
| 3 | `src/lib/firecrawl.ts` | Agregar extractSocialLinks() | Media | Paso 1 |
| 4 | `src/lib/firecrawl.ts` | Integrar WhatsApp validator | Media | Paso 2 |
| 5 | `src/lib/linktree-explorer.ts` | Crear archivo nuevo | Alta | Pasos 1, 2 |
| 6 | `src/lib/scraper.ts` | Integrar linktree exploration | Baja | Paso 5 |
| 7 | Tests manuales | Verificar con 5 empresas | Media | Todos |

---

## Tests de Verificacion

### Test 1: Extraccion de redes sociales
```bash
npx tsx scripts/test-social-extraction.ts
```

### Test 2: Validacion de WhatsApp
```bash
npx tsx scripts/test-whatsapp-validation.ts
```

### Test 3: Exploracion de Linktree
```bash
npx tsx scripts/test-linktree-explorer.ts
```

### Test 4: Integracion completa
```bash
# Ejecutar QA con empresas que tienen linktree
npx tsx scripts/qa-run-all.ts --filter vibert,atlashousing
```

---

## Empresas para Testing

| Empresa | URL | Tiene Linktree | WA Actual | Esperado |
|---------|-----|----------------|-----------|----------|
| ViBert | vibert.com.ar | Si | No | Si |
| Atlas Housing | atlashousing.com.ar | No | No | No* |
| Wellmod | wellmod.com.ar | ? | ? | ? |
| Casas Nordicas | casasnordicas.com.ar | ? | ? | ? |

*Atlas Housing no tiene linktree, pero deberia encontrar WA en el sitio web

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|--------------|---------|------------|
| Rate limit en Linktrees | Media | Bajo | Delays de 2-3s entre requests |
| Playwright timeout en agregadores | Media | Bajo | Timeout de 20s, reintentos |
| Falsos positivos en WA | Baja | Medio | Validaciones robustas del phascraper |
| Links alfanumericos que no redireccionan | Media | Bajo | Metodos multiples de extraccion |

---

## Metricas de Exito

| Metrica | Antes | Objetivo FASE 2 |
|---------|-------|-----------------|
| WhatsApp encontrado | ~5% | >50% |
| Instagram extraido | 0% | >70% |
| Linktrees explorados | 0% | 100% (de los detectados) |
| Catalogos PDF encontrados | 0% | >30% |

---

## Siguiente Paso

Una vez aprobado este spec, usar `@coder` para implementar en orden:
1. Paso 1-2: Tipos y validador de WhatsApp
2. Paso 3-4: Mejoras en firecrawl.ts
3. Paso 5-6: Linktree explorer e integracion
4. Paso 7: Tests manuales
