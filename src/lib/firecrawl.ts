import Firecrawl from '@mendable/firecrawl-js';
import { z } from 'zod';
import { ScrapedContent } from '@/types';

const firecrawl = new Firecrawl({
  apiKey: process.env.FIRECRAWL_API_KEY!
});

// Schema mejorado para extraer MULTIPLES modelos de una pagina de catalogo
const catalogSchema = z.object({
  companyName: z.string().optional().describe("Nombre de la empresa constructora"),
  companyDescription: z.string().optional().describe("Descripcion de la empresa"),
  models: z.array(z.object({
    name: z.string().describe("Nombre del modelo (Sara, Daniela, Carmela, Justina, etc.)"),
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
    name: z.string().describe("Nombre o tamanio del quincho (S, M, L, A)"),
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

export async function scrapeWithFirecrawl(url: string): Promise<ScrapedContent> {
  console.log('[Firecrawl] Starting improved multi-model extraction for:', url);

  // PASO 1: Mapear todas las URLs del sitio
  console.log('[Firecrawl] Step 1: Mapping URLs...');
  const mapResult = await firecrawl.mapUrl(url, {
    limit: 50
  });

  if (!mapResult.success || !mapResult.links) {
    throw new Error(`Firecrawl map failed: ${mapResult.error || 'No links found'}`);
  }

  const allUrls = mapResult.links;
  console.log('[Firecrawl] Found URLs:', allUrls.length, allUrls);

  // PASO 2: Identificar URLs por tipo
  const catalogUrls = allUrls.filter(u => {
    const path = new URL(u).pathname.toLowerCase();
    return path.includes('/casas') ||
           path.includes('/modelos') ||
           path.includes('/catalogo') ||
           path.includes('/productos') ||
           path.includes('/quinchos');
  });

  const modelUrls = allUrls.filter(u => {
    const path = new URL(u).pathname.toLowerCase();
    return (path.includes('casa-') || path.includes('modelo-')) &&
           !catalogUrls.includes(u);
  });

  const homeUrl = allUrls.find(u => new URL(u).pathname === '/') || url;

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

  // PASO 3: Scrapear paginas de CATALOGO primero (tienen todos los modelos)
  if (catalogUrls.length > 0) {
    console.log('[Firecrawl] Step 3: Scraping catalog pages...');

    for (const catalogUrl of catalogUrls) {
      try {
        console.log('[Firecrawl] Scraping catalog:', catalogUrl);
        const result = await firecrawl.scrapeUrl(catalogUrl, {
          formats: ['markdown', 'extract'],
          extract: { schema: catalogSchema }
        });

        if (!result.success) {
          console.error('[Firecrawl] Catalog scrape failed:', result.error);
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
      } catch (error) {
        console.error('[Firecrawl] Error scraping catalog:', catalogUrl, error);
      }
    }
  }

  // PASO 4: Si no tenemos suficientes modelos, scrapear paginas individuales
  if (allModels.length < 3 && modelUrls.length > 0) {
    console.log('[Firecrawl] Step 4: Scraping individual model pages (found only', allModels.length, 'models)...');

    const urlsToScrape = modelUrls.slice(0, 12);

    for (const modelUrl of urlsToScrape) {
      try {
        console.log('[Firecrawl] Scraping model page:', modelUrl);
        const result = await firecrawl.scrapeUrl(modelUrl, {
          formats: ['markdown', 'extract'],
          extract: { schema: singleModelSchema }
        });

        if (!result.success) {
          console.error('[Firecrawl] Model page scrape failed:', result.error);
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
      } catch (error) {
        console.error('[Firecrawl] Error scraping model page:', modelUrl, error);
      }
    }
  }

  // PASO 5: Scrapear homepage para info de empresa si falta
  if (!companyName || !contactInfo.phone) {
    console.log('[Firecrawl] Step 5: Scraping homepage for company info...');
    try {
      const homeResult = await firecrawl.scrapeUrl(homeUrl, {
        formats: ['markdown', 'extract'],
        extract: { schema: catalogSchema }
      });

      if (!homeResult.success) {
        console.error('[Firecrawl] Homepage scrape failed:', homeResult.error);
      } else {
        const extract = homeResult.extract as z.infer<typeof catalogSchema> | undefined;

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
      }
    } catch (error) {
      console.error('[Firecrawl] Error scraping homepage:', error);
    }
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
function parseModelsFromMarkdown(markdown: string): ExtractedModel[] {
  const models: ExtractedModel[] = [];

  // Nombres conocidos de modelos de casas
  const knownModelNames = [
    'Sara', 'Daniela', 'Justina', 'Dora', 'Micaela', 'Estefania', 'Estefanía',
    'Carmela', 'Selene', 'Valeria', 'Maria', 'María', 'Aurora', 'Duna', 'Elena',
    'Sofia', 'Sofía', 'Victoria', 'Lucia', 'Lucía', 'Andrea', 'Paula', 'Laura'
  ];

  // Buscar cada nombre conocido en el markdown
  for (const name of knownModelNames) {
    // Buscar patrones como "Casa Sara" o "SARA" o "Sara - 65m2"
    const patterns = [
      new RegExp(`(?:Casa\\s+)?${name}[^\\n]*?(\\d+(?:[.,]\\d+)?)\\s*m[²2]`, 'gi'),
      new RegExp(`${name}[^\\n]*?(\\d+)\\s*(?:dorm|dormitorio|habitacion)`, 'gi'),
      new RegExp(`(?:Casa\\s+)?${name}`, 'gi')
    ];

    for (const pattern of patterns) {
      const match = markdown.match(pattern);
      if (match) {
        // Verificar si ya existe
        const exists = models.some(m =>
          m.name?.toLowerCase() === name.toLowerCase() ||
          m.name?.toLowerCase() === `casa ${name.toLowerCase()}`
        );

        if (!exists) {
          // Buscar mas datos cerca del nombre
          const contextMatch = markdown.match(new RegExp(
            `${name}[^\\n]{0,200}`, 'i'
          ));
          const context = contextMatch ? contextMatch[0] : '';

          // Extraer metros cuadrados
          const sqmMatch = context.match(/(\d+(?:[.,]\d+)?)\s*m[²2]/i);
          const sqm = sqmMatch ? parseFloat(sqmMatch[1].replace(',', '.')) : undefined;

          // Extraer dormitorios
          const bedroomMatch = context.match(/(\d+)\s*(?:dorm|dormitorio|habitacion)/i);
          const bedrooms = bedroomMatch ? parseInt(bedroomMatch[1]) : undefined;

          // Extraer banos
          const bathroomMatch = context.match(/(\d+)\s*(?:baño|bano|bath)/i);
          const bathrooms = bathroomMatch ? parseInt(bathroomMatch[1]) : undefined;

          models.push({
            name: name,
            squareMeters: sqm,
            bedrooms: bedrooms,
            bathrooms: bathrooms,
            category: 'casa'
          });

          break; // Solo agregar una vez por nombre
        }
      }
    }
  }

  // Buscar quinchos (S, M, L, A)
  const quinchoPatterns = [
    /quincho\s*(?:tama[ñn]o\s*)?(S|M|L|A|XL|XXL)/gi,
    /quincho\s+(S|M|L|A|XL|XXL)/gi,
    /(S|M|L|A)\s*-?\s*quincho/gi
  ];

  for (const pattern of quinchoPatterns) {
    let match;
    while ((match = pattern.exec(markdown)) !== null) {
      const size = match[1].toUpperCase();
      const quinchoName = `Quincho ${size}`;

      const exists = models.some(m => m.name === quinchoName);
      if (!exists) {
        models.push({
          name: quinchoName,
          category: 'quincho'
        });
      }
    }
  }

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
