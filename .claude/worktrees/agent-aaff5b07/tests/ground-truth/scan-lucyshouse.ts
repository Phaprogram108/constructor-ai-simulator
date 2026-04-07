/**
 * Ground Truth Scanner for Lucy's House Argentina
 *
 * Crawls https://www.lucyshousearg.com/ (Wix SPA) and extracts
 * all visible content: navigation, sections, models, specs, PDFs.
 *
 * Run with: npx tsx tests/ground-truth/scan-lucyshouse.ts
 */

import { chromium, type Browser, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE_URL = 'https://www.lucyshousearg.com/';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const OUTPUT_DIR = __dirname;
const WAIT_MS = 4000;

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
// Helpers
// ---------------------------------------------------------------------------
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

async function waitForWix(page: Page) {
  try {
    await page.waitForLoadState('networkidle', { timeout: 15000 });
  } catch {
    // networkidle can timeout on Wix with analytics pings
  }
  await page.waitForTimeout(WAIT_MS);
}

async function takeScreenshot(page: Page, name: string): Promise<string> {
  const filename = `${name}.png`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`  [screenshot] ${filename}`);
  return filename;
}

/**
 * Scroll page incrementally to trigger lazy loading.
 * Uses page.evaluate with a string template to avoid tsx __name issues.
 */
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

async function extractVisibleText(page: Page): Promise<string> {
  // Use string expression to avoid tsx transformation issues
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

async function extractAnchorSections(page: Page): Promise<{ id: string; text: string }[]> {
  return page.evaluate(`
    (function() {
      var sections = [];
      document.querySelectorAll('[id]').forEach(function(el) {
        var id = el.id;
        if (id && !id.startsWith('_') && id.length > 2) {
          var text = (el.textContent || '').trim().slice(0, 200);
          if (text) sections.push({ id: id, text: text });
        }
      });
      return sections;
    })()
  `);
}

async function extractClickableElements(page: Page): Promise<{ tag: string; text: string; type: string }[]> {
  return page.evaluate(`
    (function() {
      var elements = [];
      document.querySelectorAll('button, [role="button"], .button, [class*="button"], [class*="btn"]').forEach(function(el) {
        var text = (el.textContent || '').trim().slice(0, 100);
        if (text && text.length > 1) {
          elements.push({ tag: el.tagName, text: text, type: 'button' });
        }
      });
      document.querySelectorAll('[class*="accordion"], [class*="expand"], [class*="collapse"], [class*="faq"]').forEach(function(el) {
        var text = (el.textContent || '').trim().slice(0, 100);
        if (text) {
          elements.push({ tag: el.tagName, text: text, type: 'accordion' });
        }
      });
      return elements;
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

/**
 * Navigate to a URL with resilient handling for Wix SPA.
 * Falls back to setting window.location if goto times out.
 */
async function safeGoto(page: Page, url: string) {
  try {
    await page.goto(url, { waitUntil: 'commit', timeout: 15000 });
  } catch {
    // Wix SPA: goto can timeout. Try client-side navigation.
    try {
      await page.evaluate(`window.location.href = "${url}"`);
    } catch {
      // ignore
    }
  }
  // Always wait for Wix rendering regardless of navigation method
  await page.waitForTimeout(WAIT_MS);
  try {
    await page.waitForLoadState('networkidle', { timeout: 8000 });
  } catch {
    // ok
  }
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

// ---------------------------------------------------------------------------
// Extract model info from page text
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

  // m2
  const m2Match = text.match(/(\d+[\.,]?\d*)\s*(?:m2|m\u00b2|metros?\s*cuadrados?)/i);
  if (m2Match) info.m2 = m2Match[0].trim();

  // price
  const priceMatch =
    text.match(/(?:USD|U\$D|US\$|AR\$|\$)\s*[\d.,]+/i) ||
    text.match(/[\d.,]+\s*(?:USD|dolares|d[o\u00f3]lares)/i);
  if (priceMatch) info.price = priceMatch[0].trim();

  // rooms
  const roomsMatch = text.match(/(\d+)\s*(?:dormitorio|habitaci[o\u00f3]n|ambiente|bedroom|room)/i);
  if (roomsMatch) info.rooms = roomsMatch[0].trim();

  // specs
  const specPatterns = [
    /(\d+)\s*(?:ba[n\u00f1]o|bathroom)/gi,
    /(\d+)\s*(?:dormitorio|habitaci[o\u00f3]n|bedroom)/gi,
    /(\d+)\s*(?:cochera|garage|estacionamiento)/gi,
    /(?:living|cocina|kitchen|comedor|dining|quincho|parrilla|pileta|piscina|jard[i\u00ed]n)/gi,
    /(?:planta\s+(?:alta|baja)|(?:first|second|ground)\s+floor)/gi,
  ];
  for (const pat of specPatterns) {
    const matches = text.match(pat);
    if (matches) info.specs.push(...matches.map(function(m) { return m.trim(); }));
  }

  return info;
}

// ---------------------------------------------------------------------------
// Generate markdown report
// ---------------------------------------------------------------------------
function generateMarkdown(report: SiteReport): string {
  let md = "# Lucy's House Argentina - Ground Truth Report\n\n";
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
// Main scanner
// ---------------------------------------------------------------------------
async function main() {
  ensureDir(SCREENSHOTS_DIR);

  const report: SiteReport = {
    scannedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
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
    viewport: { width: 1440, height: 900 },
    locale: 'es-AR',
  });
  const page = await context.newPage();

  try {
    // -----------------------------------------------------------------------
    // 1. Homepage
    // -----------------------------------------------------------------------
    console.log('\n=== STEP 1: Homepage ===');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForWix(page);
    await closePopups(page);

    report.homepage.title = await page.title();
    report.homepage.metaDescription = await getMetaDescription(page);
    report.homepage.fullText = await extractVisibleText(page);
    report.homepage.screenshotFile = await takeScreenshot(page, '01-homepage');

    console.log(`  Title: ${report.homepage.title}`);
    console.log(`  Meta: ${report.homepage.metaDescription.slice(0, 100)}`);

    // -----------------------------------------------------------------------
    // 2. Extract all links and find navigation
    // -----------------------------------------------------------------------
    console.log('\n=== STEP 2: Navigation & Links ===');
    report.allLinks = await extractAllLinks(page);
    console.log(`  Found ${report.allLinks.length} total links`);

    const navLinks = await extractNavLinks(page);
    report.navigation = navLinks;
    console.log(`  Navigation links found: ${navLinks.length}`);
    for (const l of navLinks) {
      console.log(`    - "${l.text}" -> ${l.href}`);
    }

    // -----------------------------------------------------------------------
    // 3. Scroll homepage to trigger lazy loading
    // -----------------------------------------------------------------------
    console.log('\n=== STEP 3: Scroll homepage for lazy content ===');
    await autoScroll(page);
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '02-homepage-after-scroll');

    const postScrollText = await extractVisibleText(page);
    if (postScrollText.length > report.homepage.fullText.length) {
      report.homepage.fullText = postScrollText;
    }

    // -----------------------------------------------------------------------
    // 4. Identify sections to visit
    // -----------------------------------------------------------------------
    console.log('\n=== STEP 4: Identify sections ===');

    const anchorSections = await extractAnchorSections(page);
    console.log(`  Anchor sections: ${anchorSections.length}`);
    for (const s of anchorSections) {
      console.log(`    #${s.id}: ${s.text.slice(0, 60)}`);
    }

    // Filter interesting internal links
    const sectionsToVisit: { text: string; href: string }[] = [];
    for (const link of report.allLinks) {
      const isInternal = link.href.includes('lucyshousearg.com');
      const notHomepage = link.href !== BASE_URL && link.href !== BASE_URL.slice(0, -1);
      if (isInternal && notHomepage && !sectionsToVisit.some(function(s) { return s.href === link.href; })) {
        sectionsToVisit.push(link);
      }
    }

    // Also add nav links
    for (const link of navLinks) {
      if (!sectionsToVisit.some(function(s) { return s.href === link.href; }) && link.href !== BASE_URL) {
        sectionsToVisit.push(link);
      }
    }

    console.log(`  Sections to visit: ${sectionsToVisit.length}`);
    for (const s of sectionsToVisit) {
      console.log(`    - "${s.text}" -> ${s.href}`);
    }

    // -----------------------------------------------------------------------
    // 5. Visit each section
    // -----------------------------------------------------------------------
    console.log('\n=== STEP 5: Visit each section ===');
    let sectionIdx = 0;
    const visitedUrls = new Set<string>();
    visitedUrls.add(BASE_URL);

    // Helper: normalize URL for dedup (strip hash for same-path pages)
    function normalizeUrl(url: string): string {
      try {
        const u = new URL(url);
        return u.origin + u.pathname + u.search;
      } catch {
        return url;
      }
    }
    // Track by normalized URL to avoid visiting same page with different hashes
    const visitedNormalized = new Set<string>();
    visitedNormalized.add(normalizeUrl(BASE_URL));

    for (const section of sectionsToVisit) {
      const norm = normalizeUrl(section.href);
      if (visitedNormalized.has(norm)) continue;
      visitedNormalized.add(norm);
      visitedUrls.add(section.href);
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
        const screenshotFile = await takeScreenshot(page, `03-section-${slug(sectionName)}-${sectionIdx}`);

        const sectionInfo: SectionInfo = {
          name: sectionName,
          url: section.href,
          text: text.slice(0, 20000),
          screenshotFile,
          subLinks: subLinks.filter(function(l) { return l.href.includes('lucyshousearg.com'); }),
        };
        report.sections.push(sectionInfo);

        // Discover new internal links
        for (const sub of subLinks) {
          if (
            sub.href.includes('lucyshousearg.com') &&
            !visitedUrls.has(sub.href) &&
            !sectionsToVisit.some(function(s) { return s.href === sub.href; })
          ) {
            sectionsToVisit.push(sub);
          }
        }

        console.log(`      Text length: ${text.length} chars`);
        console.log(`      Sub-links: ${sectionInfo.subLinks.length}`);
      } catch (err: any) {
        const msg = `Error visiting ${section.href}: ${err.message}`;
        console.error(`      ${msg}`);
        report.errors.push(msg);
      }
    }

    // -----------------------------------------------------------------------
    // 6. Look for model detail pages
    // -----------------------------------------------------------------------
    console.log('\n=== STEP 6: Model detail pages ===');

    const modelKeywords = ['modelo', 'model', 'casa', 'house', 'tipolog', 'planta'];
    const modelUrls: { text: string; href: string }[] = [];

    for (const link of report.allLinks) {
      const lower = (link.text + link.href).toLowerCase();
      if (
        link.href.includes('lucyshousearg.com') &&
        modelKeywords.some(function(k) { return lower.includes(k); }) &&
        !modelUrls.some(function(m) { return m.href === link.href; })
      ) {
        modelUrls.push(link);
      }
    }

    // Also check sections' subLinks
    for (const section of report.sections) {
      for (const sub of section.subLinks) {
        const lower = (sub.text + sub.href).toLowerCase();
        if (
          modelKeywords.some(function(k) { return lower.includes(k); }) &&
          !modelUrls.some(function(m) { return m.href === sub.href; })
        ) {
          modelUrls.push(sub);
        }
      }
    }

    console.log(`  Potential model pages: ${modelUrls.length}`);
    for (const m of modelUrls) {
      console.log(`    - "${m.text}" -> ${m.href}`);
    }

    for (const modelLink of modelUrls) {
      if (visitedUrls.has(modelLink.href)) {
        // Already visited as a section - extract model info from existing data
        const existing = report.sections.find(function(s) { return s.url === modelLink.href; });
        if (existing) {
          const modelInfo = extractModelFromText(existing.text, modelLink, existing.screenshotFile);
          if (modelInfo.name) {
            report.models.push(modelInfo);
          }
        }
        continue;
      }
      visitedUrls.add(modelLink.href);

      console.log(`\n  --- Model: ${modelLink.text} ---`);
      try {
        await safeGoto(page, modelLink.href);
        await closePopups(page);
        await autoScroll(page);

        const text = await extractVisibleText(page);
        const screenshotFile = await takeScreenshot(page, `04-model-${slug(modelLink.text)}`);

        const modelInfo = extractModelFromText(text, modelLink, screenshotFile);
        report.models.push(modelInfo);

        console.log(`      Name: ${modelInfo.name}`);
        console.log(`      M2: ${modelInfo.m2 || 'N/A'}`);
        console.log(`      Price: ${modelInfo.price || 'N/A'}`);
        console.log(`      Rooms: ${modelInfo.rooms || 'N/A'}`);
      } catch (err: any) {
        const msg = `Error visiting model ${modelLink.href}: ${err.message}`;
        console.error(`      ${msg}`);
        report.errors.push(msg);
      }
    }

    // -----------------------------------------------------------------------
    // 7. Look for PDF/catalog links
    // -----------------------------------------------------------------------
    console.log('\n=== STEP 7: PDF/Catalog links ===');
    const allLinksToCheck = [...report.allLinks];
    for (const section of report.sections) {
      allLinksToCheck.push(...section.subLinks);
    }

    for (const link of allLinksToCheck) {
      const lower = (link.text + link.href).toLowerCase();
      if (
        (lower.includes('.pdf') || lower.includes('catalogo') ||
         lower.includes('catalog') || lower.includes('brochure') || lower.includes('descarg')) &&
        !report.pdfLinks.some(function(p) { return p.href === link.href; })
      ) {
        report.pdfLinks.push(link);
        console.log(`  PDF: "${link.text}" -> ${link.href}`);
      }
    }

    if (report.pdfLinks.length === 0) {
      console.log('  No PDF/catalog links found');
    }

    // -----------------------------------------------------------------------
    // 8. Check for clickable elements on homepage
    // -----------------------------------------------------------------------
    console.log('\n=== STEP 8: Check for clickable elements on homepage ===');
    await safeGoto(page, BASE_URL);

    const clickableElements = await extractClickableElements(page);

    console.log(`  Clickable elements: ${clickableElements.length}`);
    for (const e of clickableElements) {
      console.log(`    [${e.type}] ${e.tag}: ${e.text.slice(0, 60)}`);
    }

    // Try clicking "Ver mas" buttons
    const expandButtons = clickableElements.filter(function(e) {
      return /ver\s*m[a\u00e1]s|see\s*more|mostrar|show|leer\s*m[a\u00e1]s/i.test(e.text);
    });
    if (expandButtons.length > 0) {
      console.log(`\n  Clicking ${expandButtons.length} "ver mas" buttons...`);
      for (const btn of expandButtons) {
        try {
          await page.click(`text=${btn.text}`, { timeout: 3000 });
          await page.waitForTimeout(1000);
        } catch {
          // ignore
        }
      }
      await takeScreenshot(page, '05-homepage-expanded');
      const expandedText = await extractVisibleText(page);
      if (expandedText.length > report.homepage.fullText.length) {
        report.homepage.fullText = expandedText;
      }
    }

  } catch (err: any) {
    console.error(`FATAL ERROR: ${err.message}`);
    report.errors.push(`Fatal: ${err.message}`);
  } finally {
    await browser.close();
  }

  // -----------------------------------------------------------------------
  // 9. Save report
  // -----------------------------------------------------------------------
  console.log('\n=== STEP 9: Save report ===');

  const jsonPath = path.join(OUTPUT_DIR, 'lucyshouse-ground-truth.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`  JSON saved: ${jsonPath}`);

  const mdPath = path.join(OUTPUT_DIR, 'lucyshouse-ground-truth.md');
  fs.writeFileSync(mdPath, generateMarkdown(report));
  console.log(`  Markdown saved: ${mdPath}`);

  // Summary
  console.log('\n=== SCAN COMPLETE ===');
  console.log(`  Sections found: ${report.sections.length}`);
  console.log(`  Models found: ${report.models.length}`);
  console.log(`  PDF links: ${report.pdfLinks.length}`);
  console.log(`  Total links: ${report.allLinks.length}`);
  console.log(`  Errors: ${report.errors.length}`);
  console.log(`  Screenshots: ${fs.readdirSync(SCREENSHOTS_DIR).length}`);
}

// ---------------------------------------------------------------------------
main().catch(console.error);
