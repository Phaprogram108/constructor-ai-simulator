import Firecrawl from '@mendable/firecrawl-js';
import { z } from 'zod';
import { ScrapedContent, SocialLinks, ProductOrService, CompanyProfile } from '@/types';
// SCRAPING_FAILED_MARKER ya no se usa - ahora usamos fallback de URL
import { extractFromWaUrl, extractPhoneFromText } from './whatsapp-validator';

// Actions universales que funcionan en la mayoría de sitios web
const UNIVERSAL_ACTIONS = [
  // 1. Esperar carga inicial
  { type: 'wait' as const, milliseconds: 2000 },

  // 2. Scroll completo para cargar lazy content
  { type: 'scroll' as const, direction: 'down' as const },
  { type: 'wait' as const, milliseconds: 1000 },
  { type: 'scroll' as const, direction: 'down' as const },
  { type: 'wait' as const, milliseconds: 500 },

  // 3. Expandir FAQs y Accordions (selectores genéricos)
  { type: 'click' as const, selector: '[class*="faq"] [class*="question"]' },
  { type: 'click' as const, selector: '[class*="faq"] [class*="title"]' },
  { type: 'click' as const, selector: '[class*="accordion"] [class*="header"]' },
  { type: 'click' as const, selector: '[class*="accordion"] [class*="title"]' },
  { type: 'click' as const, selector: '[class*="accordion-item"]' },
  { type: 'click' as const, selector: '[class*="collapsible"]' },
  { type: 'click' as const, selector: '[class*="expandable"]' },
  { type: 'click' as const, selector: '[class*="toggle"]' },
  { type: 'click' as const, selector: 'details summary' },
  { type: 'click' as const, selector: '[data-toggle="collapse"]' },
  { type: 'click' as const, selector: '[aria-expanded="false"]' },
  { type: 'wait' as const, milliseconds: 1000 },

  // 4. Click en elementos de contacto/WhatsApp para revelar números
  { type: 'click' as const, selector: '[href*="whatsapp"]' },
  { type: 'click' as const, selector: '[href*="wa.me"]' },
  { type: 'click' as const, selector: '[class*="whatsapp"]' },
  { type: 'click' as const, selector: '[class*="contact"] button' },
  { type: 'click' as const, selector: '[class*="phone"]' },
  { type: 'click' as const, selector: '[class*="telefono"]' },
  { type: 'wait' as const, milliseconds: 500 },

  // 5. Expandir "Ver más" / "Load more" / "Mostrar más"
  { type: 'click' as const, selector: '[class*="ver-mas"]' },
  { type: 'click' as const, selector: '[class*="see-more"]' },
  { type: 'click' as const, selector: '[class*="load-more"]' },
  { type: 'click' as const, selector: '[class*="show-more"]' },
  { type: 'click' as const, selector: '[class*="read-more"]' },
  { type: 'click' as const, selector: '[class*="leer-mas"]' },
  { type: 'wait' as const, milliseconds: 500 },

  // 6. Click en tabs de especificaciones/detalles
  { type: 'click' as const, selector: '[class*="tab"][class*="spec"]' },
  { type: 'click' as const, selector: '[class*="tab"][class*="detail"]' },
  { type: 'click' as const, selector: '[class*="tab"][class*="tecnic"]' },
  { type: 'click' as const, selector: '[role="tab"]' },
  { type: 'wait' as const, milliseconds: 500 },

  // 7. Expandir cards de modelos (común en sitios de constructoras)
  { type: 'click' as const, selector: '[class*="model"] [class*="expand"]' },
  { type: 'click' as const, selector: '[class*="model"] [class*="more"]' },
  { type: 'click' as const, selector: '[class*="modelo"] [class*="expand"]' },
  { type: 'click' as const, selector: '[class*="casa"] [class*="detail"]' },
  { type: 'click' as const, selector: '[class*="card"] [class*="plus"]' },
  { type: 'click' as const, selector: '[class*="card"] .fa-plus' },
  { type: 'click' as const, selector: '[class*="card"] .fa-chevron-down' },
  { type: 'click' as const, selector: '[class*="producto"] [class*="info"]' },
  { type: 'click' as const, selector: 'button[class*="info"]' },
  { type: 'click' as const, selector: 'button[class*="detail"]' },
  { type: 'click' as const, selector: '.swiper-slide [class*="btn"]' },
  { type: 'wait' as const, milliseconds: 1000 },
];

// Prompt exploratorio para el Agent de Firecrawl (usado como fallback)
const EXPLORATORY_EXTRACTION_PROMPT = `Sos un experto extrayendo informacion de sitios web de empresas de construccion/inmobiliarias.

NO asumas que tipo de empresa es. Explora y descubri:

1. QUE ES la empresa y a que se dedica
2. QUE OFRECE: productos, servicios, proyectos - lo que sea que venda
3. Para cada producto/servicio: nombre, descripcion, especificaciones (las que haya)
4. COMO llama la empresa a sus productos (modelos? tipologias? proyectos? servicios?)
5. Informacion de contacto: WhatsApp, telefono, email
6. Diferenciadores: que la hace unica

IMPORTANTE:
- NO asumas que hay "modelos de casas" - puede vender servicios, lotes, departamentos, o lo que sea
- Usa la TERMINOLOGIA que usa el sitio, no la tuya
- Extrae TODOS los productos/servicios, no solo los primeros
- Extrae SOLO lo que existe, no inventes
- Navega por todas las secciones del sitio
- Expande todos los elementos colapsables (FAQs, accordions)
- Hace click en botones de contacto para revelar numeros`;

// Inicialización lazy para evitar errores durante el build
let firecrawlInstance: Firecrawl | null = null;

function getFirecrawl(): Firecrawl {
  if (!firecrawlInstance) {
    if (!process.env.FIRECRAWL_API_KEY) {
      throw new Error('FIRECRAWL_API_KEY is not configured');
    }
    firecrawlInstance = new Firecrawl({
      apiKey: process.env.FIRECRAWL_API_KEY
    });
  }
  return firecrawlInstance;
}

// Constantes de configuracion
const RATE_LIMIT_MS = 50; // Firecrawl maneja rate limit interno
const FIRECRAWL_CREDIT_COST_USD = 0.001; // Aproximadamente $0.001 por credit
const MAX_CATALOG_URLS = 15; // Maximo URLs de catalogo a scrapear
const BATCH_SIZE = 10; // URLs a procesar en paralelo (aumentado para mejor performance)

// Patrones para extraer redes sociales del contenido
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
      // Reset regex lastIndex para evitar problemas con global flag
      pattern.lastIndex = 0;
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

/**
 * Extrae WhatsApp mejorado con validaciones robustas
 */
function extractWhatsAppImproved(markdown: string): string | undefined {
  // Buscar links wa.me directos
  const waLinkMatches = markdown.matchAll(/(?:wa\.me\/\d+|whatsapp\.com\/send\?phone=\d+|api\.whatsapp\.com[^"'\s]*phone=\d+)/gi);
  for (const match of waLinkMatches) {
    const extracted = extractFromWaUrl(match[0]);
    if (extracted && extracted.isValid) {
      console.log(`[Firecrawl] WhatsApp validado: ${extracted.cleanNumber} (${extracted.country})`);
      return extracted.cleanNumber;
    }
  }

  // Si no encontramos en links, buscar en texto cerca de keywords
  const waTextPatterns = [
    /whatsapp[:\s]*(\+?[\d\s\-()]{10,20})/gi,
    /wsp[:\s]*(\+?[\d\s\-()]{10,20})/gi,
    /wa[:\s]*(\+?[\d\s\-()]{10,20})/gi,
  ];

  for (const pattern of waTextPatterns) {
    pattern.lastIndex = 0;
    const match = markdown.match(pattern);
    if (match && match[1]) {
      const extracted = extractPhoneFromText(match[1]);
      if (extracted && extracted.isValid) {
        console.log(`[Firecrawl] WhatsApp de texto: ${extracted.cleanNumber} (${extracted.country})`);
        return extracted.cleanNumber;
      }
    }
  }

  return undefined;
}

/**
 * Detecta si un sitio web está construido con Wix
 */
function isWixSite(markdown: string): boolean {
  const wixIndicators = [
    'wix.com',
    '_wix_browser_sess',
    'wixstatic.com',
    'x-wix-',
    'data-testid="mesh-container-content"',
    'wix-dropdown-menu',
    'wix-image',
    'wixpress.com',
    'parastorage.com',
    'wix-rich-content',
    'data-hook="',
    'wixui.',
    '_wixcidx',
    'wix-code-sdk',
    'wix.stores',
  ];

  const markdownLower = markdown.toLowerCase();
  const matchedIndicators = wixIndicators.filter(indicator =>
    markdownLower.includes(indicator.toLowerCase())
  );

  if (matchedIndicators.length > 0) {
    console.log('[Firecrawl] Wix indicators found:', matchedIndicators);
    return matchedIndicators.length >= 1;
  }

  return false;
}

// Funcion para estimar costos antes de scrapear
function estimateCost(urlCount: number): { credits: number; usdEstimate: number } {
  // Firecrawl cobra ~1 credit por pagina scrapeada
  const credits = urlCount;
  const usdEstimate = credits * FIRECRAWL_CREDIT_COST_USD;
  return { credits, usdEstimate };
}

// Helper para rate limiting
async function rateLimitDelay(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
}

// Schema exploratorio - NO asume tipo de empresa ni estructura de productos
const exploratorySchema = z.object({
  companyName: z.string().optional().describe("Nombre comercial de la empresa"),
  companyDescription: z.string().optional().describe("Descripcion de la empresa"),
  identity: z.string().optional().describe("Que es la empresa y a que se dedica, en 1-2 oraciones"),
  offering: z.string().optional().describe("Que productos o servicios ofrece la empresa"),
  differentiators: z.string().optional().describe("Que la diferencia de la competencia"),
  productsTerminology: z.string().optional().describe("Como llama la empresa a sus productos: modelos, tipologias, proyectos, unidades, servicios, etc"),
  products: z.array(z.object({
    name: z.string().describe("Nombre tal como aparece en el sitio"),
    description: z.string().optional().describe("Descripcion del producto/servicio"),
    specs: z.record(z.union([z.string(), z.number()])).optional()
      .describe("Especificaciones tecnicas: m2, dormitorios, banos, precio, ambientes, etc - las keys son las que use el sitio"),
    features: z.array(z.string()).optional().describe("Caracteristicas incluidas"),
    category: z.string().optional().describe("Categoria segun el sitio: casa, quincho, loft, departamento, lote, etc"),
  })).optional().describe("TODOS los productos/servicios que ofrece la empresa - extraer CADA UNO"),
  contactPhone: z.string().optional(),
  contactWhatsapp: z.string().optional(),
  contactEmail: z.string().optional(),
  locations: z.array(z.string()).optional(),
  constructionMethod: z.string().optional(),
  financing: z.string().optional().describe("Info de financiacion si existe"),
});

interface ContactInfo {
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
}

interface ScrapeOptions {
  exhaustive?: boolean; // Si true, scrapea TODAS las URLs sin filtrar
}


/**
 * Extrae contenido de FAQ del markdown
 */
function extractFAQContent(markdown: string): { question: string; answer: string }[] {
  const faqs: { question: string; answer: string }[] = [];

  // Patrón 1: Markdown headers como preguntas
  // ### ¿Pregunta?
  // Respuesta aquí
  const headerPattern = /###?\s*¿([^?]+)\?[\s\n]+([^\n#]+(?:\n(?!###?)[^\n#]+)*)/gi;

  // Patrón 2: Bold como pregunta
  // **¿Pregunta?**
  // Respuesta
  const boldPattern = /\*\*¿([^?]+)\?\*\*[\s\n]+([^\n*]+(?:\n(?!\*\*)[^\n*]+)*)/gi;

  // Patrón 3: Lista con pregunta
  // - ¿Pregunta? Respuesta
  const listPattern = /[-•]\s*¿([^?]+)\?\s*([^\n-•]+)/gi;

  let match;

  while ((match = headerPattern.exec(markdown)) !== null) {
    faqs.push({ question: match[1].trim(), answer: match[2].trim() });
  }

  while ((match = boldPattern.exec(markdown)) !== null) {
    faqs.push({ question: match[1].trim(), answer: match[2].trim() });
  }

  while ((match = listPattern.exec(markdown)) !== null) {
    faqs.push({ question: match[1].trim(), answer: match[2].trim() });
  }

  return faqs;
}

/**
 * Usa el Agent de Firecrawl para extraccion autonoma (via API REST)
 * Se usa como fallback cuando el scraping normal no extrae suficiente info
 * NOTA: El SDK JS no tiene metodo agent(), usamos fetch directo
 */
async function scrapeWithAgent(url: string): Promise<{
  products: ProductOrService[];
  contactInfo: ContactInfo;
  faqs: { question: string; answer: string }[];
  rawText: string;
}> {
  console.log('[Firecrawl Agent] Iniciando extraccion autonoma para:', url);

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.log('[Firecrawl Agent] No hay API key, saltando Agent');
    return { products: [], contactInfo: {}, faqs: [], rawText: '' };
  }

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt: EXPLORATORY_EXTRACTION_PROMPT,
        urls: [url],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[Firecrawl Agent] API error ${response.status}: ${errorText}`);
      return { products: [], contactInfo: {}, faqs: [], rawText: '' };
    }

    const result = await response.json();
    console.log('[Firecrawl Agent] Resultado:', JSON.stringify(result, null, 2).slice(0, 500));

    const agentData = result.data || result;

    return {
      products: parseAgentProducts(agentData),
      contactInfo: parseAgentContact(agentData),
      faqs: parseAgentFAQs(agentData),
      rawText: typeof agentData === 'string' ? agentData : JSON.stringify(agentData, null, 2)
    };
  } catch (error) {
    console.error('[Firecrawl Agent] Error:', error);
    return {
      products: [],
      contactInfo: {},
      faqs: [],
      rawText: ''
    };
  }
}

/**
 * Scraping especializado para sitios Wix usando Agent con prompt exploratorio
 * y actions optimizadas para la estructura de Wix.
 *
 * IMPORTANTE: Wix no expone los links del menu en el HTML inicial,
 * asi que intentamos URLs comunes directamente.
 */
async function scrapeWixSite(url: string): Promise<{
  products: ProductOrService[];
  contactInfo: ContactInfo;
  faqs: { question: string; answer: string }[];
  rawText: string;
}> {
  console.log('[Firecrawl Wix] Iniciando scraping especializado para sitio Wix:', url);

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.log('[Firecrawl Wix] No hay API key, saltando');
    return { products: [], contactInfo: {}, faqs: [], rawText: '' };
  }

  // URLs comunes en sitios de empresas - expandido mas alla de solo "modelos"
  const baseUrl = new URL(url).origin;
  const CATALOG_PATHS = [
    '/casas',
    '/modelos',
    '/catalogo',
    '/productos',
    '/proyectos',
    '/servicios',
  ];

  // Actions simplificadas para Wix - reducir tiempo
  const WIX_ACTIONS = [
    { type: 'wait' as const, milliseconds: 3000 },
    { type: 'scroll' as const, direction: 'down' as const },
    { type: 'wait' as const, milliseconds: 1000 },
    { type: 'scroll' as const, direction: 'down' as const },
    { type: 'wait' as const, milliseconds: 500 },
  ];

  let allProducts: ProductOrService[] = [];
  let contactInfo: ContactInfo = {};
  let allFaqs: { question: string; answer: string }[] = [];
  let allRawText = '';

  try {
    // PASO 1: Scrapear URLs de catalogo EN PARALELO
    console.log('[Firecrawl Wix] Paso 1: Probando URLs de catalogo en paralelo...');

    const catalogUrls = CATALOG_PATHS.map(path => `${baseUrl}${path}`);
    console.log('[Firecrawl Wix] URLs a probar:', catalogUrls);

    const results = await Promise.all(
      catalogUrls.map(async (catalogUrl) => {
        try {
          const result = await getFirecrawl().scrapeUrl(catalogUrl, {
            formats: ['markdown', 'extract'],
            extract: { schema: exploratorySchema },
            actions: WIX_ACTIONS,
            timeout: 45000,
            onlyMainContent: true
          });
          return { catalogUrl, result, error: null };
        } catch (error) {
          return { catalogUrl, result: null, error };
        }
      })
    );

    for (const { catalogUrl, result } of results) {
      if (result?.success && result.markdown) {
        console.log(`[Firecrawl Wix] URL valida: ${catalogUrl}`);

        const markdown = result.markdown;
        const extract = result.extract as z.infer<typeof exploratorySchema> | undefined;

        allRawText += `\n--- ${catalogUrl} ---\n${markdown.slice(0, 5000)}`;

        // Extraer productos del extract
        if (extract?.products && extract.products.length > 0) {
          console.log(`[Firecrawl Wix] Extract encontro ${extract.products.length} productos`);
          const extractedProducts: ProductOrService[] = extract.products.map(p => ({
            name: p.name,
            description: p.description,
            specs: p.specs || {},
            features: p.features,
            category: p.category,
          }));
          allProducts = mergeProducts(allProducts, extractedProducts);
        }

        // Extraer contacto
        const extractedWa = extractWhatsAppImproved(markdown);
        if (extractedWa && !contactInfo.whatsapp) {
          contactInfo.whatsapp = extractedWa;
        }

        // Extraer FAQs
        const pageFaqs = extractFAQContent(markdown);
        allFaqs = [...allFaqs, ...pageFaqs];
      } else {
        console.log(`[Firecrawl Wix] URL no disponible: ${catalogUrl}`);
      }
    }

    // PASO 2: Si no encontramos productos, intentar con Agent
    if (allProducts.length === 0) {
      console.log('[Firecrawl Wix] Paso 2: No se encontraron productos, intentando con Agent...');

      const agentResponse = await fetch('https://api.firecrawl.dev/v1/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: EXPLORATORY_EXTRACTION_PROMPT,
          urls: [url],
        }),
      });

      if (agentResponse.ok) {
        const agentResult = await agentResponse.json();
        console.log('[Firecrawl Wix] Agent resultado:', JSON.stringify(agentResult, null, 2).slice(0, 500));

        const agentData = agentResult.data || agentResult;
        const agentProducts = parseAgentProducts(agentData);

        if (agentProducts.length > 0) {
          console.log(`[Firecrawl Wix] Agent extrajo ${agentProducts.length} productos`);
          allProducts = agentProducts;
          contactInfo = parseAgentContact(agentData);
          allFaqs = parseAgentFAQs(agentData);
          allRawText = typeof agentData === 'string' ? agentData : JSON.stringify(agentData, null, 2);
        }
      }
    }

    // PASO 3: Scrapear homepage para completar info de contacto (solo si falta)
    if (!contactInfo.whatsapp) {
      console.log('[Firecrawl Wix] Paso 3: Completando info de contacto desde homepage...');

      try {
        const homeResult = await getFirecrawl().scrapeUrl(url, {
          formats: ['markdown'],
          actions: WIX_ACTIONS,
          timeout: 30000,
          onlyMainContent: true
        });

        if (homeResult.success && homeResult.markdown) {
          const homeMarkdown = homeResult.markdown;

          if (!contactInfo.whatsapp) {
            const extractedWa = extractWhatsAppImproved(homeMarkdown);
            if (extractedWa) contactInfo.whatsapp = extractedWa;
          }

          if (!contactInfo.phone) {
            const phoneMatch = homeMarkdown.match(/(?:tel|phone|teléfono)[:\s]*(\+?[\d\s\-()]{8,20})/i);
            if (phoneMatch) contactInfo.phone = phoneMatch[1].trim();
          }

          if (!contactInfo.email) {
            const emailMatch = homeMarkdown.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
            if (emailMatch) contactInfo.email = emailMatch[1];
          }

          allRawText += `\n--- Homepage ---\n${homeMarkdown.slice(0, 3000)}`;
        }
      } catch (homeError) {
        console.log('[Firecrawl Wix] Error scrapeando homepage:', homeError);
      }
    }

    console.log(`[Firecrawl Wix] RESULTADO FINAL: ${allProducts.length} productos, WA: ${!!contactInfo.whatsapp}, FAQs: ${allFaqs.length}`);

    return {
      products: allProducts,
      contactInfo,
      faqs: allFaqs,
      rawText: allRawText.slice(0, 15000)
    };
  } catch (error) {
    console.error('[Firecrawl Wix] Error:', error);
    return { products: [], contactInfo: {}, faqs: [], rawText: '' };
  }
}

// Helpers para parsear respuesta del Agent en formato ProductOrService
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseAgentProducts(data: any): ProductOrService[] {
  if (!data) return [];

  const products: ProductOrService[] = [];

  // Intentar extraer productos de diferentes estructuras posibles
  const sources = [
    data.products,
    data.models,
    data.modelos,
    data.casas,
    data.viviendas,
    data.productos,
    data.proyectos,
    data.servicios,
  ].filter(Boolean).flat();

  for (const item of sources) {
    if (typeof item === 'object' && (item.name || item.nombre)) {
      const specs: Record<string, string | number> = {};
      // Mapear specs conocidas al formato Record
      if (item.squareMeters || item.metros || item.m2 || item.superficie) {
        specs['m2'] = item.squareMeters || item.metros || item.m2 || item.superficie;
      }
      if (item.bedrooms || item.dormitorios || item.habitaciones) {
        specs['dormitorios'] = item.bedrooms || item.dormitorios || item.habitaciones;
      }
      if (item.bathrooms || item.banos || item.baños) {
        specs['banos'] = item.bathrooms || item.banos || item.baños;
      }
      if (item.price || item.precio) {
        specs['precio'] = item.price || item.precio;
      }
      // Copiar specs si ya vienen como Record
      if (item.specs && typeof item.specs === 'object') {
        Object.assign(specs, item.specs);
      }

      products.push({
        name: item.name || item.nombre,
        description: item.description || item.descripcion,
        specs,
        features: item.features || item.caracteristicas,
        category: item.category || item.categoria,
      });
    }
  }

  return products;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseAgentContact(data: any): ContactInfo {
  if (!data) return {};

  const contact: ContactInfo = {};

  // Buscar en diferentes estructuras posibles
  const contactData = data.contact || data.contacto || data.contactInfo || data;

  contact.whatsapp = contactData.whatsapp || contactData.whatsApp || contactData.wsp;
  contact.phone = contactData.phone || contactData.telefono || contactData.tel;
  contact.email = contactData.email || contactData.correo || contactData.mail;
  contact.address = contactData.address || contactData.direccion;

  return contact;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseAgentFAQs(data: any): { question: string; answer: string }[] {
  if (!data) return [];

  const faqSources = [
    data.faqs,
    data.faq,
    data.preguntas,
    data.preguntasFrecuentes
  ].filter(Boolean).flat();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return faqSources.map((item: any) => ({
    question: item.question || item.pregunta || item.q || '',
    answer: item.answer || item.respuesta || item.a || ''
  })).filter((f: { question: string; answer: string }) => f.question && f.answer);
}


// Keywords expandidos para filtrar URLs de productos/servicios (reemplaza MODEL_KEYWORDS)
const PRODUCT_KEYWORDS = [
  'casa', 'casas', 'modelo', 'modelos', 'vivienda', 'viviendas',
  'catalogo', 'portfolio', 'proyectos', 'proyecto',
  'tipologia', 'tipologias', 'suite', 'loft', 'modulo', 'modulos',
  'productos', 'producto', 'galeria', 'gallery',
  'refugio', 'refugios', 'quincho', 'quinchos',
  'tiny', 'container', 'contenedor', 'prefabricada',
  'duplex', 'steel-frame', 'modulares', 'modular',
  'obras', 'trabajos',
  // Nuevos para approach exploratorio
  'servicio', 'servicios', 'obra', 'emprendimiento', 'emprendimientos',
  'desarrollo', 'desarrollos', 'lote', 'lotes',
  'departamento', 'departamentos', 'unidad', 'unidades',
  'torre', 'torres', 'barrio', 'barrios',
];

export async function scrapeWithFirecrawl(
  url: string,
  options: ScrapeOptions = { exhaustive: true }
): Promise<ScrapedContent> {
  console.log('[Firecrawl] v4 - Starting exploratory crawl-based extraction for:', url);

  // Variables to accumulate data
  let allProducts: ProductOrService[] = [];
  let companyName = '';
  let companyDescription = '';
  let extractedIdentity = '';
  let extractedOffering = '';
  let extractedDifferentiators = '';
  let extractedTerminology = '';
  const contactInfo: ContactInfo = {};
  const allMarkdown: string[] = [];
  const locations: string[] = [];
  let constructionMethod = '';
  let hasFinancing = false;

  // ====== STEP 1: Crawl the site ======
  console.log('[Firecrawl] v4 Step 1: Crawling site (open discovery, excludePaths only)...');

  const crawlStartTime = Date.now();
  let crawlResult;
  try {
    crawlResult = await getFirecrawl().crawlUrl(url, {
      excludePaths: [
        '/wp-json*', '/cdn-cgi*', '/api/*',
        '/wp-content/uploads*', '/assets/images*',
        '/admin*', '/login*', '/cart*', '/checkout*',
        '/blog/*', '/noticias/*', '/prensa/*',
        '/tag/*', '/category/*',
      ],
      limit: 30,
      maxDepth: 3,
      scrapeOptions: {
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 2000,
      }
    }, 2);
  } catch (crawlError) {
    console.error('[Firecrawl] v4 Crawl failed:', crawlError);
    crawlResult = null;
  }

  const crawlDuration = Date.now() - crawlStartTime;

  let crawledPages = 0;
  let isSPA = false;

  if (crawlResult && crawlResult.success && crawlResult.data) {
    crawledPages = crawlResult.data.length;
    console.log(`[Firecrawl] v4 Crawl completed in ${crawlDuration}ms: ${crawledPages} pages, ${(crawlResult as any).creditsUsed || '?'} credits`);

    // Process each crawled page - collect markdown and contact info only
    // (product extraction is done via schema, not regex)
    for (const doc of crawlResult.data) {
      const markdown = doc.markdown || '';
      if (!markdown || markdown.length < 50) continue;

      const pageUrl = (doc as any).url || '';
      allMarkdown.push(`\n--- URL: ${pageUrl} ---\n${markdown}`);

      // Extract contact info
      if (!contactInfo.whatsapp) {
        const wa = extractWhatsAppImproved(markdown);
        if (wa) contactInfo.whatsapp = wa;
      }
      const phoneMatch = markdown.match(/(?:tel|phone|teléfono|telefono)[:\s]*(\+?[\d\s\-()]{8,20})/i);
      if (phoneMatch && !contactInfo.phone) {
        contactInfo.phone = phoneMatch[1].trim();
      }
      const emailMatch = markdown.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch && !contactInfo.email) {
        contactInfo.email = emailMatch[1];
      }

      // Construction method
      if (markdown.toLowerCase().includes('steel frame')) {
        constructionMethod = 'Steel frame';
      } else if (markdown.toLowerCase().includes('hormigon') || markdown.toLowerCase().includes('hormigón')) {
        constructionMethod = 'Hormigon premoldeado';
      }

      // Financing
      if (markdown.toLowerCase().includes('financ')) {
        hasFinancing = true;
      }
    }

    // Detect SPA: very few pages or very little content
    const totalMarkdownLength = allMarkdown.join('').length;
    if (crawledPages <= 2 && totalMarkdownLength < 5000) {
      isSPA = true;
      console.log(`[Firecrawl] v4 SPA detected: ${crawledPages} pages, ${totalMarkdownLength} chars`);
    }
  } else {
    console.log(`[Firecrawl] v4 Crawl returned no usable data after ${crawlDuration}ms`);
    isSPA = true;
  }

  // ====== STEP 2: Scrape homepage with exploratory extract schema ======
  console.log('[Firecrawl] v4 Step 2: Scraping homepage with exploratory schema...');
  const homeUrl = url.endsWith('/') ? url : url + '/';

  try {
    const homeResult = await getFirecrawl().scrapeUrl(homeUrl, {
      formats: ['markdown', 'extract'],
      extract: { schema: exploratorySchema },
      onlyMainContent: true
    });

    if (homeResult && homeResult.success) {
      const extract = homeResult.extract as z.infer<typeof exploratorySchema> | undefined;

      if (extract?.companyName && !companyName) companyName = extract.companyName;
      if (extract?.companyDescription && !companyDescription) companyDescription = extract.companyDescription;
      if (extract?.identity) extractedIdentity = extract.identity;
      if (extract?.offering) extractedOffering = extract.offering;
      if (extract?.differentiators) extractedDifferentiators = extract.differentiators;
      if (extract?.productsTerminology) extractedTerminology = extract.productsTerminology;
      if (extract?.contactPhone && !contactInfo.phone) contactInfo.phone = extract.contactPhone;
      if (extract?.contactWhatsapp && !contactInfo.whatsapp) contactInfo.whatsapp = extract.contactWhatsapp;
      if (extract?.contactEmail && !contactInfo.email) contactInfo.email = extract.contactEmail;
      if (extract?.constructionMethod && !constructionMethod) constructionMethod = extract.constructionMethod;
      if (extract?.financing) hasFinancing = true;
      if (extract?.locations) locations.push(...extract.locations);

      // Products from extract
      if (extract?.products && extract.products.length > 0) {
        console.log(`[Firecrawl] v4 Found ${extract.products.length} products from homepage extract`);
        const extractedProducts: ProductOrService[] = extract.products.map(p => ({
          name: p.name,
          description: p.description,
          specs: p.specs || {},
          features: p.features,
          category: p.category,
        }));
        allProducts = mergeProducts(allProducts, extractedProducts);
      }

      // Also collect homepage markdown
      if (homeResult.markdown) {
        allMarkdown.push(`\n--- URL: ${homeUrl} (homepage) ---\n${homeResult.markdown}`);
      }

      console.log(`[Firecrawl] v4 After homepage: ${allProducts.length} total products`);
    }
  } catch (homeError) {
    console.error('[Firecrawl] v4 Homepage scrape failed:', homeError);
  }

  // ====== STEP 2.5: mapUrl fallback for missed pages ======
  if (allProducts.length < 5) {
    console.log(`[Firecrawl] v4 Step 2.5: Only ${allProducts.length} products after crawl+homepage. Running mapUrl fallback...`);

    try {
      const mapResult = await getFirecrawl().mapUrl(url, { limit: 100 });

      if (mapResult.success && mapResult.links) {
        // Find URLs that the crawl didn't already cover
        const crawledUrls = new Set(allMarkdown.map(m => {
          const match = m.match(/--- URL: ([^\s]+)/);
          return match ? match[1] : '';
        }).filter(Boolean));

        const newUrls = mapResult.links.filter(u => {
          if (crawledUrls.has(u)) return false;
          const path = new URL(u).pathname.toLowerCase();
          if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.pdf', '.css', '.js'].some(ext => path.endsWith(ext))) return false;
          if (['/wp-json', '/cdn-cgi', '/api/', '/admin', '/blog/'].some(p => path.includes(p))) return false;
          return PRODUCT_KEYWORDS.some(k => path.includes(k));
        });

        if (newUrls.length > 0) {
          console.log(`[Firecrawl] v4 mapUrl found ${newUrls.length} new product URLs not in crawl: ${newUrls.slice(0, 5).join(', ')}`);

          const urlsToScrape = newUrls.slice(0, MAX_CATALOG_URLS);
          const results = await Promise.all(
            urlsToScrape.map(async (pageUrl) => {
              try {
                const result = await getFirecrawl().scrapeUrl(pageUrl, {
                  formats: ['markdown', 'extract'],
                  extract: { schema: exploratorySchema },
                  onlyMainContent: true,
                  timeout: 30000,
                });
                return { pageUrl, result, error: null };
              } catch (error) {
                return { pageUrl, result: null, error };
              }
            })
          );

          for (const { pageUrl, result } of results) {
            if (!result?.success) continue;

            const markdown = result.markdown || '';
            if (markdown.length > 50) {
              allMarkdown.push(`\n--- URL: ${pageUrl} (mapUrl fallback) ---\n${markdown}`);

              // Extract products from schema
              const extract = result.extract as z.infer<typeof exploratorySchema> | undefined;
              if (extract?.products && extract.products.length > 0) {
                console.log(`[Firecrawl] v4 mapUrl fallback: ${extract.products.length} products from ${pageUrl}`);
                const extractedProducts: ProductOrService[] = extract.products.map(p => ({
                  name: p.name,
                  description: p.description,
                  specs: p.specs || {},
                  features: p.features,
                  category: p.category,
                }));
                allProducts = mergeProducts(allProducts, extractedProducts);
              }

              // Collect profile info if missing
              if (extract?.identity && !extractedIdentity) extractedIdentity = extract.identity;
              if (extract?.offering && !extractedOffering) extractedOffering = extract.offering;
              if (extract?.differentiators && !extractedDifferentiators) extractedDifferentiators = extract.differentiators;
              if (extract?.productsTerminology && !extractedTerminology) extractedTerminology = extract.productsTerminology;

              // Contact info
              if (!contactInfo.whatsapp) {
                const wa = extractWhatsAppImproved(markdown);
                if (wa) contactInfo.whatsapp = wa;
              }
            }
          }
          console.log(`[Firecrawl] v4 After mapUrl fallback: ${allProducts.length} total products`);
        } else {
          console.log('[Firecrawl] v4 mapUrl found no new product URLs beyond crawl');
        }
      }
    } catch (mapError) {
      console.error('[Firecrawl] v4 mapUrl fallback failed:', mapError);
    }
  }

  // ====== STEP 3: If few products, try extract() API ======
  if (allProducts.length < 3) {
    console.log(`[Firecrawl] v4 Only ${allProducts.length} products found. Trying extract() API...`);

    try {
      const extractResult = await getFirecrawl().extract(
        [url + '/*'],
        {
          prompt: EXPLORATORY_EXTRACTION_PROMPT,
          schema: exploratorySchema,
        }
      );

      if (extractResult && extractResult.success && extractResult.data) {
        const extractData = extractResult.data as z.infer<typeof exploratorySchema>;
        if (extractData?.products && extractData.products.length > 0) {
          console.log(`[Firecrawl] v4 extract() found ${extractData.products.length} products`);
          const extractedProducts: ProductOrService[] = extractData.products.map(p => ({
            name: p.name,
            description: p.description,
            specs: p.specs || {},
            features: p.features,
            category: p.category,
          }));
          allProducts = mergeProducts(allProducts, extractedProducts);
        }
        // Collect profile info
        if (extractData?.identity && !extractedIdentity) extractedIdentity = extractData.identity;
        if (extractData?.offering && !extractedOffering) extractedOffering = extractData.offering;
        if (extractData?.differentiators && !extractedDifferentiators) extractedDifferentiators = extractData.differentiators;
        if (extractData?.productsTerminology && !extractedTerminology) extractedTerminology = extractData.productsTerminology;
        // Contact info
        if (extractData?.contactWhatsapp && !contactInfo.whatsapp) contactInfo.whatsapp = extractData.contactWhatsapp;
        if (extractData?.contactPhone && !contactInfo.phone) contactInfo.phone = extractData.contactPhone;
        if (extractData?.contactEmail && !contactInfo.email) contactInfo.email = extractData.contactEmail;
      }
    } catch (extractError) {
      console.error('[Firecrawl] v4 extract() failed:', extractError);
    }
  }

  // ====== STEP 4: SPA or still few products -> Agent ======
  let combinedMarkdown = allMarkdown.join('');
  const isWix = isWixSite(combinedMarkdown);

  const needsAgent = isSPA || allProducts.length < 2 || (!contactInfo.whatsapp && !contactInfo.phone);

  if (needsAgent) {
    console.log(`[Firecrawl] v4 Using agent: isSPA=${isSPA}, products=${allProducts.length}, hasContact=${!!contactInfo.whatsapp || !!contactInfo.phone}`);

    try {
      let agentResult;
      if (isWix) {
        console.log('[Firecrawl] v4 Wix detected, using scrapeWixSite...');
        agentResult = await scrapeWixSite(url);
      } else {
        agentResult = await scrapeWithAgent(url);
      }

      if (agentResult.products.length > allProducts.length) {
        console.log(`[Firecrawl] v4 Agent found ${agentResult.products.length} products (vs ${allProducts.length})`);
        allProducts = mergeProducts(allProducts, agentResult.products);
      }

      if (!contactInfo.whatsapp && agentResult.contactInfo.whatsapp) {
        contactInfo.whatsapp = agentResult.contactInfo.whatsapp;
      }
      if (!contactInfo.phone && agentResult.contactInfo.phone) {
        contactInfo.phone = agentResult.contactInfo.phone;
      }
      if (!contactInfo.email && agentResult.contactInfo.email) {
        contactInfo.email = agentResult.contactInfo.email;
      }

      if (agentResult.rawText) {
        combinedMarkdown += '\n\n--- AGENT ---\n' + agentResult.rawText;
      }
    } catch (agentError) {
      console.error('[Firecrawl] v4 Agent failed:', agentError);
    }
  }

  // ====== STEP 5: Finalize ======
  allProducts = deduplicateProducts(allProducts);
  console.log('[Firecrawl] v4 FINAL: Total products:', allProducts.length, allProducts.map(p => p.name));

  // Extract FAQs
  const faqs = extractFAQContent(combinedMarkdown);

  // Extract social links
  const socialLinks = extractSocialLinks(combinedMarkdown);

  // Company name fallback from markdown
  if (!companyName && combinedMarkdown) {
    const h1Match = combinedMarkdown.match(/^#\s+([^\n]+)/m);
    const titleMatch = combinedMarkdown.match(/title[:\s]+["']?([^"'\n]+)/i);
    companyName = h1Match?.[1]?.trim() || titleMatch?.[1]?.trim() || 'Empresa';
  }
  // Company name fallback from URL domain
  if (!companyName) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      const namePart = domain.split('.')[0];
      companyName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    } catch {
      companyName = 'Empresa';
    }
  }

  // Build profile
  const profile: CompanyProfile = {
    identity: extractedIdentity || companyDescription || '',
    offering: extractedOffering || '',
    differentiators: extractedDifferentiators || '',
    terminology: {
      productsLabel: extractedTerminology || inferTerminology(allProducts),
      processLabel: constructionMethod || 'construccion',
    },
  };

  console.log('[Firecrawl] v4 Profile:', { identity: profile.identity.slice(0, 80), terminology: profile.terminology });

  return {
    title: companyName,
    description: buildDescription(companyDescription, constructionMethod, hasFinancing),
    profile,
    products: allProducts,
    services: buildServices(constructionMethod, hasFinancing, locations),
    contactInfo: formatContactInfo(contactInfo),
    rawText: combinedMarkdown.slice(0, 20000),
    faqs: faqs.length > 0 ? faqs : undefined,
    socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : undefined,
    // BACKWARDS COMPAT (deprecated):
    models: allProducts.map(p => {
      const specsStr = Object.entries(p.specs || {}).map(([, v]) => `${v}`).join(' - ');
      return `${p.name}${specsStr ? ' - ' + specsStr : ''}`;
    }),
  };
}

// Infer terminology from product categories
function inferTerminology(products: ProductOrService[]): string {
  if (products.length === 0) return 'productos';
  const categories = products.map(p => p.category?.toLowerCase()).filter(Boolean);
  if (categories.some(c => c?.includes('modelo') || c?.includes('casa'))) return 'modelos';
  if (categories.some(c => c?.includes('proyecto'))) return 'proyectos';
  if (categories.some(c => c?.includes('departamento') || c?.includes('unidad'))) return 'unidades';
  if (categories.some(c => c?.includes('servicio'))) return 'servicios';
  if (categories.some(c => c?.includes('lote'))) return 'lotes';
  if (categories.some(c => c?.includes('tipologia'))) return 'tipologias';
  return 'productos';
}

// Merge products avoiding duplicates and completing data
function mergeProducts(existing: ProductOrService[], newProducts: ProductOrService[]): ProductOrService[] {
  const merged = [...existing];

  for (const product of newProducts) {
    if (!product.name) continue;

    const existingIndex = merged.findIndex(p =>
      p.name?.toLowerCase() === product.name?.toLowerCase()
    );

    if (existingIndex === -1) {
      merged.push(product);
    } else {
      // Complete missing data on the existing product
      const existingProduct = merged[existingIndex];
      if (!existingProduct.description && product.description) {
        existingProduct.description = product.description;
      }
      if (!existingProduct.category && product.category) {
        existingProduct.category = product.category;
      }
      if (!existingProduct.features && product.features) {
        existingProduct.features = product.features;
      }
      // Merge specs: fill in missing keys
      if (product.specs) {
        for (const [key, value] of Object.entries(product.specs)) {
          if (!(key in existingProduct.specs)) {
            existingProduct.specs[key] = value;
          }
        }
      }
    }
  }

  return merged;
}

// Deduplicate products by normalized name
function deduplicateProducts(products: ProductOrService[]): ProductOrService[] {
  const seen = new Map<string, ProductOrService>();

  for (const product of products) {
    if (!product.name) continue;

    const normalizedName = product.name.toLowerCase().trim();

    if (!seen.has(normalizedName)) {
      seen.set(normalizedName, product);
    } else {
      // Merge specs into existing
      const existing = seen.get(normalizedName)!;
      if (product.specs) {
        for (const [key, value] of Object.entries(product.specs)) {
          if (!(key in existing.specs)) {
            existing.specs[key] = value;
          }
        }
      }
      if (!existing.description && product.description) {
        existing.description = product.description;
      }
      if (!existing.features && product.features) {
        existing.features = product.features;
      }
    }
  }

  return Array.from(seen.values());
}

function buildDescription(desc: string, method: string, financing: boolean): string {
  const parts: string[] = [];
  if (desc) parts.push(desc);
  if (method) parts.push(`Sistema constructivo: ${method}`);
  if (financing) parts.push('Ofrecen financiacion');
  return parts.join('. ');
}

function buildServices(method: string, financing: boolean, locations: string[]): string[] {
  const services: string[] = [];
  if (method) services.push(`Construccion en ${method}`);
  if (financing) services.push('Financiacion disponible');
  if (locations.length > 0) {
    services.push(`Construccion en: ${[...new Set(locations)].join(', ')}`);
  }
  return services;
}

function formatContactInfo(contact: ContactInfo): string {
  const parts: string[] = [];
  if (contact.phone) parts.push(`Tel: ${contact.phone}`);
  if (contact.whatsapp) parts.push(`WhatsApp: ${contact.whatsapp}`);
  if (contact.email) parts.push(`Email: ${contact.email}`);
  if (contact.address) parts.push(`Direccion: ${contact.address}`);
  return parts.join(' | ');
}
