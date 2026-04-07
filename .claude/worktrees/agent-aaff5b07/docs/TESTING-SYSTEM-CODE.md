# Sistema de Testing - Constructor AI Simulator

Este documento contiene todo el codigo implementado del sistema de testing E2E con Playwright, incluyendo evaluacion de calidad de respuestas mediante LLM y generacion de reportes.

## Estructura de Archivos

```
tests/e2e/
├── playwright.config.ts          # Configuracion de Playwright
├── simulator.spec.ts             # Tests principales E2E
├── run-batch-test.ts             # Script CLI para ejecutar tests en batch
├── fixtures/
│   ├── test-questions.json       # Preguntas de prueba con patrones esperados
│   └── test-companies.json       # Empresas a testear
├── helpers/
│   ├── quality-evaluator.ts      # Evaluador de calidad con Claude
│   └── report-generator.ts       # Generador de reportes
└── results/                      # Directorio de resultados (generado)
    └── batch-{timestamp}/
        ├── summary-report.json
        ├── REPORT.md
        └── {company-id}/
            ├── conversation.json
            ├── evaluation.json
            └── screenshots/
```

## Comandos de Ejecucion

```bash
# Instalar dependencias (si no estan instaladas)
npm install @playwright/test @anthropic-ai/sdk

# Ejecutar tests localmente (requiere servidor corriendo en localhost:3000)
npm run test:e2e

# Ejecutar con script batch
npx ts-node tests/e2e/run-batch-test.ts

# Ejecutar contra produccion
npx ts-node tests/e2e/run-batch-test.ts --production

# Ejecutar con navegador visible
npx ts-node tests/e2e/run-batch-test.ts --headed

# Limitar cantidad de empresas
npx ts-node tests/e2e/run-batch-test.ts --companies 3

# Ejecutar con debug
npx ts-node tests/e2e/run-batch-test.ts --debug

# Ver reporte HTML despues de ejecutar
npx playwright show-report tests/e2e/results/html-report
```

---

## PROBLEMAS CONOCIDOS (2026-02-03)

### 1. Modelo Claude Invalido en scraper.ts

**Ubicacion:** `src/lib/scraper.ts` linea ~363
**Problema:** El modelo `claude-3-5-sonnet-20241022` ya no existe, da error 404
**Solucion pendiente:** Cambiar a `claude-sonnet-4-20250514` o modelo valido actual

### 2. Sitios Single-Page (SPA) no encuentran links internos

**Problema:** Sitios construidos con Wix, React, o similares no tienen links `<a href>` tradicionales
**Ejemplo afectado:** vibert.com.ar - encuentra 0 links internos
**Consecuencia:** Solo se scrapea la homepage, perdiendo informacion de modelos en otras paginas

### 3. vibert.com.ar extrae 0 modelos actualmente

**Problema:** A pesar de tener 10+ modelos en su sitio (Sara, Daniela, Justina, etc.), el scraper extrae 0
**Causa probable:** Combinacion de SPA + contenido renderizado con JS que no se captura
**Estado:** Necesita investigacion con Firecrawl u otra herramienta

### 4. Respuestas Genericas del Agente

**Problema:** Todas las empresas testeadas responden igual ("dejame consultarlo con el equipo")
**Causa:** El scraper no extrae datos especificos, entonces el prompt no tiene informacion concreta
**Solucion:** Arreglar scraper primero, luego re-evaluar calidad de respuestas

---

## RESULTADOS DE TESTS (2026-02-03)

| Empresa | Score | Estado | Notas |
|---------|-------|--------|-------|
| ViBert Construcciones | 78/100 | PASS* | Respuestas genericas, no menciona modelos especificos |
| Steel Framing Argentina | 80/100 | PASS* | Mismo problema - respuestas genericas |

*PASS con asterisco porque el score viene de tono/relevancia, no de especificidad de datos.

**Patron comun en todas las respuestas:**
- "Dejame consultarlo con el equipo"
- "Te paso la info por WhatsApp"
- No menciona nombres de modelos ni precios
- Score de "especificidad" muy bajo pero "tono" alto

---

## Codigo del Scraper Actual (src/lib/scraper.ts)

El scraper fue mejorado para usar Playwright en lugar de fetch simple. Soporta:
- Navegacion con browser headless
- Espera para renderizado de JS (3 segundos)
- Extraccion de links internos
- Crawling de paginas de modelos
- Extraccion con AI usando Claude

```typescript
import * as cheerio from 'cheerio';
import Anthropic from '@anthropic-ai/sdk';
import { chromium, Browser, Page } from 'playwright';
import { ScrapedContent } from '@/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Keywords que indican páginas con modelos/productos
const MODEL_KEYWORDS = [
  'modelo', 'modelos', 'casa', 'casas', 'vivienda', 'viviendas',
  'proyecto', 'proyectos', 'producto', 'productos', 'catalogo',
  'portfolio', 'obras', 'construcciones', 'planos', 'diseños',
  'cabana', 'cabañas', 'duplex', 'departamento', 'loft'
];

// Timeout para navegación
const NAV_TIMEOUT = 45000;
const MAX_PAGES_TO_CRAWL = 10;
const WAIT_AFTER_LOAD = 3000; // Esperar que JS renderice

export async function scrapeWebsite(url: string): Promise<ScrapedContent> {
  console.log('[Scraper] Starting deep scrape for:', url);

  try {
    // Intentar scraping profundo con Playwright
    return await deepScrapeWithPlaywright(url);
  } catch (error) {
    console.error('[Scraper] Playwright scraping failed:', error);
    console.log('[Scraper] Falling back to basic fetch scraping');
    // Fallback al método tradicional
    return await basicFetchScrape(url);
  }
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

    // 1. Navegar a la homepage
    console.log('[Scraper] Navigating to homepage:', url);
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: NAV_TIMEOUT
    });

    // Esperar que JS renderice el contenido (importante para sitios Wix/React)
    console.log('[Scraper] Waiting for JS to render...');
    await page.waitForTimeout(WAIT_AFTER_LOAD);

    // Intentar esperar a que haya contenido visible
    try {
      await page.waitForSelector('body', { state: 'visible', timeout: 5000 });
    } catch {
      // Continuar aunque no se cumpla
    }

    // 2. Extraer contenido de la homepage
    const homepageContent = await extractPageContent(page);
    console.log('[Scraper] Homepage content length:', homepageContent.text.length);

    // 3. Extraer todos los links internos
    const baseUrl = new URL(url);
    const internalLinks = await extractInternalLinks(page, baseUrl);
    console.log('[Scraper] Found internal links:', internalLinks.length);

    // 4. Filtrar links que parecen tener modelos
    const modelLinks = filterModelLinks(internalLinks, baseUrl);
    console.log('[Scraper] Model-related links:', modelLinks);

    // 5. Visitar cada página de modelos y extraer contenido
    const allPageContents: PageContent[] = [homepageContent];

    for (const link of modelLinks.slice(0, MAX_PAGES_TO_CRAWL)) {
      try {
        console.log('[Scraper] Crawling:', link);
        await page.goto(link, {
          waitUntil: 'domcontentloaded',
          timeout: NAV_TIMEOUT
        });
        // Esperar para que JS renderice
        await page.waitForTimeout(WAIT_AFTER_LOAD);

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
      modelsCount: extractedInfo.models.length,
    });

    return extractedInfo;

  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// ... (resto del codigo en el archivo original)
```

**Funciones principales:**
- `scrapeWebsite(url)` - Entry point, intenta Playwright, fallback a fetch
- `deepScrapeWithPlaywright(url)` - Scraping completo con browser
- `extractPageContent(page)` - Extrae texto y headings de una pagina
- `extractInternalLinks(page, baseUrl)` - Encuentra links del mismo dominio
- `filterModelLinks(links, baseUrl)` - Filtra links relevantes a modelos
- `extractWithAI(content)` - Usa Claude para estructurar la informacion

---

## Archivos de Testing

### 1. playwright.config.ts

Configuracion de Playwright para los tests E2E. Define timeouts largos porque el scraping puede tardar, ejecuta tests secuencialmente para evitar rate limits, y configura multiples reporters (HTML, JSON, consola).

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './',
  fullyParallel: false, // Run sequentially to avoid rate limits
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to avoid concurrent sessions
  reporter: [
    ['html', { outputFolder: './results/html-report' }],
    ['json', { outputFile: './results/test-results.json' }],
    ['list'],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'on-first-retry',

    // Timeout for actions
    actionTimeout: 30000,
    navigationTimeout: 60000,
  },

  timeout: 180000, // 3 minutes per test (scraping can be slow)

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run local server if not testing against production
  webServer: process.env.BASE_URL ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

**Puntos clave:**
- `fullyParallel: false` y `workers: 1` - Ejecuta tests secuencialmente para evitar rate limits de APIs
- `timeout: 180000` - 3 minutos por test porque el scraping de sitios web puede ser lento
- `webServer` - Levanta automaticamente el servidor de desarrollo si no se especifica URL de produccion
- Multiples reporters para tener resultados en diferentes formatos

---

### 2. test-questions.json

Define las preguntas de prueba que se envian al agente. Cada pregunta tiene patrones esperados (que deberian aparecer en la respuesta) y anti-patrones (que indican una mala respuesta).

```json
{
  "questions": [
    {
      "id": "models_list",
      "question": "Que modelos tienen?",
      "description": "Debe listar modelos con m2 y dormitorios",
      "expectedPatterns": ["m2", "m²", "dormitorios", "modelo", "habitaciones"],
      "antiPatterns": ["no tengo", "no dispongo", "no cuento con"]
    },
    {
      "id": "specific_price",
      "question": "Cuanto cuesta el modelo mas chico?",
      "description": "Debe dar precio o pedir ubicacion para cotizar",
      "expectedPatterns": ["$", "USD", "precio", "ubicacion", "cotizacion", "presupuesto", "dolar"],
      "antiPatterns": ["no puedo", "no tengo informacion", "no dispongo"]
    },
    {
      "id": "location",
      "question": "Construyen en Cordoba?",
      "description": "Debe responder si/no con explicacion sobre zonas",
      "expectedPatterns": ["si", "no", "zona", "provincia", "region", "area", "trabajamos", "construimos"],
      "antiPatterns": ["no se", "no tengo forma de saber"]
    },
    {
      "id": "obra_gris",
      "question": "Que incluye la obra gris?",
      "description": "Debe detallar que incluye y que no",
      "expectedPatterns": ["incluye", "estructura", "mamposteria", "losa", "instalaciones", "terminaciones"],
      "antiPatterns": ["no se", "no tengo informacion", "no puedo"]
    },
    {
      "id": "financing",
      "question": "Tienen financiamiento?",
      "description": "Debe explicar opciones de pago",
      "expectedPatterns": ["cuotas", "pago", "contado", "financiamiento", "financiacion", "plan", "credito"],
      "antiPatterns": ["no se", "no tengo esa informacion"]
    },
    {
      "id": "recommendation",
      "question": "Quiero una casa de 2 dormitorios",
      "description": "Debe recomendar modelos especificos",
      "expectedPatterns": ["modelo", "m2", "m²", "recomiendo", "opciones", "alternativas", "ideal"],
      "antiPatterns": ["no tengo", "no cuento con", "no dispongo"]
    }
  ]
}
```

**Proposito de cada pregunta:**
- `models_list` - Verifica que el agente tenga y pueda listar los modelos de la empresa
- `specific_price` - Verifica manejo de precios (datos sensibles que varian por ubicacion)
- `location` - Verifica conocimiento sobre zonas de cobertura
- `obra_gris` - Verifica conocimiento tecnico del rubro
- `financing` - Verifica informacion comercial sobre formas de pago
- `recommendation` - Verifica capacidad de recomendar basado en necesidades del cliente

---

### 3. test-companies.json

Lista de empresas constructoras para testear. Incluye el "gold standard" (ViBert) y otras empresas para comparar la calidad de extraccion.

```json
{
  "companies": [
    {
      "id": "vibert",
      "name": "ViBert Construcciones",
      "websiteUrl": "https://vibertconstrucciones.com",
      "pdfUrl": null,
      "expectedBehavior": "Gold standard - Sofia original",
      "notes": "Empresa de referencia para comparar calidad"
    },
    {
      "id": "steel-framing-argentina",
      "name": "Steel Framing Argentina",
      "websiteUrl": "https://steelframingargentina.com.ar",
      "pdfUrl": null,
      "expectedBehavior": "Empresa grande con multiples modelos",
      "notes": "Deberia tener informacion detallada de modelos"
    }
  ]
}
```

---

### 4. quality-evaluator.ts

Evaluador de calidad de respuestas usando Claude. Combina evaluacion por patrones (rapida) con evaluacion LLM (profunda). Calcula scores ponderados en 5 dimensiones.

```typescript
import Anthropic from '@anthropic-ai/sdk';

interface QuestionConfig {
  id: string;
  question: string;
  description: string;
  expectedPatterns: string[];
  antiPatterns: string[];
}

interface EvaluationResult {
  questionId: string;
  question: string;
  response: string;
  scores: {
    specificity: number;    // 30% - Menciona datos concretos
    relevance: number;      // 25% - Responde la pregunta
    noInvention: number;    // 20% - No fabrica datos
    tone: number;           // 15% - Profesional, calido, usa "vos"
    action: number;         // 10% - Intenta calificar lead
  };
  totalScore: number;
  patternMatches: string[];
  antiPatternMatches: string[];
  reasoning: string;
  passed: boolean;
}

// ... (resto del codigo en helpers/quality-evaluator.ts)
```

**Sistema de puntuacion:**
- **Especificidad (30%)** - Lo mas importante: que mencione datos concretos de la empresa
- **Relevancia (25%)** - Que responda lo que se pregunto
- **No invencion (20%)** - Que no fabrique informacion
- **Tono (15%)** - Que sea calido y use "vos" (estilo argentino)
- **Accion (10%)** - Que intente capturar el lead

**Fallback:** Si el LLM falla, usa evaluacion por patrones como respaldo.

---

## Dependencias Requeridas

```json
{
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "@anthropic-ai/sdk": "^0.10.0",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.0"
  }
}
```

## Variables de Entorno

```bash
# Requerida para evaluacion LLM
ANTHROPIC_API_KEY=sk-ant-...

# Opcional - URL base para tests
BASE_URL=http://localhost:3000
```
