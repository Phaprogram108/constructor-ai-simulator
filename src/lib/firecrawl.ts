import Firecrawl from '@mendable/firecrawl-js';
import { z } from 'zod';
import { ScrapedContent, SocialLinks } from '@/types';
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
];

// Prompt para el Agent de Firecrawl (usado como fallback)
const AGENT_EXTRACTION_PROMPT = `Sos un experto extrayendo información de sitios web de empresas constructoras de casas prefabricadas/modulares.

EXTRAE TODA la siguiente información del sitio web:

1. MODELOS DE CASAS/VIVIENDAS:
   - Nombre exacto de cada modelo (ej: "W26 Suite", "Fitz Roy", "Casa Sara")
   - Metros cuadrados (m²) de cada modelo
   - Cantidad de dormitorios
   - Cantidad de baños
   - Precio si está disponible (en USD o pesos)
   - Características especiales

2. INFORMACIÓN DE CONTACTO:
   - Número de WhatsApp (IMPORTANTE: hace click en botones de WhatsApp para obtener el número real)
   - Teléfono fijo
   - Email de contacto
   - Dirección física

3. PREGUNTAS FRECUENTES (FAQ):
   - EXPANDE todas las preguntas del FAQ
   - Extrae cada pregunta con su respuesta completa
   - Busca información sobre cobertura geográfica ("¿Llegan a todo el país?")
   - Busca información sobre tiempos de entrega
   - Busca información sobre formas de pago/financiación

4. ESPECIFICACIONES TÉCNICAS:
   - Método constructivo (steel frame, hormigón, etc.)
   - Materiales (DVH, tipo de aislación, etc.)
   - Dimensiones exactas si hay tablas de especificaciones
   - Garantías

5. COBERTURA GEOGRÁFICA:
   - ¿A qué provincias/zonas llegan?
   - ¿Hacen envíos a todo el país?
   - Zonas de instalación

IMPORTANTE:
- Navega por todas las secciones del sitio
- Expande todos los elementos colapsables (FAQs, accordions)
- Hace click en botones de contacto para revelar números
- No inventes información, solo extrae lo que está visible`;

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

// Schema mejorado para extraer MULTIPLES modelos de una pagina de catalogo
const catalogSchema = z.object({
  companyName: z.string().optional().describe("Nombre de la empresa constructora"),
  companyDescription: z.string().optional().describe("Descripcion de la empresa"),
  models: z.array(z.object({
    name: z.string().describe("Nombre del modelo tal como aparece en el sitio web"),
    squareMeters: z.number().optional().describe("Metros cuadrados totales"),
    coveredArea: z.number().optional().describe("Superficie cubierta en m2"),
    semicoveredArea: z.number().optional().describe("Superficie semicubierta en m2"),
    bedrooms: z.number().optional().describe("Cantidad de dormitorios"),
    bathrooms: z.number().optional().describe("Cantidad de banos"),
    price: z.string().optional().describe("Precio en USD o pesos"),
    features: z.array(z.string()).optional().describe("Caracteristicas del modelo"),
    category: z.string().optional().describe("Categoria: casa, quincho, cabana, etc.")
  })).optional().describe("TODOS los modelos de casas/quinchos disponibles - extraer CADA UNO"),
  quinchos: z.array(z.object({
    name: z.string().describe("Nombre o tamaño del quincho tal como aparece en el sitio"),
    squareMeters: z.number().optional(),
    features: z.array(z.string()).optional()
  })).optional().describe("Modelos de quinchos disponibles"),
  contactPhone: z.string().optional(),
  contactWhatsapp: z.string().optional(),
  contactEmail: z.string().optional(),
  locations: z.array(z.string()).optional(),
  constructionMethod: z.string().optional().describe("Steel frame, tradicional, etc."),
  financing: z.boolean().optional()
});

// Schema para paginas individuales de modelos
const singleModelSchema = z.object({
  modelName: z.string().optional().describe("Nombre del modelo de casa"),
  squareMeters: z.number().optional().describe("Metros cuadrados totales"),
  coveredArea: z.number().optional().describe("Superficie cubierta"),
  semicoveredArea: z.number().optional().describe("Superficie semicubierta"),
  bedrooms: z.number().optional().describe("Cantidad de dormitorios"),
  bathrooms: z.number().optional().describe("Cantidad de banos"),
  price: z.string().optional().describe("Precio"),
  features: z.array(z.string()).optional().describe("Caracteristicas incluidas"),
  companyName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactWhatsapp: z.string().optional(),
  contactEmail: z.string().optional()
});

interface ExtractedModel {
  name: string;
  squareMeters?: number;
  coveredArea?: number;
  semicoveredArea?: number;
  bedrooms?: number;
  bathrooms?: number;
  price?: string;
  features?: string[];
  category?: string;
}

interface ContactInfo {
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
}

interface ScrapeOptions {
  exhaustive?: boolean; // Si true, scrapea TODAS las URLs sin filtrar
}

// Función para parsear modelos del markdown SIN usar AI (evita invención de datos)
function parseModelsFromMarkdown(markdown: string): ExtractedModel[] {
  const models: ExtractedModel[] = [];

  // Patrones para detectar modelos de casas/quinchos
  // Formato: "Modelo de Casa X - Y personas - Z m2 - N dormitorios - M baños"
  const modelPatterns = [
    // Patrón ViBert Casas: "Modelo de Casa Sara - 2 personas 65.55 m2 TOTALES"
    /Modelo de Casa\s+([A-Za-záéíóúñÁÉÍÓÚÑ]+)\s*[-–]\s*\d+\s*personas?\s+(\d+[.,]?\d*)\s*m2/gi,
    // Patrón ViBert Quinchos: "Modelo de Quincho S - 27,50 m2 TOTALES" (sin personas)
    /Modelo de (Quincho\s+[A-Za-záéíóúñÁÉÍÓÚÑ]+)\s*[-–]\s*(\d+[.,]?\d*)\s*m2/gi,
    // Patrón genérico: "Casa/Modelo X - 100m² - 3 dormitorios" (excluir quinchos ya capturados)
    /(?:Casa|Vivienda)\s+([A-Za-záéíóúñÁÉÍÓÚÑ0-9\s\-]+?)\s*[-–|]\s*(\d+[.,]?\d*)\s*m[²2]/gi,
    // Patrón con precio: "CM0 15m² USD 17.050"
    /([A-Z]{1,3}\d+(?:\s*-\s*[A-Z])?)\s*(\d+[.,]?\d*)\s*m[²2].*?(?:U\$?D|USD|\$)\s*([\d.,]+)/gi,
    // Formato Wellmod: "W26 Suite | 26 m2 | Monoambiente"
    /([A-Z]\d+\s*\w*)\s*[|\-–]\s*(\d+)\s*m[²2]/gi,
    // Formato tabla con pipes: "Modelo | Superficie | Dormitorios"
    /^([A-Za-z0-9\s]+)\s*\|\s*(\d+[.,]?\d*)\s*m[²2]/gm,
    // Formato con "Ver más" o "VER MAS": extraer nombre antes de link
    /([\w\s]+)\s+(?:VER MAS|Ver más|ver más)/gi,
    // Formato simple: "Nombre Modelo 50m2" o "Nombre 50 m2"
    /([A-Za-záéíóúñÁÉÍÓÚÑ\s]+)\s+(\d+)\s*m[²2]/gi,
    // Formato con guión: "Modelo-A - 45m²"
    /([A-Za-z0-9]+[-][A-Za-z0-9]*)\s*[-–]\s*(\d+[.,]?\d*)\s*m[²2]/gi,
  ];

  // Buscar con cada patrón
  for (const pattern of modelPatterns) {
    let match;
    while ((match = pattern.exec(markdown)) !== null) {
      const name = match[1]?.trim();
      if (name && name.length > 1 && name.length < 50) {
        // Evitar duplicados - solo si el nombre es casi idéntico (no substring match)
        const nameLower = name.toLowerCase();
        const exists = models.some(m => {
          const existingLower = m.name.toLowerCase();
          // Considerar duplicado solo si:
          // 1. Son exactamente iguales
          // 2. Uno contiene al otro Y la diferencia de longitud es menor a 3 caracteres
          if (existingLower === nameLower) return true;
          if (existingLower.includes(nameLower) && Math.abs(existingLower.length - nameLower.length) < 3) return true;
          if (nameLower.includes(existingLower) && Math.abs(nameLower.length - existingLower.length) < 3) return true;
          return false;
        });
        if (!exists) {
          const model: ExtractedModel = { name, category: 'casa' };

          // Extraer metros cuadrados
          const sqmMatch = markdown.match(new RegExp(name + '[^]*?(\\d+[.,]?\\d*)\\s*m[²2]', 'i'));
          if (sqmMatch) {
            model.squareMeters = parseFloat(sqmMatch[1].replace(',', '.'));
          } else if (match[2]) {
            model.squareMeters = parseFloat(match[2].replace(',', '.'));
          }

          // Extraer dormitorios
          const bedroomMatch = markdown.match(new RegExp(name + '[^]*?(\\d+)\\s*(?:dormitorio|dorm|habitacion)', 'i'));
          if (bedroomMatch) {
            model.bedrooms = parseInt(bedroomMatch[1]);
          }

          // Extraer baños
          const bathMatch = markdown.match(new RegExp(name + '[^]*?(\\d+)\\s*(?:baño|bano|bath)', 'i'));
          if (bathMatch) {
            model.bathrooms = parseInt(bathMatch[1]);
          }

          // Extraer precio SOLO si aparece explícitamente cerca del nombre
          const priceMatch = markdown.match(new RegExp(name + '[^]{0,100}(?:U\\$?D|USD|\\$)\\s*([\\d.,]+)', 'i'));
          if (priceMatch) {
            model.price = `USD ${priceMatch[1]}`;
          }
          // NO inventar precio si no existe

          // Detectar si es quincho
          if (name.toLowerCase().includes('quincho') || markdown.toLowerCase().includes(`quincho ${name.toLowerCase()}`)) {
            model.category = 'quincho';
          }

          models.push(model);
        }
      }
    }
  }

  return models;
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
 * Usa el Agent de Firecrawl para extracción autónoma (via API REST)
 * Se usa como fallback cuando el scraping normal no extrae suficiente info
 * NOTA: El SDK JS no tiene método agent(), usamos fetch directo
 */
async function scrapeWithAgent(url: string): Promise<{
  models: ExtractedModel[];
  contactInfo: ContactInfo;
  faqs: { question: string; answer: string }[];
  rawText: string;
}> {
  console.log('[Firecrawl Agent] Iniciando extracción autónoma para:', url);

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.log('[Firecrawl Agent] No hay API key, saltando Agent');
    return { models: [], contactInfo: {}, faqs: [], rawText: '' };
  }

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt: AGENT_EXTRACTION_PROMPT,
        urls: [url],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[Firecrawl Agent] API error ${response.status}: ${errorText}`);
      // Si el endpoint no existe o hay error, retornar vacío sin romper
      return { models: [], contactInfo: {}, faqs: [], rawText: '' };
    }

    const result = await response.json();
    console.log('[Firecrawl Agent] Resultado:', JSON.stringify(result, null, 2).slice(0, 500));

    // Parsear resultado del agent
    const agentData = result.data || result;

    return {
      models: parseAgentModels(agentData),
      contactInfo: parseAgentContact(agentData),
      faqs: parseAgentFAQs(agentData),
      rawText: typeof agentData === 'string' ? agentData : JSON.stringify(agentData, null, 2)
    };
  } catch (error) {
    console.error('[Firecrawl Agent] Error:', error);
    // Retornar vacío sin romper el flujo
    return {
      models: [],
      contactInfo: {},
      faqs: [],
      rawText: ''
    };
  }
}

// Helpers para parsear respuesta del Agent
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseAgentModels(data: any): ExtractedModel[] {
  if (!data) return [];

  const models: ExtractedModel[] = [];

  // Intentar extraer modelos de diferentes estructuras posibles
  const modelSources = [
    data.models,
    data.modelos,
    data.casas,
    data.viviendas,
    data.productos
  ].filter(Boolean).flat();

  for (const item of modelSources) {
    if (typeof item === 'object' && (item.name || item.nombre)) {
      models.push({
        name: item.name || item.nombre,
        squareMeters: item.squareMeters || item.metros || item.m2 || item.superficie,
        bedrooms: item.bedrooms || item.dormitorios || item.habitaciones,
        bathrooms: item.bathrooms || item.banos || item.baños,
        price: item.price || item.precio,
        features: item.features || item.caracteristicas,
        category: 'casa'
      });
    }
  }

  return models;
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

// ===========================================================
// CLASIFICACION DE TIPO DE CONSTRUCTORA
// ===========================================================

interface ConstructoraClassification {
  type: 'modular' | 'tradicional' | 'mixta';
  confidence: number;  // 0.0 - 1.0
  signals: string[];   // Razones de la clasificacion
  debug: {
    modularScore: number;
    tradicionalScore: number;
    modelsCount: number;
  };
}

/**
 * Clasifica el tipo de constructora basado en el contenido scrapeado
 *
 * MODULAR: Empresas con catalogo fijo (3+ modelos, keywords "catalogo", "modular", etc.)
 * TRADICIONAL: Empresas de proyectos a medida (0 modelos, keywords "a medida", "personalizado")
 * MIXTA: Empresas que ofrecen ambas modalidades
 */
function classifyConstructora(
  markdown: string,
  modelsCount: number,
  models: string[]
): ConstructoraClassification {
  const signals: string[] = [];
  let modularScore = 0;
  let tradicionalScore = 0;

  const textLower = markdown.toLowerCase();

  // ===================
  // SENALES DE MODULAR
  // ===================

  // 1. Cantidad de modelos (senal mas fuerte)
  if (modelsCount >= 5) {
    modularScore += 4;
    signals.push(`${modelsCount} modelos detectados (muy probable modular)`);
  } else if (modelsCount >= 3) {
    modularScore += 3;
    signals.push(`${modelsCount} modelos detectados (probable modular)`);
  } else if (modelsCount >= 1) {
    modularScore += 1;
    signals.push(`${modelsCount} modelo(s) detectado(s)`);
  }

  // 2. Keywords de catalogo/modular
  const modularKeywords = [
    { pattern: /cat[aá]logo/gi, weight: 2, name: 'catalogo' },
    { pattern: /modular(es)?/gi, weight: 2, name: 'modular' },
    { pattern: /prefabricad[oa]s?/gi, weight: 2, name: 'prefabricado' },
    { pattern: /steel\s*frame/gi, weight: 2, name: 'steel frame' },
    { pattern: /industrializad[oa]s?/gi, weight: 1, name: 'industrializado' },
    { pattern: /linea\s+de\s+(casas|productos|modelos)/gi, weight: 2, name: 'linea de modelos' },
    { pattern: /nuestros\s+modelos/gi, weight: 2, name: 'nuestros modelos' },
    { pattern: /modelos\s+disponibles/gi, weight: 2, name: 'modelos disponibles' },
    { pattern: /ver\s+(todos\s+los\s+)?modelos/gi, weight: 1, name: 'ver modelos' },
  ];

  for (const kw of modularKeywords) {
    const matches = textLower.match(kw.pattern);
    if (matches && matches.length > 0) {
      modularScore += kw.weight;
      signals.push(`Keyword modular: "${kw.name}" (${matches.length}x)`);
    }
  }

  // 3. Nombres de modelos con patrones tipicos de catalogo
  const catalogModelPatterns = /modelo\s+[A-Z]?\d+|casa\s+(sara|flex|pro|plus|eco|mini|max)/gi;
  const catalogModelMatches = models.join(' ').match(catalogModelPatterns);
  if (catalogModelMatches && catalogModelMatches.length > 0) {
    modularScore += 2;
    signals.push(`Nombres de modelos tipo catalogo: ${catalogModelMatches.slice(0, 3).join(', ')}`);
  }

  // 4. Precios listados para multiples modelos
  const pricePatterns = /(?:USD|U\$D|\$)\s*[\d.,]+\s*(?:\.?\d{3})*(?:\s*(?:desde|llave\s*en\s*mano))?/gi;
  const priceMatches = textLower.match(pricePatterns);
  if (priceMatches && priceMatches.length >= 3) {
    modularScore += 2;
    signals.push(`${priceMatches.length} precios listados (tipico de catalogo)`);
  }

  // ======================
  // SENALES DE TRADICIONAL
  // ======================

  // 1. Keywords de diseno a medida
  const tradicionalKeywords = [
    { pattern: /a\s*medida/gi, weight: 3, name: 'a medida' },
    { pattern: /dise[ñn]o\s*personalizado/gi, weight: 3, name: 'diseno personalizado' },
    { pattern: /proyecto\s*personalizado/gi, weight: 3, name: 'proyecto personalizado' },
    { pattern: /custom/gi, weight: 2, name: 'custom' },
    { pattern: /dise[ñn]amos\s*(tu|su)\s*(casa|proyecto)/gi, weight: 3, name: 'disenamos tu casa' },
    { pattern: /seg[uú]n\s*(tus|sus)\s*necesidades/gi, weight: 2, name: 'segun tus necesidades' },
    { pattern: /proyectos?\s*(a\s*medida|personalizado)/gi, weight: 3, name: 'proyectos a medida' },
    { pattern: /construimos\s*(lo\s*que\s*(so[ñn][aá]s|quer[eé]s)|tu\s*proyecto)/gi, weight: 2, name: 'construimos tu proyecto' },
    { pattern: /arquitectura\s*a\s*medida/gi, weight: 3, name: 'arquitectura a medida' },
    { pattern: /sin\s*modelos?\s*fijos?/gi, weight: 3, name: 'sin modelos fijos' },
  ];

  for (const kw of tradicionalKeywords) {
    const matches = textLower.match(kw.pattern);
    if (matches && matches.length > 0) {
      tradicionalScore += kw.weight;
      signals.push(`Keyword tradicional: "${kw.name}" (${matches.length}x)`);
    }
  }

  // 2. Ausencia de modelos es senal fuerte de tradicional
  if (modelsCount === 0) {
    tradicionalScore += 3;
    signals.push('Sin modelos detectados (probable tradicional)');
  }

  // 3. Mencion de arquitectos o estudios de arquitectura
  const architectPatterns = /(?:estudio\s*de\s*)?arquitect[oa]s?|dise[ñn]ador(?:es)?/gi;
  const architectMatches = textLower.match(architectPatterns);
  if (architectMatches && architectMatches.length >= 2) {
    tradicionalScore += 1;
    signals.push(`Mencion de arquitectos/disenadores (${architectMatches.length}x)`);
  }

  // 4. Proceso de diseno personalizado
  const designProcessPatterns = /(?:primera\s*)?reuni[oó]n.*dise[ñn]o|anteproyecto|boceto|planos?\s*personalizados?/gi;
  if (designProcessPatterns.test(textLower)) {
    tradicionalScore += 2;
    signals.push('Mencion de proceso de diseno personalizado');
  }

  // ==================
  // SENALES MIXTAS
  // ==================

  // Detectar si ofrecen ambas modalidades
  const mixedSignals = /(?:modelos?\s*(?:y|o)\s*(?:a\s*medida|personalizado))|(?:(?:a\s*medida|personalizado)\s*(?:y|o)\s*modelos?)|(?:adaptamos?\s*(?:nuestros\s*)?modelos?)/gi;
  if (mixedSignals.test(textLower)) {
    signals.push('Detectada oferta mixta (modelos + personalizados)');
    // No sumamos puntaje, pero lo consideramos en la decision final
  }

  // ====================
  // CALCULAR RESULTADO
  // ====================

  let type: 'modular' | 'tradicional' | 'mixta';
  let confidence: number;

  const totalScore = modularScore + tradicionalScore;

  if (totalScore === 0) {
    // Sin senales claras - usar heuristica basada en modelos
    if (modelsCount >= 2) {
      type = 'modular';
      confidence = 0.4;
      signals.push('Clasificado por defecto como modular (tiene modelos)');
    } else {
      type = 'tradicional';
      confidence = 0.3;
      signals.push('Clasificado por defecto como tradicional (sin info clara)');
    }
  } else {
    const modularRatio = modularScore / totalScore;
    const tradicionalRatio = tradicionalScore / totalScore;

    if (modularRatio > 0.65) {
      type = 'modular';
      confidence = Math.min(0.95, 0.5 + (modularScore / 20));
    } else if (tradicionalRatio > 0.65) {
      type = 'tradicional';
      confidence = Math.min(0.95, 0.5 + (tradicionalScore / 20));
    } else {
      // Puntajes similares = probablemente mixta
      type = 'mixta';
      confidence = Math.min(0.8, 0.4 + (totalScore / 30));
      signals.push('Senales equilibradas: modular vs tradicional');
    }
  }

  return {
    type,
    confidence,
    signals,
    debug: {
      modularScore,
      tradicionalScore,
      modelsCount
    }
  };
}

export async function scrapeWithFirecrawl(
  url: string,
  options: ScrapeOptions = { exhaustive: true }
): Promise<ScrapedContent> {
  const { exhaustive = true } = options;

  console.log('[Firecrawl] Starting improved multi-model extraction for:', url);
  console.log('[Firecrawl] Modo exhaustivo:', exhaustive ? 'SI - scrapeando TODAS las URLs' : 'NO - solo URLs filtradas');

  // PASO 1: Mapear todas las URLs del sitio
  console.log('[Firecrawl] Step 1: Mapping URLs...');
  const mapResult = await getFirecrawl().mapUrl(url, {
    limit: 100 // Aumentado de 50 a 100 para capturar mas URLs
  });

  if (!mapResult.success || !mapResult.links) {
    throw new Error(`Firecrawl map failed: ${mapResult.error || 'No links found'}`);
  }

  const allUrls = mapResult.links;
  console.log('[Firecrawl] Found URLs:', allUrls.length, allUrls);

  // PASO 2: Identificar URLs por tipo
  const MODEL_KEYWORDS = [
    // Palabras principales
    'casa', 'casas', 'modelo', 'modelos', 'vivienda', 'viviendas',
    'proyecto', 'proyectos', 'catalogo', 'portfolio',
    // Tipologias y modulos
    'tipologia', 'tipologias', 'suite', 'loft', 'studio', 'monoambiente',
    'modulo', 'modulos',
    'residencial', 'residenciales',
    'linea', 'lineas',
    'productos', 'producto',
    // Galeria y obras
    'galeria', 'gallery',
    'obras', 'trabajos',
    // Tipos especificos
    'refugio', 'refugios',
    'tiny', 'tiny-house', 'container', 'contenedor', 'prefabricada', 'prefabricadas',
    'duplex', 'steel-frame', 'steelframe',
    'modulares', 'modular',
    // Quinchos
    'quinchos', 'quincho',
    // Especificaciones y fichas
    'detalle', 'ficha', 'especificacion', 'caracteristicas'
  ];

  const homeUrl = allUrls.find(u => new URL(u).pathname === '/') || url;

  // En modo exhaustivo: scrapear TODAS las URLs excepto assets/imagenes
  // En modo filtrado: solo URLs que matcheen keywords
  let catalogUrls: string[];
  let modelUrls: string[];

  if (exhaustive) {
    // Modo exhaustivo: todas las URLs excepto assets estaticos
    const EXCLUDED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.pdf', '.css', '.js', '.woff', '.woff2', '.ttf'];
    const EXCLUDED_PATHS = ['wp-content/uploads', 'assets/images', '/cdn-cgi/', '/api/', '/wp-json/'];

    const allContentUrls = allUrls.filter(u => {
      const urlLower = u.toLowerCase();
      // Excluir archivos estaticos
      const hasExcludedExtension = EXCLUDED_EXTENSIONS.some(ext => urlLower.endsWith(ext));
      const hasExcludedPath = EXCLUDED_PATHS.some(path => urlLower.includes(path));
      return !hasExcludedExtension && !hasExcludedPath;
    });

    // En modo exhaustivo, catalogUrls son TODAS las URLs de contenido
    catalogUrls = allContentUrls.filter(u => u !== homeUrl);
    modelUrls = []; // No necesitamos separar en modo exhaustivo

    // PRIORIZAR URLs: páginas principales de catálogo primero
    const HIGH_PRIORITY_PATHS = [
      // Existentes - Catálogo
      '/casas', '/catalogo', '/modelos', '/viviendas', '/portfolio', '/proyectos', '/quinchos',
      // FAQ y cobertura
      '/faq', '/preguntas-frecuentes', '/preguntas', '/cobertura', '/envios', '/zonas', '/envio',
      // Especificaciones y tipologías
      '/tipologias', '/especificaciones', '/caracteristicas', '/detalles', '/ficha-tecnica', '/fichas',
      // Proceso y precios
      '/proceso', '/como-trabajamos', '/precios', '/cotizador', '/financiacion', '/financiamiento',
      // Otros importantes
      '/nosotros', '/about', '/empresa', '/servicios'
    ];
    catalogUrls.sort((a, b) => {
      const pathA = new URL(a).pathname.toLowerCase();
      const pathB = new URL(b).pathname.toLowerCase();

      // Alta prioridad: páginas de catálogo sin guión (ej: /casas vs /casa-sara)
      const isHighPriorityA = HIGH_PRIORITY_PATHS.some(p => pathA === p || pathA === p + '/');
      const isHighPriorityB = HIGH_PRIORITY_PATHS.some(p => pathB === p || pathB === p + '/');

      if (isHighPriorityA && !isHighPriorityB) return -1;
      if (!isHighPriorityA && isHighPriorityB) return 1;

      // Media prioridad: páginas que contienen keywords pero tienen guión (individuales)
      const hasCatalogKeywordA = MODEL_KEYWORDS.some(k => pathA.includes(k));
      const hasCatalogKeywordB = MODEL_KEYWORDS.some(k => pathB.includes(k));

      if (hasCatalogKeywordA && !hasCatalogKeywordB) return -1;
      if (!hasCatalogKeywordA && hasCatalogKeywordB) return 1;

      return 0;
    });

    console.log('[Firecrawl] URLs priorizadas (primeras 5):', catalogUrls.slice(0, 5));

    // Mostrar estimacion de costos
    const totalUrlsToScrape = catalogUrls.length + 1; // +1 por homepage
    const costEstimate = estimateCost(totalUrlsToScrape);
    console.log(`[Firecrawl] Modo EXHAUSTIVO: scrapeando ${totalUrlsToScrape} URLs`);
    console.log(`[Firecrawl] Costo estimado: ${costEstimate.credits} credits (~$${costEstimate.usdEstimate.toFixed(3)} USD)`);
  } else {
    // Modo filtrado (comportamiento original)
    catalogUrls = allUrls.filter(u => {
      const path = new URL(u).pathname.toLowerCase();
      return MODEL_KEYWORDS.some(keyword => path.includes(keyword));
    });

    modelUrls = allUrls.filter(u => {
      const path = new URL(u).pathname.toLowerCase();
      return (path.includes('casa-') || path.includes('modelo-')) &&
             !catalogUrls.includes(u);
    });

    const totalUrlsToScrape = catalogUrls.length + modelUrls.length + 1;
    const costEstimate = estimateCost(totalUrlsToScrape);
    console.log(`[Firecrawl] Modo FILTRADO: scrapeando ${totalUrlsToScrape} URLs (${catalogUrls.length} catalogo + ${modelUrls.length} modelos + 1 home)`);
    console.log(`[Firecrawl] Costo estimado: ${costEstimate.credits} credits (~$${costEstimate.usdEstimate.toFixed(3)} USD)`);
  }

  console.log('[Firecrawl] Catalog URLs:', catalogUrls);
  console.log('[Firecrawl] Individual model URLs:', modelUrls);

  // Variables para acumular datos
  let allModels: ExtractedModel[] = [];
  let companyName = '';
  let companyDescription = '';
  const contactInfo: ContactInfo = {};
  const allMarkdown: string[] = []; // Array para acumular markdown de todas las páginas
  const locations: string[] = [];
  let constructionMethod = '';
  let hasFinancing = false;

  // OPTIMIZACION: Lanzar homepage scrape en paralelo con los batches de catalogo
  console.log('[Firecrawl] Starting homepage scrape in parallel...');
  const homepageStartTime = Date.now();
  const homepagePromise = getFirecrawl().scrapeUrl(homeUrl, {
    formats: ['markdown', 'extract'],
    extract: { schema: catalogSchema }
  }).then(result => {
    const duration = Date.now() - homepageStartTime;
    console.log(`[Firecrawl] Homepage scrape completed in ${duration}ms`);
    return result;
  }).catch(err => {
    const duration = Date.now() - homepageStartTime;
    console.error(`[Firecrawl] Homepage scrape failed after ${duration}ms:`, err);
    return null;
  });

  // PASO 3: Scrapear paginas de CATALOGO primero (tienen todos los modelos)
  if (catalogUrls.length > 0) {
    console.log('[Firecrawl] Step 3: Scraping catalog pages...');

    // Limitar cantidad de URLs a scrapear
    const urlsToScrape = catalogUrls.slice(0, MAX_CATALOG_URLS);
    console.log(`[Firecrawl] Scraping ${urlsToScrape.length} of ${catalogUrls.length} catalog URLs`);

    // Crear batches para procesamiento paralelo
    const batches: string[][] = [];
    for (let i = 0; i < urlsToScrape.length; i += BATCH_SIZE) {
      batches.push(urlsToScrape.slice(i, i + BATCH_SIZE));
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchStartTime = Date.now();
      console.log(`[Firecrawl] Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} URLs)...`);

      // Scrapear URLs del batch en paralelo - SOLO MARKDOWN con ACTIONS para expandir contenido
      const results = await Promise.all(
        batch.map(async (catalogUrl) => {
          try {
            console.log('[Firecrawl] Scraping catalog:', catalogUrl);
            const result = await getFirecrawl().scrapeUrl(catalogUrl, {
              formats: ['markdown'], // Solo markdown, sin extract para evitar datos inventados
              actions: UNIVERSAL_ACTIONS,
              timeout: 60000 // Aumentar timeout por las actions
            });
            return { catalogUrl, result, error: null };
          } catch (error) {
            console.error('[Firecrawl] Error scraping catalog:', catalogUrl, error);
            return { catalogUrl, result: null, error };
          }
        })
      );

      const batchDuration = Date.now() - batchStartTime;
      console.log(`[Firecrawl] Batch ${batchIndex + 1} completed in ${batchDuration}ms`);

      // Procesar resultados del batch - PARSEAR MARKDOWN DIRECTAMENTE (sin AI que inventa)
      for (const { catalogUrl, result, error } of results) {
        if (error || !result?.success) {
          if (result && !result.success) {
            console.error('[Firecrawl] Catalog scrape failed:', result.error);
          }
          continue;
        }

        const markdown = result.markdown || '';

        // Acumular todo el markdown para análisis posterior
        allMarkdown.push(`\n--- URL: ${catalogUrl} ---\n${markdown}`);

        // Parsear modelos del markdown con regex (sin AI)
        const parsedModels = parseModelsFromMarkdown(markdown);
        if (parsedModels.length > 0) {
          console.log(`[Firecrawl] Found ${parsedModels.length} models in ${catalogUrl} via regex`);
          allModels.push(...parsedModels);
        }

        // Extraer info de contacto del markdown
        const phoneMatch = markdown.match(/(?:tel|phone)[:\s]*(\+?[\d\s\-()]{8,20})/i);
        if (phoneMatch && !contactInfo.phone) {
          contactInfo.phone = phoneMatch[1].trim();
        }
        // Usar validador mejorado de WhatsApp
        if (!contactInfo.whatsapp) {
          const extractedWa = extractWhatsAppImproved(markdown);
          if (extractedWa) {
            contactInfo.whatsapp = extractedWa;
          }
        }
        const emailMatch = markdown.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch && !contactInfo.email) {
          contactInfo.email = emailMatch[1];
        }

        // Extraer método de construcción del markdown
        if (markdown.toLowerCase().includes('steel frame')) {
          constructionMethod = 'Steel frame';
        } else if (markdown.toLowerCase().includes('hormigon') || markdown.toLowerCase().includes('hormigón')) {
          constructionMethod = 'Hormigón premoldeado';
        }

        // Extraer si hay financiación
        if (markdown.toLowerCase().includes('financ')) {
          hasFinancing = true;
        }

        // Parsear markdown adicional
        if (result.markdown) {
          console.log('[Firecrawl] Parsing markdown from catalog, length:', result.markdown.length);
          allMarkdown.push(`\n\n--- ${catalogUrl} ---\n${result.markdown}`);

          const markdownModels = parseModelsFromMarkdown(result.markdown);
          console.log('[Firecrawl] Parsed models from markdown:', markdownModels.length);
          allModels = mergeModels(allModels, markdownModels);
        }
      }

      // Delay solo entre batches, no entre cada URL
      if (batchIndex < batches.length - 1) {
        await rateLimitDelay();
      }
    }
  }

  // PASO 4: Si no tenemos suficientes modelos, scrapear paginas individuales
  // En modo exhaustivo ya scrapeamos todo en el paso anterior, asi que solo si NO es exhaustivo
  if (!exhaustive && allModels.length < 3 && modelUrls.length > 0) {
    console.log('[Firecrawl] Step 4: Scraping individual model pages (found only', allModels.length, 'models)...');

    // Sin limite: procesar TODAS las modelUrls
    const modelUrlsToScrape = modelUrls;
    console.log('[Firecrawl] Scrapeando', modelUrlsToScrape.length, 'paginas de modelos individuales...');

    // Crear batches para procesamiento paralelo
    const modelBatches: string[][] = [];
    for (let i = 0; i < modelUrlsToScrape.length; i += BATCH_SIZE) {
      modelBatches.push(modelUrlsToScrape.slice(i, i + BATCH_SIZE));
    }

    for (let batchIndex = 0; batchIndex < modelBatches.length; batchIndex++) {
      const batch = modelBatches[batchIndex];
      const batchStartTime = Date.now();
      console.log(`[Firecrawl] Processing model batch ${batchIndex + 1}/${modelBatches.length} (${batch.length} URLs)...`);

      // Scrapear URLs del batch en paralelo
      const results = await Promise.all(
        batch.map(async (modelUrl) => {
          try {
            console.log('[Firecrawl] Scraping model page:', modelUrl);
            const result = await getFirecrawl().scrapeUrl(modelUrl, {
              formats: ['markdown', 'extract'],
              extract: { schema: singleModelSchema }
            });
            return { modelUrl, result, error: null };
          } catch (error) {
            console.error('[Firecrawl] Error scraping model page:', modelUrl, error);
            return { modelUrl, result: null, error };
          }
        })
      );

      const batchDuration = Date.now() - batchStartTime;
      console.log(`[Firecrawl] Model batch ${batchIndex + 1} completed in ${batchDuration}ms`);

      // Procesar resultados del batch
      for (const { modelUrl, result, error } of results) {
        if (error || !result?.success) {
          if (result && !result.success) {
            console.error('[Firecrawl] Model page scrape failed:', result.error);
          }
          continue;
        }

        const extract = result.extract as z.infer<typeof singleModelSchema> | undefined;

        if (extract?.modelName || result.markdown) {
          // Nombre del modelo del path si no lo extrajo
          const urlPath = new URL(modelUrl).pathname;
          const modelNameFromUrl = urlPath.split('/').pop()
            ?.replace(/casa-/i, '')
            .replace(/-/g, ' ')
            .split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');

          const modelName = extract?.modelName || modelNameFromUrl || 'Modelo';

          // Verificar si ya existe
          const exists = allModels.some(m =>
            m.name?.toLowerCase() === modelName.toLowerCase()
          );

          if (!exists) {
            allModels.push({
              name: modelName,
              squareMeters: extract?.squareMeters,
              coveredArea: extract?.coveredArea,
              semicoveredArea: extract?.semicoveredArea,
              bedrooms: extract?.bedrooms,
              bathrooms: extract?.bathrooms,
              price: extract?.price,
              features: extract?.features,
              category: 'casa'
            });
            console.log('[Firecrawl] Added model from individual page:', modelName);
          }

          // Parsear markdown para datos adicionales
          if (result.markdown) {
            allMarkdown.push(`\n\n--- ${modelUrl} ---\n${result.markdown}`);

            // Intentar completar datos del modelo desde markdown
            const parsedFromMd = parseModelsFromMarkdown(result.markdown);
            if (parsedFromMd.length > 0) {
              allModels = mergeModels(allModels, parsedFromMd);
            }
          }
        }

        // Actualizar info de contacto si falta
        if (extract?.companyName && !companyName) {
          companyName = extract.companyName;
        }
        if (extract?.contactPhone && !contactInfo.phone) {
          contactInfo.phone = extract.contactPhone;
        }
        if (extract?.contactWhatsapp && !contactInfo.whatsapp) {
          contactInfo.whatsapp = extract.contactWhatsapp;
        }
        if (extract?.contactEmail && !contactInfo.email) {
          contactInfo.email = extract.contactEmail;
        }
      }

      // Delay solo entre batches, no entre cada URL
      if (batchIndex < modelBatches.length - 1) {
        await rateLimitDelay();
      }
    }
  }

  // PASO 5: Procesar resultado del homepage (ya fue scrapeado en paralelo)
  console.log('[Firecrawl] Step 5: Processing homepage result (scraped in parallel)...');
  const homeResult = await homepagePromise;

  if (homeResult && homeResult.success) {
    const extract = homeResult.extract as z.infer<typeof catalogSchema> | undefined;

    // Solo usar datos del homepage si faltan
    if (extract?.companyName && !companyName) {
      companyName = extract.companyName;
      console.log('[Firecrawl] Got companyName from homepage:', companyName);
    }
    if (extract?.companyDescription && !companyDescription) {
      companyDescription = extract.companyDescription;
    }
    if (extract?.contactPhone && !contactInfo.phone) {
      contactInfo.phone = extract.contactPhone;
      console.log('[Firecrawl] Got phone from homepage:', contactInfo.phone);
    }
    if (extract?.contactWhatsapp && !contactInfo.whatsapp) {
      contactInfo.whatsapp = extract.contactWhatsapp;
    }
    if (extract?.contactEmail && !contactInfo.email) {
      contactInfo.email = extract.contactEmail;
    }
    if (extract?.constructionMethod && !constructionMethod) {
      constructionMethod = extract.constructionMethod;
    }
    if (extract?.financing) {
      hasFinancing = true;
    }

    // Tambien parsear markdown del home
    if (homeResult.markdown) {
      allMarkdown.push(`\n\n--- ${homeUrl} ---\n${homeResult.markdown}`);

      // Extraer modelos del home si hay
      const homeModels = parseModelsFromMarkdown(homeResult.markdown);
      allModels = mergeModels(allModels, homeModels);
    }
  } else {
    console.log('[Firecrawl] Homepage scrape did not return usable data');
  }

  // Eliminar duplicados finales y ordenar
  allModels = deduplicateModels(allModels);

  console.log('[Firecrawl] FINAL: Total models extracted:', allModels.length);
  console.log('[Firecrawl] Models:', allModels.map(m => m.name));

  // Extraer FAQs del markdown acumulado
  let combinedMarkdown = allMarkdown.join('');
  let faqs = extractFAQContent(combinedMarkdown);
  console.log('[Firecrawl] FAQs extracted:', faqs.length);

  // FALLBACK: Si extrajimos muy poca información, usar Agent
  const needsAgentFallback =
    allModels.length < 2 ||
    (!contactInfo.whatsapp && !contactInfo.phone) ||
    faqs.length === 0;

  if (needsAgentFallback) {
    console.log('[Firecrawl] Información insuficiente, usando Agent como fallback...');
    console.log(`[Firecrawl] Modelos: ${allModels.length}, WhatsApp: ${!!contactInfo.whatsapp}, Phone: ${!!contactInfo.phone}, FAQs: ${faqs.length}`);

    try {
      const agentResult = await scrapeWithAgent(url);

      // Mergear modelos del agent si encontró más
      if (agentResult.models.length > allModels.length) {
        console.log(`[Firecrawl Agent] Encontró ${agentResult.models.length} modelos (vs ${allModels.length} del scraping)`);
        allModels = mergeModels(allModels, agentResult.models);
      }

      // Completar contactInfo si falta
      if (!contactInfo.whatsapp && agentResult.contactInfo.whatsapp) {
        contactInfo.whatsapp = agentResult.contactInfo.whatsapp;
        console.log('[Firecrawl Agent] Obtuvo WhatsApp:', contactInfo.whatsapp);
      }
      if (!contactInfo.phone && agentResult.contactInfo.phone) {
        contactInfo.phone = agentResult.contactInfo.phone;
      }
      if (!contactInfo.email && agentResult.contactInfo.email) {
        contactInfo.email = agentResult.contactInfo.email;
      }

      // Agregar FAQs del agent
      if (agentResult.faqs.length > 0) {
        faqs = [...faqs, ...agentResult.faqs];
        console.log(`[Firecrawl Agent] Agregó ${agentResult.faqs.length} FAQs`);
      }

      // Agregar rawText del agent
      if (agentResult.rawText) {
        combinedMarkdown = combinedMarkdown + '\n\n--- INFORMACIÓN DEL AGENT ---\n' + agentResult.rawText;
      }
    } catch (agentError) {
      console.error('[Firecrawl] Agent fallback falló:', agentError);
    }
  }

  // Extraer redes sociales del markdown combinado
  const socialLinks = extractSocialLinks(combinedMarkdown);
  console.log('[Firecrawl] Social links found:', socialLinks);

  // ===========================================================
  // Fallback: extraer nombre de empresa del markdown si no se encontro
  // ===========================================================
  if (!companyName && combinedMarkdown) {
    // Intentar extraer del titulo o headers
    const h1Match = combinedMarkdown.match(/^#\s+([^\n]+)/m);
    const titleMatch = combinedMarkdown.match(/title[:\s]+["']?([^"'\n]+)/i);
    companyName = h1Match?.[1]?.trim() || titleMatch?.[1]?.trim() || 'Empresa';
    console.log('[Firecrawl] Company name extracted from markdown fallback:', companyName);
  }

  // ===========================================================
  // Clasificar tipo de constructora
  // ===========================================================
  const classification = classifyConstructora(
    combinedMarkdown,
    allModels.length,
    allModels.map(m => m.name)
  );
  console.log('[Firecrawl] Constructora classification:', {
    type: classification.type,
    confidence: classification.confidence.toFixed(2),
    signals: classification.signals.slice(0, 5)  // Solo primeras 5 senales para el log
  });

  // Fallback final: si aún no hay nombre, extraer del dominio de la URL
  if (!companyName) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      // Convertir dominio a nombre legible: "makenhaus.com.ar" -> "Makenhaus"
      const namePart = domain.split('.')[0];
      companyName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      console.log('[Firecrawl] Company name extracted from URL fallback:', companyName);
    } catch {
      companyName = 'Empresa';
    }
  }

  // Convertir al formato ScrapedContent
  return {
    title: companyName,
    description: buildDescription(companyDescription, constructionMethod, hasFinancing),
    services: buildServices(constructionMethod, hasFinancing, locations),
    models: allModels.map(formatModelString),
    contactInfo: formatContactInfo(contactInfo),
    rawText: combinedMarkdown.slice(0, 20000),
    faqs: faqs.length > 0 ? faqs : undefined,
    socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : undefined,
    constructoraType: classification.type,
  };
}

// Funcion para mergear modelos evitando duplicados y completando datos
function mergeModels(existing: ExtractedModel[], newModels: ExtractedModel[]): ExtractedModel[] {
  const merged = [...existing];

  for (const model of newModels) {
    if (!model.name) continue;

    const existingIndex = merged.findIndex(m =>
      m.name?.toLowerCase() === model.name?.toLowerCase() ||
      m.name?.toLowerCase() === `casa ${model.name?.toLowerCase()}` ||
      `casa ${m.name?.toLowerCase()}` === model.name?.toLowerCase()
    );

    if (existingIndex === -1) {
      // Agregar nuevo modelo
      merged.push(model);
    } else {
      // Completar datos faltantes del modelo existente
      const existing = merged[existingIndex];
      if (!existing.squareMeters && model.squareMeters) {
        existing.squareMeters = model.squareMeters;
      }
      if (!existing.coveredArea && model.coveredArea) {
        existing.coveredArea = model.coveredArea;
      }
      if (!existing.bedrooms && model.bedrooms) {
        existing.bedrooms = model.bedrooms;
      }
      if (!existing.bathrooms && model.bathrooms) {
        existing.bathrooms = model.bathrooms;
      }
      if (!existing.price && model.price) {
        existing.price = model.price;
      }
      if (!existing.features && model.features) {
        existing.features = model.features;
      }
    }
  }

  return merged;
}

// Eliminar duplicados finales
function deduplicateModels(models: ExtractedModel[]): ExtractedModel[] {
  const seen = new Map<string, ExtractedModel>();

  for (const model of models) {
    if (!model.name) continue;

    // Normalizar nombre
    const normalizedName = model.name.toLowerCase()
      .replace(/^casa\s+/i, '')
      .trim();

    if (!seen.has(normalizedName)) {
      seen.set(normalizedName, model);
    } else {
      // Mergear con el existente
      const existing = seen.get(normalizedName)!;
      if (!existing.squareMeters && model.squareMeters) {
        existing.squareMeters = model.squareMeters;
      }
      if (!existing.bedrooms && model.bedrooms) {
        existing.bedrooms = model.bedrooms;
      }
      if (!existing.bathrooms && model.bathrooms) {
        existing.bathrooms = model.bathrooms;
      }
      if (!existing.price && model.price) {
        existing.price = model.price;
      }
    }
  }

  return Array.from(seen.values());
}

function formatModelString(model: ExtractedModel): string {
  const parts: string[] = [];

  // Nombre del modelo
  const displayName = model.category === 'quincho'
    ? model.name
    : (model.name.toLowerCase().startsWith('casa ') ? model.name : `Casa ${model.name}`);
  parts.push(displayName);

  // Metros cuadrados
  if (model.squareMeters) {
    parts.push(`${model.squareMeters}m2`);
  } else if (model.coveredArea) {
    parts.push(`${model.coveredArea}m2 cubiertos`);
  }

  // Dormitorios
  if (model.bedrooms) {
    parts.push(`${model.bedrooms} dorm`);
  }

  // Banos
  if (model.bathrooms) {
    parts.push(`${model.bathrooms} bano${model.bathrooms > 1 ? 's' : ''}`);
  }

  // Precio
  if (model.price) {
    parts.push(model.price);
  }

  return parts.join(' - ');
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
