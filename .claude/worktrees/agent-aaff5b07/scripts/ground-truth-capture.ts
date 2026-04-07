/**
 * Ground Truth Capture Script
 *
 * Captures real information from 20 construction company websites using
 * Playwright for navigation/screenshots and Claude Vision for analysis.
 *
 * Usage:
 *   npx tsx scripts/ground-truth-capture.ts
 *   npx tsx scripts/ground-truth-capture.ts --company "Atlas Housing"
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompanyInput {
  name: string;
  url: string;
  knownIssue?: string;
  expectedModels?: string[];
  notes?: string;
}

interface TestCompaniesFile {
  companies: {
    problematicas: CompanyInput[];
    aleatorias: CompanyInput[];
  };
}

interface ModelInfo {
  name: string;
  detailUrl?: string;
  sqMeters?: number;
  bedrooms?: number;
  bathrooms?: number;
  price?: string;
  features: string[];
  source: 'detail_page' | 'catalog_page' | 'homepage';
  screenshot?: string;
}

interface GroundTruthData {
  company: string;
  url: string;
  capturedAt: string;
  type: 'modular' | 'tradicional' | 'mixta' | 'inmobiliaria' | 'unknown';
  companyProfile?: {
    identity: string;    // Qué es la empresa
    offering: string;    // Qué ofrece
    terminology: string; // Cómo llama a sus productos
  };
  navigation: {
    menuItems: string[];
    modelSections: { label: string; url: string }[];
  };
  models: ModelInfo[];
  contactInfo: {
    whatsapp?: string;
    email?: string;
    phone?: string;
    instagram?: string;
  };
  totalModelsFound: number;
  pagesExplored: number;
  errors: string[];
}

interface VisionHomepageAnalysis {
  menuItems: string[];
  sections: string[];
  modelLinks: { text: string; position: string }[];
  companyType: 'modular' | 'tradicional' | 'mixta' | 'inmobiliaria' | 'unknown';
  companyProfile?: {
    identity: string;
    offering: string;
    terminology: string;
  };
}

interface VisionCatalogAnalysis {
  models: {
    name: string;
    price?: string;
    sqMeters?: string;
    hasDetailLink: boolean;
  }[];
  totalVisible: number;
}

interface VisionDetailAnalysis {
  name: string;
  sqMeters?: number;
  bedrooms?: number;
  bathrooms?: number;
  price?: string;
  features: string[];
  customizationOptions: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VISION_MODEL = 'claude-sonnet-4-5-20250929';
const MAX_MODEL_SECTIONS = 3;
const MAX_MODEL_DETAILS = 5;
const NAV_TIMEOUT = 45_000;
const VISION_TIMEOUT = 60_000;
const MAX_VISION_RETRIES = 3;

const MODEL_KEYWORDS = [
  'modelo', 'modelos', 'catalogo', 'proyecto', 'proyectos',
  'casa', 'casas', 'vivienda', 'viviendas', 'producto', 'productos',
  'tipologia', 'tipologias', 'unidad', 'unidades', 'cabana', 'cabanas',
  'tiny', 'container', 'refugio', 'refugios', 'loft', 'duplex',
];

const CONTACT_KEYWORDS = ['contacto', 'contactanos', 'contact'];

const PROJECT_ROOT = path.resolve(__dirname, '..');
const COMPANIES_JSON_PATH = path.join(PROJECT_ROOT, 'src', 'scripts', 'test-companies.json');
const OUTPUT_BASE = path.join(PROJECT_ROOT, 'ground-truth');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function log(company: string, msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [${company}] ${msg}`);
}

function logError(company: string, msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.error(`[${ts}] [${company}] ERROR: ${msg}`);
}

function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return null;
    }
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadCompanies(): CompanyInput[] {
  const raw = fs.readFileSync(COMPANIES_JSON_PATH, 'utf-8');
  const data: TestCompaniesFile = JSON.parse(raw);
  return [...data.companies.problematicas, ...data.companies.aleatorias];
}

// ---------------------------------------------------------------------------
// Vision API with retry
// ---------------------------------------------------------------------------

async function callVision(
  client: Anthropic,
  screenshotBase64: string,
  prompt: string,
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_VISION_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model: VISION_MODEL,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: screenshotBase64,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      });

      const textBlock = response.content.find(b => b.type === 'text');
      return textBlock ? textBlock.text : '';
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_VISION_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`  Vision API retry ${attempt}/${MAX_VISION_RETRIES} in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw lastError ?? new Error('Vision API failed after retries');
}

function extractJsonFromResponse(text: string): string {
  // Try to find JSON block in markdown code fence
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Try to find raw JSON object
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];

  return text;
}

function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    const clean = extractJsonFromResponse(text);
    return JSON.parse(clean) as T;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Screenshot helper
// ---------------------------------------------------------------------------

async function takeScreenshot(
  page: Page,
  outputPath: string,
): Promise<string> {
  // Force .jpeg extension for compression
  const jpegPath = outputPath.replace(/\.png$/, '.jpeg');
  const dir = path.dirname(jpegPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Claude Vision max is 8000px per dimension. Capture full page but clip height.
  const MAX_HEIGHT = 6000;
  const viewport = page.viewportSize() || { width: 1280, height: 720 };
  const bodyHeight = await page.evaluate(() => document.body.scrollHeight);

  if (bodyHeight > MAX_HEIGHT) {
    // Clip to first MAX_HEIGHT pixels - that's where the important content is
    await page.screenshot({
      path: jpegPath,
      type: 'jpeg',
      quality: 80,
      clip: { x: 0, y: 0, width: viewport.width, height: MAX_HEIGHT },
    });
  } else {
    await page.screenshot({ path: jpegPath, type: 'jpeg', quality: 80, fullPage: true });
  }

  const buffer = fs.readFileSync(jpegPath);
  return buffer.toString('base64');
}

// ---------------------------------------------------------------------------
// DOM extraction helpers
// ---------------------------------------------------------------------------

async function extractAllLinks(page: Page): Promise<{ text: string; href: string }[]> {
  try {
    return await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'));
      return anchors
        .map(a => ({
          text: (a.textContent || '').trim().substring(0, 200),
          href: a.href || '',
        }))
        .filter(l => l.href && !l.href.startsWith('javascript:'));
    });
  } catch {
    return [];
  }
}

function classifyLinks(
  links: { text: string; href: string }[],
  keywords: string[],
  baseUrl: string,
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];
  const seen = new Set<string>();

  for (const link of links) {
    const lowerText = link.text.toLowerCase();
    const lowerHref = link.href.toLowerCase();

    for (const kw of keywords) {
      if (lowerText.includes(kw) || lowerHref.includes(kw)) {
        const resolved = resolveUrl(link.href, baseUrl);
        if (resolved && !seen.has(resolved)) {
          seen.add(resolved);
          results.push({ label: link.text || kw, url: resolved });
        }
        break;
      }
    }
  }

  return results;
}

async function extractContactInfo(
  page: Page,
): Promise<GroundTruthData['contactInfo']> {
  try {
    return await page.evaluate(() => {
      const html = document.body.innerHTML;
      const text = document.body.innerText;

      // WhatsApp
      let whatsapp: string | undefined;
      const waMatch = html.match(/wa\.me\/(\d+)/);
      if (waMatch) whatsapp = waMatch[1];
      if (!whatsapp) {
        const waLink = html.match(/api\.whatsapp\.com\/send\?phone=(\d+)/);
        if (waLink) whatsapp = waLink[1];
      }

      // Email
      let email: string | undefined;
      const emailMatch = html.match(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) email = emailMatch[1];
      if (!email) {
        const emailText = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
        if (emailText) email = emailText[0];
      }

      // Phone
      let phone: string | undefined;
      const telMatch = html.match(/tel:([+\d\s\-()]+)/);
      if (telMatch) phone = telMatch[1].trim();

      // Instagram
      let instagram: string | undefined;
      const igMatch = html.match(/instagram\.com\/([a-zA-Z0-9_.]+)/);
      if (igMatch) instagram = `@${igMatch[1]}`;

      return { whatsapp, email, phone, instagram };
    });
  } catch {
    return {};
  }
}

async function extractPageText(page: Page): Promise<string> {
  try {
    const text = await page.evaluate(() => document.body.innerText);
    return text.substring(0, 5000);
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Main capture per company
// ---------------------------------------------------------------------------

async function captureCompany(
  browser: Browser,
  company: CompanyInput,
  client: Anthropic,
): Promise<GroundTruthData> {
  const slug = slugify(company.name);
  const companyDir = path.join(OUTPUT_BASE, slug);
  const screenshotDir = path.join(companyDir, 'screenshots');
  fs.mkdirSync(screenshotDir, { recursive: true });

  const result: GroundTruthData = {
    company: company.name,
    url: company.url,
    capturedAt: new Date().toISOString(),
    type: 'unknown',
    navigation: { menuItems: [], modelSections: [] },
    models: [],
    contactInfo: {},
    totalModelsFound: 0,
    pagesExplored: 0,
    errors: [],
  };

  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT);

  try {
    // -----------------------------------------------------------------------
    // STEP 1: Homepage
    // -----------------------------------------------------------------------
    log(company.name, 'Navigating to homepage...');
    await page.goto(company.url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    await page.waitForTimeout(3000); // let JS frameworks render
    result.pagesExplored++;

    const homepageScreenshot = path.join(screenshotDir, '01-homepage.png');
    const homepageBase64 = await takeScreenshot(page, homepageScreenshot);
    log(company.name, 'Homepage screenshot captured');

    // Vision analysis of homepage
    log(company.name, 'Analyzing homepage with Vision...');
    const homepageVisionRaw = await callVision(client, homepageBase64, `Analiza esta pagina de una constructora argentina. Responde SOLO con JSON valido, sin texto adicional.

Formato esperado:
{
  "menuItems": ["item1", "item2"],
  "sections": ["seccion visible 1", "seccion visible 2"],
  "modelLinks": [{"text": "texto del link/boton", "position": "ubicacion aproximada en la pagina"}],
  "companyType": "modular|tradicional|mixta|inmobiliaria|unknown",
  "companyProfile": {
    "identity": "descripcion de que es la empresa y a que se dedica",
    "offering": "que productos o servicios ofrece",
    "terminology": "como llama a sus productos (modelos, tipologias, proyectos, servicios, unidades, etc)"
  }
}

Identifica:
(a) Items del menu de navegacion
(b) Secciones visibles en la pagina
(c) Cualquier enlace/boton que diga modelos, tipologias, catalogo, proyectos, casas, viviendas, o sinonimos
(d) Tipo de empresa: modular (casas prefabricadas/modulares), tradicional (construccion clasica), mixta, inmobiliaria (vende terrenos/lotes), unknown
(e) Identidad de la empresa: que es y a que se dedica (1-2 oraciones)
(f) Que productos o servicios ofrece (NO asumas "modelos" - descubri la terminologia del sitio)
(g) Como llama la empresa a sus productos: modelos, tipologias, proyectos, servicios, unidades, etc.`);

    const homepageVision = safeJsonParse<VisionHomepageAnalysis>(homepageVisionRaw, {
      menuItems: [],
      sections: [],
      modelLinks: [],
      companyType: 'unknown',
    });

    result.type = homepageVision.companyType;
    result.navigation.menuItems = homepageVision.menuItems;

    // Save company profile if captured
    if (homepageVision.companyProfile) {
      result.companyProfile = homepageVision.companyProfile;
    }

    // DOM link extraction
    const allLinks = await extractAllLinks(page);
    const modelLinksFromDOM = classifyLinks(allLinks, MODEL_KEYWORDS, company.url);
    result.navigation.modelSections = modelLinksFromDOM;

    // Extract contact info from homepage
    const homepageContact = await extractContactInfo(page);
    result.contactInfo = { ...result.contactInfo, ...homepageContact };

    log(company.name, `Found ${modelLinksFromDOM.length} model section links from DOM`);
    log(company.name, `Vision found ${homepageVision.modelLinks.length} model links visually`);
    log(company.name, `Company type: ${result.type}`);

    // -----------------------------------------------------------------------
    // STEP 2: Explore model/project sections
    // -----------------------------------------------------------------------
    const sectionsToExplore = modelLinksFromDOM.slice(0, MAX_MODEL_SECTIONS);

    if (sectionsToExplore.length === 0) {
      log(company.name, 'No model sections found, skipping catalog exploration');
    }

    for (let i = 0; i < sectionsToExplore.length; i++) {
      const section = sectionsToExplore[i];
      log(company.name, `Exploring model section ${i + 1}/${sectionsToExplore.length}: ${section.label} -> ${section.url}`);

      try {
        await page.goto(section.url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
        await page.waitForTimeout(3000);
        result.pagesExplored++;

        const catalogScreenshot = path.join(screenshotDir, `02-catalog-${i + 1}.png`);
        const catalogBase64 = await takeScreenshot(page, catalogScreenshot);

        // Vision analysis of catalog page
        const catalogVisionRaw = await callVision(client, catalogBase64, `Analiza esta pagina de catalogo/modelos de una constructora. Responde SOLO con JSON valido, sin texto adicional.

Formato esperado:
{
  "models": [
    {"name": "Nombre del modelo", "price": "precio si aparece o null", "sqMeters": "metros cuadrados si aparece o null", "hasDetailLink": true}
  ],
  "totalVisible": 5
}

Para cada modelo/proyecto/unidad visible, lista:
- nombre visible
- precio si aparece
- metros cuadrados si aparece
- si hay un boton/link para ver mas detalles`);

        const catalogVision = safeJsonParse<VisionCatalogAnalysis>(catalogVisionRaw, {
          models: [],
          totalVisible: 0,
        });

        log(company.name, `Vision found ${catalogVision.totalVisible} models on catalog page`);

        // Add models from catalog vision
        for (const m of catalogVision.models) {
          const existing = result.models.find(
            ex => ex.name.toLowerCase() === m.name.toLowerCase(),
          );
          if (!existing) {
            result.models.push({
              name: m.name,
              price: m.price || undefined,
              sqMeters: m.sqMeters ? parseFloat(m.sqMeters) || undefined : undefined,
              features: [],
              source: 'catalog_page',
              screenshot: `screenshots/02-catalog-${i + 1}.jpeg`,
            });
          }
        }

        // Extract detail links from DOM for model cards
        const catalogLinks = await extractAllLinks(page);
        const detailCandidates = catalogLinks.filter(l => {
          const lower = l.href.toLowerCase();
          const textLower = l.text.toLowerCase();
          return (
            (textLower.includes('ver') || textLower.includes('detalle') || textLower.includes('conocer') || textLower.includes('mas info')) &&
            !lower.includes('#') &&
            resolveUrl(l.href, company.url) !== null
          );
        });

        // Also look for links that match model names
        for (const model of result.models) {
          if (model.detailUrl) continue;
          const modelNameLower = model.name.toLowerCase();
          const matchingLink = catalogLinks.find(l =>
            l.text.toLowerCase().includes(modelNameLower) ||
            l.href.toLowerCase().includes(modelNameLower.replace(/\s+/g, '-')),
          );
          if (matchingLink) {
            const resolved = resolveUrl(matchingLink.href, company.url);
            if (resolved) model.detailUrl = resolved;
          }
        }

        // Assign detail URLs from generic "ver mas" links if models don't have them
        let detailIdx = 0;
        for (const model of result.models) {
          if (!model.detailUrl && detailIdx < detailCandidates.length) {
            const resolved = resolveUrl(detailCandidates[detailIdx].href, company.url);
            if (resolved) model.detailUrl = resolved;
            detailIdx++;
          }
        }

        // Also collect contact from catalog pages
        const catalogContact = await extractContactInfo(page);
        result.contactInfo = { ...result.contactInfo, ...catalogContact };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logError(company.name, `Failed to explore section ${section.url}: ${msg}`);
        result.errors.push(`Catalog section ${section.url}: ${msg}`);
      }
    }

    // -----------------------------------------------------------------------
    // STEP 3: Deep dive into model detail pages
    // -----------------------------------------------------------------------
    const modelsWithDetails = result.models.filter(m => m.detailUrl).slice(0, MAX_MODEL_DETAILS);

    log(company.name, `Exploring ${modelsWithDetails.length} model detail pages (max ${MAX_MODEL_DETAILS})`);

    for (let i = 0; i < modelsWithDetails.length; i++) {
      const model = modelsWithDetails[i];
      log(company.name, `Detail page ${i + 1}/${modelsWithDetails.length}: ${model.name} -> ${model.detailUrl}`);

      try {
        await page.goto(model.detailUrl!, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
        await page.waitForTimeout(3000);
        result.pagesExplored++;

        const detailScreenshot = path.join(screenshotDir, `03-detail-${i + 1}-${slugify(model.name)}.png`);
        const detailBase64 = await takeScreenshot(page, detailScreenshot);
        model.screenshot = `screenshots/03-detail-${i + 1}-${slugify(model.name)}.jpeg`;

        // Vision analysis of detail page
        const detailVisionRaw = await callVision(client, detailBase64, `Analiza esta pagina de detalle de un modelo/vivienda de una constructora. Responde SOLO con JSON valido, sin texto adicional.

Formato esperado:
{
  "name": "Nombre del modelo",
  "sqMeters": 60,
  "bedrooms": 2,
  "bathrooms": 1,
  "price": "USD 45.000",
  "features": ["cocina integrada", "living comedor", "terraza"],
  "customizationOptions": ["agregar dormitorio", "cambiar terminacion"]
}

Extrae toda la informacion tecnica visible:
- Nombre del modelo
- Metros cuadrados (numero)
- Dormitorios (numero)
- Banos (numero)
- Precio (texto tal como aparece)
- Caracteristicas incluidas
- Opciones de personalizacion si las hay

Si un campo no esta visible, usa null.`);

        const detailVision = safeJsonParse<VisionDetailAnalysis>(detailVisionRaw, {
          name: model.name,
          features: [],
          customizationOptions: [],
        });

        // Update model with detail info
        if (detailVision.sqMeters) model.sqMeters = detailVision.sqMeters;
        if (detailVision.bedrooms) model.bedrooms = detailVision.bedrooms;
        if (detailVision.bathrooms) model.bathrooms = detailVision.bathrooms;
        if (detailVision.price) model.price = detailVision.price;
        if (detailVision.features.length > 0) model.features = detailVision.features;
        model.source = 'detail_page';

        // Backup: extract text from DOM
        const pageText = await extractPageText(page);
        if (!model.sqMeters) {
          const m2Match = pageText.match(/(\d+)\s*(?:m2|m²|mts|metros?\s*cuadrados)/i);
          if (m2Match) model.sqMeters = parseInt(m2Match[1], 10);
        }
        if (!model.bedrooms) {
          const bedMatch = pageText.match(/(\d+)\s*(?:dormitorio|habitacion|ambiente)/i);
          if (bedMatch) model.bedrooms = parseInt(bedMatch[1], 10);
        }
        if (!model.bathrooms) {
          const bathMatch = pageText.match(/(\d+)\s*(?:ba[nñ]o)/i);
          if (bathMatch) model.bathrooms = parseInt(bathMatch[1], 10);
        }

        // Contact info from detail pages
        const detailContact = await extractContactInfo(page);
        result.contactInfo = { ...result.contactInfo, ...detailContact };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logError(company.name, `Failed detail page for ${model.name}: ${msg}`);
        result.errors.push(`Detail page ${model.name}: ${msg}`);
      }
    }

    // -----------------------------------------------------------------------
    // STEP 4: Contact page exploration
    // -----------------------------------------------------------------------
    if (!result.contactInfo.whatsapp && !result.contactInfo.email && !result.contactInfo.phone) {
      log(company.name, 'No contact info found yet, looking for contact page...');

      // Go back to homepage to find contact link
      try {
        await page.goto(company.url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
        await page.waitForTimeout(3000);
        const links = await extractAllLinks(page);
        const contactLinks = classifyLinks(links, CONTACT_KEYWORDS, company.url);

        if (contactLinks.length > 0) {
          log(company.name, `Navigating to contact page: ${contactLinks[0].url}`);
          await page.goto(contactLinks[0].url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
          await page.waitForTimeout(3000);
          result.pagesExplored++;

          const contactScreenshot = path.join(screenshotDir, '04-contacto.png');
          await takeScreenshot(page, contactScreenshot);

          const contactInfo = await extractContactInfo(page);
          result.contactInfo = { ...result.contactInfo, ...contactInfo };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logError(company.name, `Failed to explore contact page: ${msg}`);
        result.errors.push(`Contact page: ${msg}`);
      }
    }

    // Finalize
    result.totalModelsFound = result.models.length;

    // Clean up undefined values from contactInfo
    const ci = result.contactInfo;
    if (!ci.whatsapp) delete ci.whatsapp;
    if (!ci.email) delete ci.email;
    if (!ci.phone) delete ci.phone;
    if (!ci.instagram) delete ci.instagram;

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError(company.name, `Fatal error: ${msg}`);
    result.errors.push(`Fatal: ${msg}`);
  } finally {
    try {
      await context.close();
    } catch {
      // context may already be closed/crashed
    }

    // ALWAYS save ground truth JSON, even with errors/partial data
    try {
      result.totalModelsFound = result.models.length;
      const outputPath = path.join(companyDir, 'ground-truth.json');
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
      log(company.name, `Ground truth saved to ${outputPath}`);
    } catch (writeErr) {
      logError(company.name, `Failed to write ground-truth.json: ${writeErr}`);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('='.repeat(70));
  console.log('GROUND TRUTH CAPTURE');
  console.log('Captures real information from construction company websites');
  console.log('='.repeat(70));

  // Parse CLI args
  const args = process.argv.slice(2);
  let companyFilter: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--company' && args[i + 1]) {
      companyFilter = args[i + 1];
      i++;
    }
  }

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY environment variable is not set');
    process.exit(1);
  }

  const client = new Anthropic();

  // Load companies
  let companies = loadCompanies();
  console.log(`Loaded ${companies.length} companies from ${COMPANIES_JSON_PATH}`);

  if (companyFilter) {
    const filterLower = companyFilter.toLowerCase();
    companies = companies.filter(c => c.name.toLowerCase().includes(filterLower));
    if (companies.length === 0) {
      console.error(`No company found matching: "${companyFilter}"`);
      const all = loadCompanies();
      console.log('Available companies:');
      all.forEach(c => console.log(`  - ${c.name}`));
      process.exit(1);
    }
    console.log(`Filtered to ${companies.length} company(ies): ${companies.map(c => c.name).join(', ')}`);
  }

  // Create output directory
  fs.mkdirSync(OUTPUT_BASE, { recursive: true });

  const results: GroundTruthData[] = [];
  const startTime = Date.now();

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    console.log(`\n${'='.repeat(70)}`);
    console.log(`[${i + 1}/${companies.length}] ${company.name} - ${company.url}`);
    console.log('='.repeat(70));

    // Fresh browser per company to prevent memory leaks and crashes
    let browser: Browser | null = null;
    try {
      browser = await chromium.launch({ headless: true });
      const result = await captureCompany(browser, company, client);
      results.push(result);

      // Summary for this company
      console.log(`\n--- Summary for ${company.name} ---`);
      console.log(`  Type: ${result.type}`);
      console.log(`  Models found: ${result.totalModelsFound}`);
      console.log(`  Pages explored: ${result.pagesExplored}`);
      console.log(`  Contact: WA=${result.contactInfo.whatsapp || 'N/A'} | Email=${result.contactInfo.email || 'N/A'}`);
      console.log(`  Errors: ${result.errors.length}`);
      if (result.models.length > 0) {
        console.log('  Models:');
        for (const m of result.models) {
          console.log(`    - ${m.name} | ${m.sqMeters || '?'}m2 | ${m.bedrooms || '?'}dorm | ${m.price || 'N/A'} | src:${m.source}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`FAILED to process ${company.name}: ${msg}`);
      const fallback: GroundTruthData = {
        company: company.name,
        url: company.url,
        capturedAt: new Date().toISOString(),
        type: 'unknown',
        navigation: { menuItems: [], modelSections: [] },
        models: [],
        contactInfo: {},
        totalModelsFound: 0,
        pagesExplored: 0,
        errors: [`Fatal: ${msg}`],
      };
      results.push(fallback);

      // Write fallback ground-truth.json so no company is left without a file
      try {
        const fallbackDir = path.join(OUTPUT_BASE, slugify(company.name));
        fs.mkdirSync(fallbackDir, { recursive: true });
        fs.writeFileSync(
          path.join(fallbackDir, 'ground-truth.json'),
          JSON.stringify(fallback, null, 2),
          'utf-8',
        );
      } catch {
        // best effort
      }
    } finally {
      // Always close browser for this company to free memory
      if (browser) {
        try {
          await browser.close();
        } catch {
          // browser may already be closed/crashed
        }
      }
    }

    // Save incremental summary
    const summaryPath = path.join(OUTPUT_BASE, 'capture-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify({
      capturedAt: new Date().toISOString(),
      totalCompanies: companies.length,
      completed: results.length,
      results: results.map(r => ({
        company: r.company,
        type: r.type,
        modelsFound: r.totalModelsFound,
        pagesExplored: r.pagesExplored,
        hasWhatsapp: !!r.contactInfo.whatsapp,
        hasEmail: !!r.contactInfo.email,
        errorCount: r.errors.length,
      })),
    }, null, 2), 'utf-8');
  }

  // Final summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${'='.repeat(70)}`);
  console.log('CAPTURE COMPLETE');
  console.log('='.repeat(70));
  console.log(`Total time: ${elapsed}s`);
  console.log(`Companies processed: ${results.length}/${companies.length}`);
  console.log(`Total models found: ${results.reduce((sum, r) => sum + r.totalModelsFound, 0)}`);
  console.log(`Total pages explored: ${results.reduce((sum, r) => sum + r.pagesExplored, 0)}`);
  console.log(`Total errors: ${results.reduce((sum, r) => sum + r.errors.length, 0)}`);
  console.log(`\nOutput: ${OUTPUT_BASE}/`);

  console.log('\nPer-company breakdown:');
  console.log('-'.repeat(90));
  console.log(
    'Company'.padEnd(25) +
    'Type'.padEnd(15) +
    'Models'.padEnd(10) +
    'Pages'.padEnd(10) +
    'WA'.padEnd(6) +
    'Email'.padEnd(6) +
    'Errors'.padEnd(8),
  );
  console.log('-'.repeat(90));
  for (const r of results) {
    console.log(
      r.company.padEnd(25) +
      r.type.padEnd(15) +
      String(r.totalModelsFound).padEnd(10) +
      String(r.pagesExplored).padEnd(10) +
      (r.contactInfo.whatsapp ? 'Y' : 'N').padEnd(6) +
      (r.contactInfo.email ? 'Y' : 'N').padEnd(6) +
      String(r.errors.length).padEnd(8),
    );
  }
  console.log('-'.repeat(90));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
