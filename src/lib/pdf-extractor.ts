import pdf from 'pdf-parse';
import Anthropic from '@anthropic-ai/sdk';

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

// Increased limit for better extraction
const MAX_PDF_TEXT_LENGTH = 25000;

export interface ExtractedCatalog {
  rawText: string;
  models: CatalogModel[];
  prices: string[];
  features: string[];
  specifications: string[];
}

export interface CatalogModel {
  name: string;
  description: string;
  sqMeters?: string;
  bedrooms?: string;
  bathrooms?: string;
  price?: string;
  features?: string[];
}

/**
 * Extrae texto de un PDF usando pdf-parse (solo funciona con PDFs basados en texto)
 */
export async function extractPdfFromUrl(pdfUrl: string): Promise<string> {
  try {
    console.log('[PDF] Fetching from URL:', pdfUrl);
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return await extractTextFromBuffer(buffer);
  } catch (error) {
    console.error('[PDF] URL extraction error:', error);
    return '';
  }
}

/**
 * Descarga el PDF y lo convierte a base64 para usar con Claude Vision
 */
export async function fetchPdfAsBase64(pdfUrl: string): Promise<string | null> {
  try {
    console.log('[PDF] Fetching PDF for vision analysis:', pdfUrl);
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    console.log('[PDF] PDF converted to base64, length:', base64.length);
    return base64;
  } catch (error) {
    console.error('[PDF] Error fetching PDF for vision:', error);
    return null;
  }
}

export async function extractPdfFromBase64(base64Data: string): Promise<string> {
  try {
    const base64Clean = base64Data.replace(/^data:application\/pdf;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');

    return await extractTextFromBuffer(buffer);
  } catch (error) {
    console.error('[PDF] Base64 extraction error:', error);
    return '';
  }
}

async function extractTextFromBuffer(buffer: Buffer): Promise<string> {
  try {
    const data = await pdf(buffer);
    console.log('[PDF] Extracted pages:', data.numpages);
    console.log('[PDF] Raw text length:', data.text.length);

    // Clean text but keep more content
    const cleanText = data.text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\sáéíóúüñÁÉÍÓÚÜÑ.,;:$%°²³\-\/()@#&*+=\[\]{}|"'<>]/g, ' ')
      .trim();

    console.log('[PDF] Clean text length:', cleanText.length);
    return cleanText.slice(0, MAX_PDF_TEXT_LENGTH);
  } catch (error) {
    console.error('[PDF] Parsing error:', error);
    return '';
  }
}

/**
 * Analiza el contenido del PDF con IA para extraer información estructurada
 */
export async function analyzePdfWithAI(pdfText: string): Promise<ExtractedCatalog> {
  if (!pdfText || pdfText.length < 50) {
    return {
      rawText: pdfText,
      models: [],
      prices: [],
      features: [],
      specifications: [],
    };
  }

  console.log('[PDF] Analyzing with AI, text length:', pdfText.length);

  try {
    const response = await getAnthropic().messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: `Analiza este catálogo/brochure de una constructora y extrae TODA la información de modelos de viviendas.

CONTENIDO DEL CATÁLOGO:
${pdfText.slice(0, 20000)}

Extrae y responde SOLO con un JSON válido:
{
  "models": [
    {
      "name": "nombre completo del modelo tal como aparece en el PDF",
      "description": "descripción del modelo",
      "sqMeters": "metros cuadrados si está disponible",
      "bedrooms": "cantidad de dormitorios",
      "bathrooms": "cantidad de baños",
      "price": "precio si está disponible",
      "features": ["lista de características: galería, quincho, pileta, etc."]
    }
  ],
  "prices": ["todos los precios mencionados con contexto"],
  "features": ["características generales de la empresa/sistema constructivo"],
  "specifications": ["especificaciones técnicas: materiales, tiempos de obra, etc."]
}

IMPORTANTE:
- Incluí TODOS los modelos que encuentres, con sus nombres EXACTOS
- Si hay precios, incluilos tal cual aparecen
- Si hay medidas en m², incluilas
- Si no encontrás algo, usá array vacío []`,
        },
      ],
    });

    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('');

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const extracted = JSON.parse(jsonMatch[0]);
    console.log('[PDF] AI extracted models:', extracted.models?.length || 0);

    return {
      rawText: pdfText,
      models: Array.isArray(extracted.models) ? extracted.models : [],
      prices: Array.isArray(extracted.prices) ? extracted.prices : [],
      features: Array.isArray(extracted.features) ? extracted.features : [],
      specifications: Array.isArray(extracted.specifications) ? extracted.specifications : [],
    };
  } catch (error) {
    console.error('[PDF] AI analysis error:', error);
    return {
      rawText: pdfText,
      models: [],
      prices: [],
      features: [],
      specifications: [],
    };
  }
}

/**
 * NUEVO: Analiza el PDF directamente con Claude Vision (funciona con PDFs de imagen)
 * Esta es la función principal que debe usarse para catálogos de constructoras
 */
export async function analyzePdfWithVision(pdfUrl: string): Promise<ExtractedCatalog> {
  console.log('[PDF Vision] Starting analysis for:', pdfUrl);

  try {
    // Fetch the PDF as base64
    const pdfBase64 = await fetchPdfAsBase64(pdfUrl);

    if (!pdfBase64) {
      console.error('[PDF Vision] Failed to fetch PDF');
      return {
        rawText: '',
        models: [],
        prices: [],
        features: [],
        specifications: [],
      };
    }

    console.log('[PDF Vision] Sending to Claude for document analysis...');

    // Use Claude's document understanding capability
    const response = await getAnthropic().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              type: 'text',
              text: `Sos un experto en análisis de catálogos de constructoras de viviendas.

TAREA: Analiza este catálogo/brochure de una constructora y extrae ABSOLUTAMENTE TODA la información de modelos de viviendas que encuentres.

BUSCA ESPECÍFICAMENTE:
1. Nombres de modelos de casas (ej: "Modelo Aurora", "Casa Premium", "Vivienda Familiar")
2. Superficies en metros cuadrados (m²)
3. Cantidad de dormitorios y baños
4. Precios (en pesos, dólares, o cualquier moneda)
5. Características incluidas (pileta, quincho, galería, cochera, etc.)
6. Materiales de construcción (steel frame, tradicional, etc.)
7. Tiempos de entrega
8. Cualquier especificación técnica

RESPONDE ÚNICAMENTE con un JSON válido en este formato exacto:
{
  "models": [
    {
      "name": "nombre exacto del modelo",
      "description": "descripción breve",
      "sqMeters": "superficie en m²",
      "bedrooms": "cantidad de dormitorios",
      "bathrooms": "cantidad de baños",
      "price": "precio completo como aparece",
      "features": ["característica 1", "característica 2"]
    }
  ],
  "prices": ["lista de todos los precios mencionados con contexto"],
  "features": ["características generales del sistema constructivo"],
  "specifications": ["especificaciones técnicas encontradas"],
  "rawTextExtracted": "resumen del contenido principal del catálogo"
}

REGLAS CRÍTICAS:
- Incluí TODOS los modelos que veas, aunque tengas que leer varias páginas
- Los nombres deben ser EXACTAMENTE como aparecen en el catálogo
- Si hay precios, incluí el valor completo (ej: "USD 45.000", "$8.500.000")
- Si algo no está disponible, usá null o array vacío
- NO inventes información que no esté en el documento`,
            },
          ],
        },
      ],
    });

    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('');

    console.log('[PDF Vision] Claude response length:', responseText.length);
    console.log('[PDF Vision] Response preview:', responseText.slice(0, 500));

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[PDF Vision] No JSON found in response');
      throw new Error('No JSON found in Claude response');
    }

    const extracted = JSON.parse(jsonMatch[0]);

    console.log('[PDF Vision] Successfully extracted:', {
      modelsCount: extracted.models?.length || 0,
      pricesCount: extracted.prices?.length || 0,
      featuresCount: extracted.features?.length || 0,
    });

    // Log model names for verification
    if (extracted.models?.length > 0) {
      console.log('[PDF Vision] Models found:', extracted.models.map((m: CatalogModel) => m.name));
    }

    return {
      rawText: extracted.rawTextExtracted || '',
      models: Array.isArray(extracted.models) ? extracted.models : [],
      prices: Array.isArray(extracted.prices) ? extracted.prices : [],
      features: Array.isArray(extracted.features) ? extracted.features : [],
      specifications: Array.isArray(extracted.specifications) ? extracted.specifications : [],
    };
  } catch (error) {
    console.error('[PDF Vision] Analysis error:', error);

    // Fallback: try text-based extraction
    console.log('[PDF Vision] Falling back to text-based extraction...');
    try {
      const textContent = await extractPdfFromUrl(pdfUrl);
      if (textContent && textContent.length > 100) {
        return await analyzePdfWithAI(textContent);
      }
    } catch (fallbackError) {
      console.error('[PDF Vision] Fallback also failed:', fallbackError);
    }

    return {
      rawText: '',
      models: [],
      prices: [],
      features: [],
      specifications: [],
    };
  }
}

/**
 * Formatea el catálogo extraído para incluir en el prompt
 */
export function formatCatalogForPrompt(catalog: ExtractedCatalog): string {
  if (!catalog.rawText && catalog.models.length === 0) {
    return '';
  }

  const parts: string[] = [];

  if (catalog.models.length > 0) {
    parts.push('=== MODELOS DE VIVIENDAS DISPONIBLES ===');
    catalog.models.forEach((model, index) => {
      const modelInfo: string[] = [`${index + 1}. ${model.name}`];
      if (model.description) modelInfo.push(`   Descripción: ${model.description}`);
      if (model.sqMeters) modelInfo.push(`   Superficie: ${model.sqMeters}`);
      if (model.bedrooms) modelInfo.push(`   Dormitorios: ${model.bedrooms}`);
      if (model.bathrooms) modelInfo.push(`   Baños: ${model.bathrooms}`);
      if (model.price) modelInfo.push(`   Precio: ${model.price}`);
      if (model.features && model.features.length > 0) {
        modelInfo.push(`   Incluye: ${model.features.join(', ')}`);
      }
      parts.push(modelInfo.join('\n'));
    });
  }

  if (catalog.prices.length > 0) {
    parts.push('\n=== PRECIOS ===');
    parts.push(catalog.prices.join('\n'));
  }

  if (catalog.features.length > 0) {
    parts.push('\n=== CARACTERÍSTICAS DEL SISTEMA ===');
    parts.push(catalog.features.join('\n'));
  }

  if (catalog.specifications.length > 0) {
    parts.push('\n=== ESPECIFICACIONES TÉCNICAS ===');
    parts.push(catalog.specifications.join('\n'));
  }

  // Also include raw text for additional context
  if (catalog.rawText) {
    parts.push('\n=== INFORMACIÓN ADICIONAL DEL CATÁLOGO ===');
    parts.push(catalog.rawText.slice(0, 8000));
  }

  return parts.join('\n');
}

// Legacy function for compatibility
export function formatPdfContent(text: string): string {
  if (!text) return '';
  return text;
}
