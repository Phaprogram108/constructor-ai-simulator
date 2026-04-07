/**
 * Generalized Ground Truth Scanner
 *
 * Crawls any construction company website and extracts all visible content:
 * navigation, sections, models/products, specs, PDFs.
 *
 * Usage:
 *   npx tsx tests/ground-truth/scan-company.ts --name "ViBert" --url "https://vibert.com.ar"
 */

import { chromium, type Browser, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const WAIT_MS = 3000;
const PAGE_TIMEOUT_MS = 20000;
const MAX_PAGES = 40; // safety limit

const MODEL_KEYWORDS = [
  'modelo', 'tipologia', 'casa', 'vivienda', 'proyecto',
  'producto', 'plan', 'cabaña', 'cabana', 'modulo', 'módulo',
  'container', 'lote', 'unidad', 'servicio',
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ModelInfo {
  name: string;
  url: string;
  m2?: string;
  price?: string;
  rooms?: string;
  specs: string[];
  fullText: string;
  screenshotFile: string;
}

interface SectionInfo {
  name: string;
  url: string;
  text: string;
  screenshotFile: string;
  subLinks: { text: string; href: string }[];
}

interface SiteReport {
  scannedAt: string;
  companyName: string;
  baseUrl: string;
  homepage: {
    title: string;
    metaDescription: string;
    fullText: string;
    screenshotFile: string;
  };
  navigation: { text: string; href: string }[];
  sections: SectionInfo[];
  models: ModelInfo[];
  pdfLinks: { text: string; href: string }[];
  allLinks: { text: string; href: string }[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
function parseArgs(): { name: string; url: string } {
  const args = process.argv.slice(2);
  let name = '';
  let url = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      name = args[i + 1];
      i++;
    } else if (args[i] === '--url' && args[i + 1]) {
      url = args[i + 1];
      i++;
    }
  }

  if (!name || !url) {
    console.error('Usage: npx tsx scan-company.ts --name "CompanyName" --url "https://example.com"');
    process.exit(1);
  }

  // Ensure URL has trailing slash for consistency
  if (!url.endsWith('/')) url += '/';

  return { name, url };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 60);
}

function fileSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname + u.search;
  } catch {
    return url;
  }
}

async function waitForPage(page: Page) {
  try {
    await page.waitForLoadState('networkidle', { timeout: 12000 });
  } catch {
    // networkidle can timeout on SPAs
  }
  await page.waitForTimeout(WAIT_MS);
}

async function safeGoto(page: Page, url: string) {
  try {
    await page.goto(url, { waitUntil: 'commit', timeout: PAGE_TIMEOUT_MS });
  } catch {
    try {
      await page.evaluate(`window.location.href = "${url}"`);
    } catch {
      // ignore
    }
  }
  await page.waitForTimeout(WAIT_MS);
  try {
    await page.waitForLoadState('networkidle', { timeout: 8000 });
  } catch {
    // ok
  }
  await page.waitForTimeout(1000);
}

async function autoScroll(page: Page) {
  const bodyHeight = await page.evaluate('document.body.scrollHeight');
  const step = 600;
  for (let y = 0; y < bodyHeight; y += step) {
    await page.evaluate(`window.scrollTo(0, ${y})`);
    await page.waitForTimeout(250);
  }
  await page.evaluate('window.scrollTo(0, 0)');
  await page.waitForTimeout(1000);
}

async function closePopups(page: Page) {
  const selectors = [
    '[data-testid="cookie-banner-close"]',
    'button:has-text("Accept")',
    'button:has-text("Aceptar")',
    'button:has-text("Close")',
    'button:has-text("Cerrar")',
    '.popup-close',
    '[aria-label="Close"]',
    '.cookie-banner button',
    'button:has-text("Entendido")',
    'button:has-text("OK")',
  ];
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 500 })) {
        await el.click();
        await page.waitForTimeout(500);
      }
    } catch {
      // ignore
    }
  }
}

async function extractVisibleText(page: Page): Promise<string> {
  return page.evaluate(`
    (function() {
      var clone = document.body.cloneNode(true);
      clone.querySelectorAll('script, style, noscript').forEach(function(el) { el.remove(); });
      return (clone.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 50000);
    })()
  `);
}

async function extractAllLinks(page: Page): Promise<{ text: string; href: string }[]> {
  return page.evaluate(`
    (function() {
      var anchors = Array.from(document.querySelectorAll('a[href]'));
      return anchors.map(function(a) {
        return {
          text: (a.textContent || '').trim().slice(0, 200),
          href: a.href,
        };
      }).filter(function(l) { return l.href && !l.href.startsWith('javascript:'); });
    })()
  `);
}

async function extractNavLinks(page: Page): Promise<{ text: string; href: string }[]> {
  return page.evaluate(`
    (function() {
      var links = [];
      var seen = {};
      var selectors = [
        'nav a',
        '[data-testid="linkElement"]',
        '#SITE_HEADER a',
        '[id*="navContainer"] a',
        'header a',
        '[role="navigation"] a',
        'wix-dropdown-menu a',
        '.navbar a',
        '.nav a',
        '.menu a',
        '[class*="menu"] a',
        '[class*="nav"] a',
      ];
      selectors.forEach(function(sel) {
        document.querySelectorAll(sel).forEach(function(el) {
          var text = (el.textContent || '').trim();
          var href = el.href || '';
          if (text && href && !href.startsWith('javascript:') && !seen[href]) {
            seen[href] = true;
            links.push({ text: text.slice(0, 200), href: href });
          }
        });
      });
      return links;
    })()
  `);
}

async function getMetaDescription(page: Page): Promise<string> {
  return page.evaluate(`
    (function() {
      var meta = document.querySelector('meta[name="description"]');
      return meta ? (meta.getAttribute('content') || '') : '';
    })()
  `);
}

// ---------------------------------------------------------------------------
// Model extraction from text
// ---------------------------------------------------------------------------
function extractModelFromText(
  text: string,
  link: { text: string; href: string },
  screenshotFile: string,
): ModelInfo {
  const info: ModelInfo = {
    name: link.text || '',
    url: link.href,
    specs: [],
    fullText: text.slice(0, 10000),
    screenshotFile,
  };

  const m2Match = text.match(/(\d+[\.,]?\d*)\s*(?:m2|m\u00b2|metros?\s*cuadrados?)/i);
  if (m2Match) info.m2 = m2Match[0].trim();

  const priceMatch =
    text.match(/(?:USD|U\$D|US\$|AR\$|\$)\s*[\d.,]+/i) ||
    text.match(/[\d.,]+\s*(?:USD|dolares|d[o\u00f3]lares)/i);
  if (priceMatch) info.price = priceMatch[0].trim();

  const roomsMatch = text.match(/(\d+)\s*(?:dormitorio|habitaci[o\u00f3]n|ambiente|bedroom|room)/i);
  if (roomsMatch) info.rooms = roomsMatch[0].trim();

  const specPatterns = [
    /(\d+)\s*(?:ba[n\u00f1]o|bathroom)/gi,
    /(\d+)\s*(?:dormitorio|habitaci[o\u00f3]n|bedroom)/gi,
    /(\d+)\s*(?:cochera|garage|estacionamiento)/gi,
    /(?:living|cocina|kitchen|comedor|dining|quincho|parrilla|pileta|piscina|jard[i\u00ed]n)/gi,
    /(?:planta\s+(?:alta|baja)|(?:first|second|ground)\s+floor)/gi,
  ];
  for (const pat of specPatterns) {
    const matches = text.match(pat);
    if (matches) info.specs.push(...matches.map((m) => m.trim()));
  }

  return info;
}

// ---------------------------------------------------------------------------
// Markdown report generator
// ---------------------------------------------------------------------------
function generateMarkdown(report: SiteReport): string {
  let md = `# ${report.companyName} - Ground Truth Report\n\n`;
  md += `**Scanned at:** ${report.scannedAt}\n`;
  md += `**Base URL:** ${report.baseUrl}\n\n`;

  md += '## Homepage\n\n';
  md += `- **Title:** ${report.homepage.title}\n`;
  md += `- **Meta Description:** ${report.homepage.metaDescription}\n`;
  md += `- **Screenshot:** ${report.homepage.screenshotFile}\n\n`;
  md += '### Homepage Content\n\n';
  md += '```\n' + report.homepage.fullText.slice(0, 5000) + '\n```\n\n';

  md += '## Navigation\n\n';
  if (report.navigation.length === 0) {
    md += 'No navigation links detected.\n\n';
  } else {
    for (const nav of report.navigation) {
      md += `- [${nav.text}](${nav.href})\n`;
    }
    md += '\n';
  }

  md += `## Sections (${report.sections.length})\n\n`;
  for (const section of report.sections) {
    md += `### ${section.name}\n\n`;
    md += `- **URL:** ${section.url}\n`;
    md += `- **Screenshot:** ${section.screenshotFile}\n`;
    md += `- **Sub-links:** ${section.subLinks.length}\n\n`;
    md += '#### Content\n\n';
    md += '```\n' + section.text.slice(0, 3000) + '\n```\n\n';
  }

  md += `## Models (${report.models.length})\n\n`;
  if (report.models.length === 0) {
    md += 'No individual model pages found.\n\n';
  }
  for (const model of report.models) {
    md += `### ${model.name}\n\n`;
    md += `- **URL:** ${model.url}\n`;
    md += `- **M2:** ${model.m2 || 'N/A'}\n`;
    md += `- **Price:** ${model.price || 'N/A'}\n`;
    md += `- **Rooms:** ${model.rooms || 'N/A'}\n`;
    md += `- **Specs:** ${model.specs.join(', ') || 'N/A'}\n`;
    md += `- **Screenshot:** ${model.screenshotFile}\n\n`;
    md += '#### Full Text\n\n';
    md += '```\n' + model.fullText.slice(0, 3000) + '\n```\n\n';
  }

  md += '## PDF/Catalog Links\n\n';
  if (report.pdfLinks.length === 0) {
    md += 'No PDF or catalog links found.\n\n';
  } else {
    for (const pdf of report.pdfLinks) {
      md += `- [${pdf.text}](${pdf.href})\n`;
    }
    md += '\n';
  }

  md += `## All Links (${report.allLinks.length})\n\n`;
  for (const link of report.allLinks) {
    md += `- [${link.text.slice(0, 80)}](${link.href})\n`;
  }
  md += '\n';

  if (report.errors.length > 0) {
    md += '## Errors\n\n';
    for (const err of report.errors) {
      md += `- ${err}\n`;
    }
  }

  return md;
}

// ---------------------------------------------------------------------------
// Screenshot helper with per-company directory
// ---------------------------------------------------------------------------
let screenshotsDir = '';

async function takeScreenshot(page: Page, name: string): Promise<string> {
  const filename = `${name}.png`;
  const filepath = path.join(screenshotsDir, filename);
  try {
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`  [screenshot] ${filename}`);
  } catch (err: any) {
    console.warn(`  [screenshot] Failed: ${err.message}`);
  }
  return filename;
}

// ---------------------------------------------------------------------------
// Main scanner
// ---------------------------------------------------------------------------
export async function scanCompany(companyName: string, baseUrl: string): Promise<SiteReport> {
  const slug = slugify(companyName);
  const outputDir = path.join(__dirname, slug);
  screenshotsDir = path.join(outputDir, 'screenshots');
  ensureDir(screenshotsDir);

  const domain = getDomain(baseUrl);

  const report: SiteReport = {
    scannedAt: new Date().toISOString(),
    companyName,
    baseUrl,
    homepage: { title: '', metaDescription: '', fullText: '', screenshotFile: '' },
    navigation: [],
    sections: [],
    models: [],
    pdfLinks: [],
    allLinks: [],
    errors: [],
  };

  const browser: Browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'es-AR',
  });
  const page = await context.newPage();

  try {
    // -------------------------------------------------------------------
    // 1. Homepage
    // -------------------------------------------------------------------
    console.log(`\n=== STEP 1: Homepage (${companyName}) ===`);
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForPage(page);
    await closePopups(page);

    report.homepage.title = await page.title();
    report.homepage.metaDescription = await getMetaDescription(page);
    report.homepage.fullText = await extractVisibleText(page);
    report.homepage.screenshotFile = await takeScreenshot(page, '01-homepage');

    console.log(`  Title: ${report.homepage.title}`);
    console.log(`  Text length: ${report.homepage.fullText.length} chars`);

    // -------------------------------------------------------------------
    // 2. Navigation & Links
    // -------------------------------------------------------------------
    console.log(`\n=== STEP 2: Navigation & Links (${companyName}) ===`);
    report.allLinks = await extractAllLinks(page);
    console.log(`  Found ${report.allLinks.length} total links`);

    const navLinks = await extractNavLinks(page);
    report.navigation = navLinks;
    console.log(`  Navigation links: ${navLinks.length}`);
    for (const l of navLinks) {
      console.log(`    - "${l.text}" -> ${l.href}`);
    }

    // -------------------------------------------------------------------
    // 3. Scroll homepage for lazy content
    // -------------------------------------------------------------------
    console.log(`\n=== STEP 3: Scroll homepage (${companyName}) ===`);
    await autoScroll(page);
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '02-homepage-scrolled');

    const postScrollText = await extractVisibleText(page);
    if (postScrollText.length > report.homepage.fullText.length) {
      report.homepage.fullText = postScrollText;
    }

    // Update links after scroll (lazy content may have appeared)
    const postScrollLinks = await extractAllLinks(page);
    for (const link of postScrollLinks) {
      if (!report.allLinks.some((l) => l.href === link.href)) {
        report.allLinks.push(link);
      }
    }

    // -------------------------------------------------------------------
    // 4. Identify sections to visit
    // -------------------------------------------------------------------
    console.log(`\n=== STEP 4: Identify sections (${companyName}) ===`);

    const sectionsToVisit: { text: string; href: string }[] = [];

    for (const link of report.allLinks) {
      const linkDomain = getDomain(link.href);
      const isInternal = linkDomain === domain || link.href.startsWith(baseUrl);
      const notHomepage = normalizeUrl(link.href) !== normalizeUrl(baseUrl);
      const notAnchorOnly = !link.href.startsWith(baseUrl + '#');
      const notAsset = !/\.(jpg|jpeg|png|gif|svg|css|js|ico|woff|woff2|ttf|eot)(\?|$)/i.test(link.href);

      if (isInternal && notHomepage && notAnchorOnly && notAsset &&
          !sectionsToVisit.some((s) => s.href === link.href)) {
        sectionsToVisit.push(link);
      }
    }

    // Add nav links that weren't already found
    for (const link of navLinks) {
      if (!sectionsToVisit.some((s) => s.href === link.href) &&
          normalizeUrl(link.href) !== normalizeUrl(baseUrl)) {
        sectionsToVisit.push(link);
      }
    }

    console.log(`  Sections to visit: ${sectionsToVisit.length}`);

    // -------------------------------------------------------------------
    // 5. Visit each section
    // -------------------------------------------------------------------
    console.log(`\n=== STEP 5: Visit sections (${companyName}) ===`);
    let sectionIdx = 0;
    const visitedNormalized = new Set<string>();
    visitedNormalized.add(normalizeUrl(baseUrl));

    for (const section of sectionsToVisit) {
      if (sectionIdx >= MAX_PAGES) {
        console.log(`  Reached max pages limit (${MAX_PAGES}), stopping section scan`);
        break;
      }

      const norm = normalizeUrl(section.href);
      if (visitedNormalized.has(norm)) continue;
      visitedNormalized.add(norm);
      sectionIdx++;

      const sectionName = section.text || `section-${sectionIdx}`;
      console.log(`\n  --- Section ${sectionIdx}: ${sectionName} ---`);
      console.log(`      URL: ${section.href}`);

      try {
        await safeGoto(page, section.href);
        await closePopups(page);
        await autoScroll(page);

        const text = await extractVisibleText(page);
        const subLinks = await extractAllLinks(page);
        const screenshotFile = await takeScreenshot(
          page,
          `03-section-${fileSlug(sectionName)}-${sectionIdx}`
        );

        const sectionInfo: SectionInfo = {
          name: sectionName,
          url: section.href,
          text: text.slice(0, 20000),
          screenshotFile,
          subLinks: subLinks.filter((l) => getDomain(l.href) === domain),
        };
        report.sections.push(sectionInfo);

        // Discover new internal links
        for (const sub of subLinks) {
          if (
            getDomain(sub.href) === domain &&
            !visitedNormalized.has(normalizeUrl(sub.href)) &&
            !sectionsToVisit.some((s) => s.href === sub.href)
          ) {
            sectionsToVisit.push(sub);
          }
        }

        console.log(`      Text: ${text.length} chars, Sub-links: ${sectionInfo.subLinks.length}`);
      } catch (err: any) {
        const msg = `Error visiting ${section.href}: ${err.message}`;
        console.error(`      ${msg}`);
        report.errors.push(msg);
      }
    }

    // -------------------------------------------------------------------
    // 6. Model detail pages
    // -------------------------------------------------------------------
    console.log(`\n=== STEP 6: Model detail pages (${companyName}) ===`);

    const modelUrls: { text: string; href: string }[] = [];

    // Check all discovered links for model keywords
    const allDiscoveredLinks = [
      ...report.allLinks,
      ...report.sections.flatMap((s) => s.subLinks),
    ];

    for (const link of allDiscoveredLinks) {
      const lower = (link.text + ' ' + link.href).toLowerCase();
      if (
        getDomain(link.href) === domain &&
        MODEL_KEYWORDS.some((k) => lower.includes(k)) &&
        !modelUrls.some((m) => m.href === link.href)
      ) {
        modelUrls.push(link);
      }
    }

    console.log(`  Potential model pages: ${modelUrls.length}`);

    for (const modelLink of modelUrls) {
      const norm = normalizeUrl(modelLink.href);
      if (visitedNormalized.has(norm)) {
        // Already visited - extract from existing section data
        const existing = report.sections.find((s) => normalizeUrl(s.url) === norm);
        if (existing) {
          const modelInfo = extractModelFromText(existing.text, modelLink, existing.screenshotFile);
          if (modelInfo.name) {
            report.models.push(modelInfo);
          }
        }
        continue;
      }
      visitedNormalized.add(norm);

      console.log(`\n  --- Model: ${modelLink.text} ---`);
      try {
        await safeGoto(page, modelLink.href);
        await closePopups(page);
        await autoScroll(page);

        const text = await extractVisibleText(page);
        const screenshotFile = await takeScreenshot(
          page,
          `04-model-${fileSlug(modelLink.text)}`
        );

        const modelInfo = extractModelFromText(text, modelLink, screenshotFile);
        report.models.push(modelInfo);

        console.log(`      Name: ${modelInfo.name}`);
        console.log(`      M2: ${modelInfo.m2 || 'N/A'}, Price: ${modelInfo.price || 'N/A'}, Rooms: ${modelInfo.rooms || 'N/A'}`);
      } catch (err: any) {
        const msg = `Error visiting model ${modelLink.href}: ${err.message}`;
        console.error(`      ${msg}`);
        report.errors.push(msg);
      }
    }

    // -------------------------------------------------------------------
    // 7. PDF/Catalog links
    // -------------------------------------------------------------------
    console.log(`\n=== STEP 7: PDF/Catalog links (${companyName}) ===`);

    for (const link of allDiscoveredLinks) {
      const lower = (link.text + ' ' + link.href).toLowerCase();
      if (
        (lower.includes('.pdf') || lower.includes('catalogo') || lower.includes('catalog') ||
         lower.includes('brochure') || lower.includes('descarg') || lower.includes('download')) &&
        !report.pdfLinks.some((p) => p.href === link.href)
      ) {
        report.pdfLinks.push(link);
        console.log(`  PDF: "${link.text}" -> ${link.href}`);
      }
    }

    if (report.pdfLinks.length === 0) {
      console.log('  No PDF/catalog links found');
    }

    // -------------------------------------------------------------------
    // 8. Expand "Ver mas" buttons on homepage
    // -------------------------------------------------------------------
    console.log(`\n=== STEP 8: Expand buttons (${companyName}) ===`);
    await safeGoto(page, baseUrl);

    const expandSelectors = [
      'button:has-text("Ver m")',
      'button:has-text("ver m")',
      'button:has-text("Leer m")',
      'button:has-text("Show more")',
      'button:has-text("See more")',
      '[class*="expand"]',
      '[class*="ver-mas"]',
    ];

    let expanded = 0;
    for (const sel of expandSelectors) {
      try {
        const elements = page.locator(sel);
        const count = await elements.count();
        for (let i = 0; i < Math.min(count, 5); i++) {
          try {
            await elements.nth(i).click({ timeout: 2000 });
            expanded++;
            await page.waitForTimeout(500);
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
    }

    if (expanded > 0) {
      console.log(`  Expanded ${expanded} elements`);
      await takeScreenshot(page, '05-homepage-expanded');
      const expandedText = await extractVisibleText(page);
      if (expandedText.length > report.homepage.fullText.length) {
        report.homepage.fullText = expandedText;
      }
    } else {
      console.log('  No expand buttons found');
    }

  } catch (err: any) {
    console.error(`FATAL ERROR scanning ${companyName}: ${err.message}`);
    report.errors.push(`Fatal: ${err.message}`);
  } finally {
    await browser.close();
  }

  // -------------------------------------------------------------------
  // 9. Save report
  // -------------------------------------------------------------------
  console.log(`\n=== STEP 9: Save report (${companyName}) ===`);

  const jsonPath = path.join(outputDir, 'ground-truth.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`  JSON saved: ${jsonPath}`);

  const mdPath = path.join(outputDir, 'ground-truth.md');
  fs.writeFileSync(mdPath, generateMarkdown(report));
  console.log(`  Markdown saved: ${mdPath}`);

  console.log(`\n=== SCAN COMPLETE: ${companyName} ===`);
  console.log(`  Sections: ${report.sections.length}`);
  console.log(`  Models: ${report.models.length}`);
  console.log(`  PDF links: ${report.pdfLinks.length}`);
  console.log(`  Total links: ${report.allLinks.length}`);
  console.log(`  Errors: ${report.errors.length}`);

  return report;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
if (require.main === module) {
  const { name, url } = parseArgs();
  scanCompany(name, url).catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
