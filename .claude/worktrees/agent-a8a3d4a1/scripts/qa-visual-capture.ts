/**
 * Script 1: QA Visual Capture
 * Captura screenshots de páginas clave de cada empresa usando Playwright
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = '/tmp/qa-screenshots';

interface Empresa {
  name: string;
  url: string;
}

const EMPRESAS: Empresa[] = [
  { name: "Habika", url: "https://habika.ar/" },
  { name: "Ecomod", url: "https://ecomod.com.ar/" },
  { name: "Lista", url: "https://lista.com.ar/" },
  { name: "LucysHouse", url: "https://www.lucyshousearg.com/" },
  { name: "Arcohouse", url: "https://arcohouse.com.ar/" },
  { name: "T1Modular", url: "https://www.t1modular.com.ar/" },
  { name: "GoHome", url: "https://gohomeconstrucciones.com.ar/" },
  { name: "MiniCasas", url: "https://www.minicasas.com.ar/" },
  { name: "SmartPod", url: "https://www.smartpod.mx/" },
  { name: "Wellmod", url: "https://www.wellmod.com.ar/" }
];

// Patrones para buscar links relevantes
const LINK_PATTERNS = {
  modelos: ['modelo', 'modelos', 'casas', 'catalogo', 'productos', 'cabañas', 'viviendas', 'tiny', 'container'],
  cobertura: ['cobertura', 'envio', 'envios', 'zona', 'zonas', 'donde', 'ubicacion', 'servicio'],
  faq: ['faq', 'pregunta', 'preguntas', 'frecuentes'],
  contacto: ['contacto', 'contactanos', 'contact'],
  precios: ['precio', 'precios', 'cotiza', 'cotizar', 'presupuesto']
};

interface ScreenshotResult {
  page: string;
  filename: string;
  url: string;
  success: boolean;
  error?: string;
}

interface CaptureResult {
  empresa: string;
  screenshots: ScreenshotResult[];
  duration: number;
}

async function findLink(page: Page, patterns: string[]): Promise<string | null> {
  for (const pattern of patterns) {
    try {
      // Buscar en links de navegacion
      const link = await page.locator(`a:has-text("${pattern}")`).first();
      if (await link.count() > 0) {
        const href = await link.getAttribute('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          return href;
        }
      }

      // Buscar link que contenga el patron en href
      const hrefLink = await page.locator(`a[href*="${pattern}"]`).first();
      if (await hrefLink.count() > 0) {
        const href = await hrefLink.getAttribute('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          return href;
        }
      }
    } catch {
      // Continuar con siguiente patron
    }
  }
  return null;
}

async function captureScreenshot(
  page: Page,
  empresa: string,
  pageName: string,
  url: string
): Promise<ScreenshotResult> {
  const dir = path.join(OUTPUT_DIR, empresa);
  const filename = `${pageName}.png`;
  const filepath = path.join(dir, filename);

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500); // Esperar renderizado

    // Screenshot de pagina completa
    await page.screenshot({
      path: filepath,
      fullPage: true,
    });

    console.log(`  [OK] ${pageName}: ${url}`);
    return { page: pageName, filename, url, success: true };
  } catch (error) {
    console.log(`  [FAIL] ${pageName}: ${error instanceof Error ? error.message : String(error)}`);
    return {
      page: pageName,
      filename,
      url,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function captureEmpresa(browser: Browser, empresa: Empresa): Promise<CaptureResult> {
  const startTime = Date.now();
  const results: ScreenshotResult[] = [];

  // Crear directorio
  const dir = path.join(OUTPUT_DIR, empresa.name);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Capturando: ${empresa.name}`);
  console.log(`URL: ${empresa.url}`);
  console.log('='.repeat(50));

  try {
    // 1. Homepage
    console.log('\n1. Homepage...');
    results.push(await captureScreenshot(page, empresa.name, '01-homepage', empresa.url));

    // 2. Modelos/Catalogo
    console.log('\n2. Buscando pagina de modelos...');
    const modelosLink = await findLink(page, LINK_PATTERNS.modelos);
    if (modelosLink) {
      const modelosUrl = new URL(modelosLink, empresa.url).href;
      results.push(await captureScreenshot(page, empresa.name, '02-modelos', modelosUrl));
    } else {
      console.log('  [SKIP] No se encontro link a modelos');
      results.push({ page: '02-modelos', filename: '', url: '', success: false, error: 'Link no encontrado' });
    }

    // Volver a homepage para buscar mas links
    await page.goto(empresa.url, { waitUntil: 'networkidle', timeout: 30000 });

    // 3. Cobertura/Envios
    console.log('\n3. Buscando pagina de cobertura...');
    const coberturaLink = await findLink(page, LINK_PATTERNS.cobertura);
    if (coberturaLink) {
      const coberturaUrl = new URL(coberturaLink, empresa.url).href;
      results.push(await captureScreenshot(page, empresa.name, '03-cobertura', coberturaUrl));
    } else {
      console.log('  [SKIP] No se encontro link a cobertura');
      results.push({ page: '03-cobertura', filename: '', url: '', success: false, error: 'Link no encontrado' });
    }

    // Volver a homepage
    await page.goto(empresa.url, { waitUntil: 'networkidle', timeout: 30000 });

    // 4. FAQ
    console.log('\n4. Buscando pagina de FAQ...');
    const faqLink = await findLink(page, LINK_PATTERNS.faq);
    if (faqLink) {
      const faqUrl = new URL(faqLink, empresa.url).href;
      results.push(await captureScreenshot(page, empresa.name, '04-faq', faqUrl));
    } else {
      console.log('  [SKIP] No se encontro link a FAQ');
      results.push({ page: '04-faq', filename: '', url: '', success: false, error: 'Link no encontrado' });
    }

    // Volver a homepage
    await page.goto(empresa.url, { waitUntil: 'networkidle', timeout: 30000 });

    // 5. Contacto
    console.log('\n5. Buscando pagina de contacto...');
    const contactoLink = await findLink(page, LINK_PATTERNS.contacto);
    if (contactoLink) {
      const contactoUrl = new URL(contactoLink, empresa.url).href;
      results.push(await captureScreenshot(page, empresa.name, '05-contacto', contactoUrl));
    } else {
      console.log('  [SKIP] No se encontro link a contacto');
      results.push({ page: '05-contacto', filename: '', url: '', success: false, error: 'Link no encontrado' });
    }

    // Volver a homepage
    await page.goto(empresa.url, { waitUntil: 'networkidle', timeout: 30000 });

    // 6. Precios (bonus)
    console.log('\n6. Buscando pagina de precios...');
    const preciosLink = await findLink(page, LINK_PATTERNS.precios);
    if (preciosLink) {
      const preciosUrl = new URL(preciosLink, empresa.url).href;
      results.push(await captureScreenshot(page, empresa.name, '06-precios', preciosUrl));
    } else {
      console.log('  [SKIP] No se encontro link a precios');
      results.push({ page: '06-precios', filename: '', url: '', success: false, error: 'Link no encontrado' });
    }

  } catch (error) {
    console.error(`Error capturando ${empresa.name}:`, error);
  } finally {
    await context.close();
  }

  const duration = Date.now() - startTime;
  console.log(`\nCaptura completada en ${(duration/1000).toFixed(1)}s`);

  return {
    empresa: empresa.name,
    screenshots: results,
    duration
  };
}

export async function runVisualCapture(empresas: Empresa[] = EMPRESAS): Promise<CaptureResult[]> {
  console.log('='.repeat(60));
  console.log('QA VISUAL CAPTURE');
  console.log(`Capturando ${empresas.length} empresas`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log('='.repeat(60));

  // Crear directorio base
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const results: CaptureResult[] = [];

  try {
    for (const empresa of empresas) {
      const result = await captureEmpresa(browser, empresa);
      results.push(result);

      // Guardar resultado parcial
      const summaryPath = path.join(OUTPUT_DIR, 'capture-summary.json');
      fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
    }
  } finally {
    await browser.close();
  }

  // Resumen final
  console.log('\n' + '='.repeat(60));
  console.log('RESUMEN DE CAPTURAS');
  console.log('='.repeat(60));

  for (const result of results) {
    const success = result.screenshots.filter(s => s.success).length;
    const total = result.screenshots.length;
    console.log(`${result.empresa}: ${success}/${total} screenshots`);
  }

  const totalSuccess = results.reduce((acc, r) => acc + r.screenshots.filter(s => s.success).length, 0);
  const totalScreenshots = results.reduce((acc, r) => acc + r.screenshots.length, 0);
  console.log(`\nTotal: ${totalSuccess}/${totalScreenshots} screenshots exitosos`);

  return results;
}

// CLI
async function main() {
  const args = process.argv.slice(2);

  let empresasToCapture = EMPRESAS;

  // Si se pasa un argumento, filtrar por nombre
  if (args.length > 0) {
    const filter = args[0].toLowerCase();
    empresasToCapture = EMPRESAS.filter(e => e.name.toLowerCase().includes(filter));

    if (empresasToCapture.length === 0) {
      console.error(`No se encontraron empresas que coincidan con: ${args[0]}`);
      console.log('Empresas disponibles:', EMPRESAS.map(e => e.name).join(', '));
      process.exit(1);
    }
  }

  await runVisualCapture(empresasToCapture);
}

main().catch(console.error);
