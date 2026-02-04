import Anthropic from '@anthropic-ai/sdk';
import { chromium, Browser, Page } from 'playwright';

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

export interface VisionScrapedContent {
  models: {
    name: string;
    sqMeters?: string;
    bedrooms?: string;
    bathrooms?: string;
    features?: string[];
    price?: string;
  }[];
  specifications: {
    label: string;
    value: string;
  }[];
  faq: {
    question: string;
    answer: string;
  }[];
  rawExtractedText: string;
}

/**
 * Captura screenshot de página completa
 */
export async function captureFullPage(url: string): Promise<Buffer> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Scroll para cargar contenido lazy-loaded
    await autoScroll(page);

    // Capturar página completa
    const screenshot = await page.screenshot({
      fullPage: true,
      type: 'png'
    });

    return screenshot;
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Auto-scroll para cargar contenido dinámico
 */
async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 500;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

/**
 * Analiza screenshot con Claude Vision
 */
export async function analyzeScreenshotWithClaude(
  screenshot: Buffer,
  customPrompt?: string
): Promise<VisionScrapedContent> {
  const base64Image = screenshot.toString('base64');

  const defaultPrompt = `Analiza esta captura de pantalla de un sitio web de una empresa constructora de casas prefabricadas.

Extraé TODA la información visible y estructurala así:

1. MODELOS/PRODUCTOS:
   - Nombre del modelo
   - Metros cuadrados (m², m2)
   - Cantidad de dormitorios
   - Cantidad de baños
   - Características especiales
   - Precio si está visible

2. ESPECIFICACIONES TÉCNICAS:
   - Busca tablas o listados con especificaciones
   - Dimensiones (ancho x largo x alto)
   - Materiales (DVH, steel frame, etc.)
   - Cualquier dato técnico visible

3. PREGUNTAS FRECUENTES (FAQ):
   - Si hay sección de FAQ, extrae pregunta y respuesta
   - Incluye información sobre cobertura geográfica
   - Tiempos de entrega
   - Formas de pago

4. OTRA INFORMACIÓN RELEVANTE:
   - Cobertura geográfica ("llegamos a todo el país", etc.)
   - Garantías
   - Proceso de compra

Responde en formato JSON con esta estructura:
{
  "models": [...],
  "specifications": [...],
  "faq": [...],
  "rawExtractedText": "texto completo extraído"
}`;

  const response = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: customPrompt || defaultPrompt,
          },
        ],
      },
    ],
  });

  // Parsear respuesta
  const textContent = response.content.find(c => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude Vision');
  }

  try {
    // Extraer JSON de la respuesta
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Error parsing Vision response:', e);
  }

  // Fallback: retornar respuesta como texto raw
  return {
    models: [],
    specifications: [],
    faq: [],
    rawExtractedText: textContent.text,
  };
}

/**
 * Determina si una página necesita Vision para extraer datos
 */
export function needsVisionScraping(
  url: string,
  extractedModelsCount: number
): boolean {
  const visionTriggerPaths = [
    '/modelo/', '/modelos/', '/ficha/', '/detalle/', '/detalles/',
    '/tipologia/', '/tipologias/', '/especificaciones/',
    '/producto/', '/productos/'
  ];

  // Trigger 1: URL contiene paths que típicamente tienen tablas/planos
  const hasVisionPath = visionTriggerPaths.some(path =>
    url.toLowerCase().includes(path)
  );

  // Trigger 2: Scraping normal extrajo muy pocos modelos
  const fewModelsExtracted = extractedModelsCount < 3;

  return hasVisionPath || fewModelsExtracted;
}

/**
 * Scraping completo con Vision
 */
export async function scrapeWithVision(url: string): Promise<VisionScrapedContent> {
  console.log(`[Vision Scraper] Capturando screenshot de: ${url}`);

  const screenshot = await captureFullPage(url);
  console.log(`[Vision Scraper] Screenshot capturado (${screenshot.length} bytes)`);

  const extracted = await analyzeScreenshotWithClaude(screenshot);
  console.log(`[Vision Scraper] Extraídos ${extracted.models.length} modelos, ${extracted.specifications.length} specs`);

  return extracted;
}
