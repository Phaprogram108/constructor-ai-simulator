import pdf from 'pdf-parse';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
    const response = await anthropic.messages.create({
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
      "name": "nombre completo del modelo (ej: 'Modelo Carmela', 'Casa Aurora')",
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
