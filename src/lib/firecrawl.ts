import Firecrawl from '@mendable/firecrawl-js';
import { z } from 'zod';
import { ScrapedContent } from '@/types';

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
const MAX_CATALOG_URLS = 10; // Maximo URLs de catalogo a scrapear
const BATCH_SIZE = 10; // URLs a procesar en paralelo (aumentado para mejor performance)

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
    'tipologia', 'tipologias',
    'modulo', 'modulos',
    'residencial', 'residenciales',
    'linea', 'lineas',
    'productos', 'producto',
    // Galeria y obras
    'galeria', 'gallery',
    'obras', 'trabajos',
    // Tipos especificos
    'refugio', 'refugios',
    'tiny', 'container', 'prefabricada', 'prefabricadas',
    'steel-frame', 'steelframe',
    'modulares', 'modular',
    // Quinchos
    'quinchos', 'quincho'
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
  let allMarkdown = '';
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

      // Scrapear URLs del batch en paralelo
      const results = await Promise.all(
        batch.map(async (catalogUrl) => {
          try {
            console.log('[Firecrawl] Scraping catalog:', catalogUrl);
            const result = await getFirecrawl().scrapeUrl(catalogUrl, {
              formats: ['markdown', 'extract'],
              extract: { schema: catalogSchema }
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

      // Procesar resultados del batch
      for (const { catalogUrl, result, error } of results) {
        if (error || !result?.success) {
          if (result && !result.success) {
            console.error('[Firecrawl] Catalog scrape failed:', result.error);
          }
          continue;
        }

        const extract = result.extract as z.infer<typeof catalogSchema> | undefined;

        // Extraer modelos del schema
        if (extract?.models && Array.isArray(extract.models)) {
          console.log('[Firecrawl] Found models in catalog extract:', extract.models.length);
          for (const model of extract.models) {
            if (model.name) {
              allModels.push({
                name: model.name,
                squareMeters: model.squareMeters,
                coveredArea: model.coveredArea,
                semicoveredArea: model.semicoveredArea,
                bedrooms: model.bedrooms,
                bathrooms: model.bathrooms,
                price: model.price,
                features: model.features,
                category: model.category || 'casa'
              });
            }
          }
        }

        // Extraer quinchos
        if (extract?.quinchos && Array.isArray(extract.quinchos)) {
          console.log('[Firecrawl] Found quinchos:', extract.quinchos.length);
          for (const quincho of extract.quinchos) {
            if (quincho.name) {
              allModels.push({
                name: `Quincho ${quincho.name}`,
                squareMeters: quincho.squareMeters,
                features: quincho.features,
                category: 'quincho'
              });
            }
          }
        }

        // Extraer info de empresa
        if (extract?.companyName && !companyName) {
          companyName = extract.companyName;
        }
        if (extract?.companyDescription && !companyDescription) {
          companyDescription = extract.companyDescription;
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
        if (extract?.locations) {
          locations.push(...extract.locations);
        }
        if (extract?.constructionMethod) {
          constructionMethod = extract.constructionMethod;
        }
        if (extract?.financing) {
          hasFinancing = true;
        }

        // IMPORTANTE: Parsear el markdown para extraer datos que el schema no capturo
        if (result.markdown) {
          console.log('[Firecrawl] Parsing markdown from catalog, length:', result.markdown.length);
          allMarkdown += `\n\n--- ${catalogUrl} ---\n${result.markdown}`;

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
            allMarkdown += `\n\n--- ${modelUrl} ---\n${result.markdown}`;

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
      allMarkdown += `\n\n--- ${homeUrl} ---\n${homeResult.markdown}`;

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

  // Convertir al formato ScrapedContent
  return {
    title: companyName || 'Empresa Constructora',
    description: buildDescription(companyDescription, constructionMethod, hasFinancing),
    services: buildServices(constructionMethod, hasFinancing, locations),
    models: allModels.map(formatModelString),
    contactInfo: formatContactInfo(contactInfo),
    rawText: allMarkdown.slice(0, 20000)
  };
}

// Funcion para parsear modelos del markdown raw
// IMPORTANTE: NO usar nombres hardcodeados - cada empresa tiene sus propios modelos
function parseModelsFromMarkdown(markdown: string): ExtractedModel[] {
  const models: ExtractedModel[] = [];

  // Buscar patrones genericos de modelos con m2
  const genericPattern = /(?:modelo|casa|vivienda)\s+["']?(\w+)["']?\s*[-–]?\s*(\d+(?:[.,]\d+)?)\s*m[²2]/gi;
  let match;
  while ((match = genericPattern.exec(markdown)) !== null) {
    const name = match[1];
    const sqm = parseFloat(match[2].replace(',', '.'));

    // No agregar si es un numero o palabra muy corta
    if (name.length < 3 || /^\d+$/.test(name)) continue;

    const exists = models.some(m =>
      m.name?.toLowerCase() === name.toLowerCase()
    );

    if (!exists) {
      models.push({
        name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
        squareMeters: sqm,
        category: 'casa'
      });
    }
  }

  return models;
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
