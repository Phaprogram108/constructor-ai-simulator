/**
 * Ground Truth Testing Orchestrator
 *
 * Runs the full pipeline for multiple companies:
 * 1. Playwright scans (parallel, max 3 concurrent)
 * 2. Agent tests (sequential, respects Firecrawl limits)
 * 3. Comparison reports
 * 4. Final summary
 *
 * Usage:
 *   npx tsx tests/ground-truth/run-all.ts
 *   npx tsx tests/ground-truth/run-all.ts --force
 *   npx tsx tests/ground-truth/run-all.ts --skip-scan
 *   npx tsx tests/ground-truth/run-all.ts --skip-agent
 */

import * as fs from 'fs';
import * as path from 'path';
import { scanCompany } from './scan-company';
import { testAgent } from './test-agent';
import { compareResults } from './compare';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
// Load companies from test-companies.json + extras
function loadAllCompanies(): { name: string; url: string }[] {
  const companiesFile = path.join(__dirname, '..', '..', 'src', 'scripts', 'test-companies.json');
  const raw = JSON.parse(fs.readFileSync(companiesFile, 'utf-8'));
  const all: { name: string; url: string }[] = [];
  const seen = new Set<string>();

  // Add Lucy's House first (our reference)
  all.push({ name: 'Lucys House', url: 'https://www.lucyshousearg.com/' });
  seen.add('https://www.lucyshousearg.com/');

  // Add all companies from JSON
  for (const group of ['problematicas', 'aleatorias', 'fase2']) {
    const companies = raw.companies[group] || [];
    for (const c of companies) {
      if (!seen.has(c.url)) {
        all.push({ name: c.name, url: c.url });
        seen.add(c.url);
      }
    }
  }

  // Add extra companies to reach ~50
  const extras = [
    { name: 'Makenhaus', url: 'https://makenhaus.com/' },
    { name: 'Cabanas del Sol', url: 'https://cabanasdelsol.com.ar/' },
    { name: 'Arq Steel', url: 'https://arqsteel.com.ar/' },
    { name: 'Casas Fenix', url: 'https://casasfenix.com.ar/' },
    { name: 'Modhouse', url: 'https://modhouse.com.ar/' },
    { name: 'InduHouse', url: 'https://induhouse.com.ar/' },
    { name: 'Steelplex', url: 'https://steelplex.com.ar/' },
    { name: 'Sipanel', url: 'https://sipanel.com.ar/' },
    { name: 'Wood Frames', url: 'https://woodframes.com.ar/' },
    { name: 'Bauhaus Modular', url: 'https://bauhausmodular.com.ar/' },
  ];

  for (const c of extras) {
    if (!seen.has(c.url)) {
      all.push(c);
      seen.add(c.url);
    }
  }

  return all;
}

const COMPANIES = loadAllCompanies();

const MAX_CONCURRENT_SCANS = 4;
const SCAN_TIMEOUT_MS = 4 * 60 * 1000; // 4 minutes per scan (fail fast)
const AGENT_TEST_TIMEOUT_MS = 6 * 60 * 1000; // 6 minutes per agent test

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
function parseArgs(): { force: boolean; skipScan: boolean; skipAgent: boolean } {
  const args = process.argv.slice(2);
  return {
    force: args.includes('--force'),
    skipScan: args.includes('--skip-scan'),
    skipAgent: args.includes('--skip-agent'),
  };
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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run a function with a timeout. Returns { ok, result?, error? }
 */
async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  label: string
): Promise<{ ok: boolean; result?: T; error?: string }> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ ok: false, error: `${label} timed out after ${timeoutMs / 1000}s` });
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timer);
        resolve({ ok: true, result });
      })
      .catch((err) => {
        clearTimeout(timer);
        resolve({ ok: false, error: `${label}: ${err.message || err}` });
      });
  });
}

interface CompanyResult {
  name: string;
  url: string;
  scanStatus: string;
  scanPages: number;
  agentStatus: string;
  agentQuestions: number;
  accuracy: number;
  keyIssues: string;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Phase 1: Playwright Scans (parallel)
// ---------------------------------------------------------------------------
async function runScans(
  companies: typeof COMPANIES,
  force: boolean
): Promise<Map<string, CompanyResult>> {
  console.log('\n' + '='.repeat(70));
  console.log('PHASE 1: PLAYWRIGHT SCANS');
  console.log('='.repeat(70));

  const results = new Map<string, CompanyResult>();

  // Initialize results
  for (const company of companies) {
    results.set(company.name, {
      name: company.name,
      url: company.url,
      scanStatus: 'pending',
      scanPages: 0,
      agentStatus: 'pending',
      agentQuestions: 0,
      accuracy: 0,
      keyIssues: '',
      errors: [],
    });
  }

  // Check which companies need scanning
  const toScan: typeof COMPANIES = [];
  for (const company of companies) {
    const slug = slugify(company.name);
    const gtPath = path.join(__dirname, slug, 'ground-truth.json');

    if (!force && fs.existsSync(gtPath)) {
      console.log(`  [SKIP] ${company.name} - ground-truth.json already exists`);
      try {
        const gt = JSON.parse(fs.readFileSync(gtPath, 'utf-8'));
        const r = results.get(company.name)!;
        r.scanStatus = 'cached';
        r.scanPages = (gt.sections?.length || 0) + 1;
      } catch {
        // corrupted file, re-scan
        toScan.push(company);
      }
    } else {
      toScan.push(company);
    }
  }

  if (toScan.length === 0) {
    console.log('\n  All scans cached. Use --force to re-scan.');
    return results;
  }

  console.log(`\n  Scanning ${toScan.length} companies (max ${MAX_CONCURRENT_SCANS} concurrent)...\n`);

  // Process in batches
  for (let i = 0; i < toScan.length; i += MAX_CONCURRENT_SCANS) {
    const batch = toScan.slice(i, i + MAX_CONCURRENT_SCANS);
    const batchLabel = `Batch ${Math.floor(i / MAX_CONCURRENT_SCANS) + 1}`;
    console.log(`  --- ${batchLabel}: ${batch.map(c => c.name).join(', ')} ---`);

    const promises = batch.map(async (company) => {
      console.log(`  [START] Scanning ${company.name}...`);
      const startTime = Date.now();

      const outcome = await withTimeout(
        () => scanCompany(company.name, company.url),
        SCAN_TIMEOUT_MS,
        `Scan ${company.name}`
      );

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const r = results.get(company.name)!;

      if (outcome.ok && outcome.result) {
        r.scanStatus = `done (${elapsed}s)`;
        r.scanPages = (outcome.result.sections?.length || 0) + 1;
        r.errors.push(...outcome.result.errors);
        console.log(`  [DONE] ${company.name} - ${r.scanPages} pages in ${elapsed}s`);
      } else {
        r.scanStatus = `FAILED (${elapsed}s)`;
        r.errors.push(outcome.error || 'Unknown scan error');
        console.error(`  [FAIL] ${company.name}: ${outcome.error}`);
      }
    });

    await Promise.all(promises);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Phase 2: Agent Tests (sequential)
// ---------------------------------------------------------------------------
async function runAgentTests(
  companies: typeof COMPANIES,
  results: Map<string, CompanyResult>,
  force: boolean
): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('PHASE 2: AGENT TESTS (sequential)');
  console.log('='.repeat(70));

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    const r = results.get(company.name)!;

    console.log(`\n  [${i + 1}/${companies.length}] ${company.name}`);

    // Check if already tested
    const slug = slugify(company.name);
    const agentPath = path.join(__dirname, slug, 'agent-test.json');

    if (!force && fs.existsSync(agentPath)) {
      console.log(`    [SKIP] agent-test.json already exists`);
      try {
        const agentResult = JSON.parse(fs.readFileSync(agentPath, 'utf-8'));
        r.agentStatus = 'cached';
        r.agentQuestions = agentResult.summary?.totalQuestions || agentResult.conversations?.length || 0;
      } catch {
        // corrupted, re-test
      }
      if (r.agentStatus === 'cached') continue;
    }

    console.log(`    Testing ${company.url}...`);
    const startTime = Date.now();

    const outcome = await withTimeout(
      () => testAgent(company.name, company.url, force),
      AGENT_TEST_TIMEOUT_MS,
      `Agent test ${company.name}`
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (outcome.ok && outcome.result) {
      r.agentStatus = `done (${elapsed}s)`;
      r.agentQuestions = outcome.result.summary?.totalQuestions || outcome.result.conversations?.length || 0;
      const noInfo = outcome.result.summary?.noInfo || 0;
      r.errors.push(...(outcome.result.errors || []));
      console.log(`    [DONE] ${r.agentQuestions} questions, ${noInfo} no-info in ${elapsed}s`);
    } else {
      r.agentStatus = `FAILED (${elapsed}s)`;
      r.errors.push(outcome.error || 'Unknown agent test error');
      console.error(`    [FAIL] ${outcome.error}`);
    }

    // Small delay between tests to be nice to the API
    if (i < companies.length - 1) {
      console.log('    Waiting 3s before next test...');
      await sleep(3000);
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 3: Comparison Reports
// ---------------------------------------------------------------------------
function runComparisons(
  companies: typeof COMPANIES,
  results: Map<string, CompanyResult>
): void {
  console.log('\n' + '='.repeat(70));
  console.log('PHASE 3: COMPARISON REPORTS');
  console.log('='.repeat(70));

  for (const company of companies) {
    const r = results.get(company.name)!;
    console.log(`\n  ${company.name}:`);

    try {
      const comparison = compareResults(company.name);
      if (comparison) {
        r.accuracy = comparison.accuracy;
        r.keyIssues = comparison.keyGaps.slice(0, 2).join('; ') || 'None detected';
        console.log(`    Accuracy: ${comparison.accuracy}%`);
        console.log(`    Gaps: ${comparison.keyGaps.length}`);
      } else {
        r.keyIssues = 'Missing data for comparison';
        console.log('    Could not generate comparison (missing data)');
      }
    } catch (err: any) {
      r.keyIssues = `Comparison error: ${err.message}`;
      console.error(`    Error: ${err.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 4: Summary Report
// ---------------------------------------------------------------------------
function generateSummary(
  results: Map<string, CompanyResult>
): void {
  console.log('\n' + '='.repeat(70));
  console.log('PHASE 4: SUMMARY REPORT');
  console.log('='.repeat(70));

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  let md = `# Testing Summary - ${dateStr}\n\n`;
  md += `Generated: ${now.toISOString()}\n\n`;

  md += '| Company | Playwright | Agent Test | Accuracy | Key Issues |\n';
  md += '|---------|-----------|------------|----------|------------|\n';

  for (const [, r] of results) {
    const scanCol = r.scanStatus.startsWith('done') || r.scanStatus === 'cached'
      ? `done ${r.scanPages} pages`
      : r.scanStatus;

    const agentCol = r.agentStatus.startsWith('done') || r.agentStatus === 'cached'
      ? `done ${r.agentQuestions} questions`
      : r.agentStatus;

    const accuracyCol = r.accuracy > 0 ? `${r.accuracy}%` : 'N/A';
    const issuesCol = r.keyIssues || (r.errors.length > 0 ? r.errors[0].slice(0, 60) : '-');

    md += `| ${r.name} | ${scanCol} | ${agentCol} | ${accuracyCol} | ${issuesCol.slice(0, 80)} |\n`;
  }

  md += '\n## Detailed Results\n\n';
  for (const [, r] of results) {
    md += `### ${r.name}\n\n`;
    md += `- URL: ${r.url}\n`;
    md += `- Scan: ${r.scanStatus} (${r.scanPages} pages)\n`;
    md += `- Agent: ${r.agentStatus} (${r.agentQuestions} questions)\n`;
    md += `- Accuracy: ${r.accuracy > 0 ? r.accuracy + '%' : 'N/A'}\n`;
    if (r.errors.length > 0) {
      md += `- Errors:\n`;
      for (const err of r.errors.slice(0, 5)) {
        md += `  - ${err.slice(0, 120)}\n`;
      }
    }
    md += '\n';
  }

  const summaryPath = path.join(__dirname, 'SUMMARY.md');
  fs.writeFileSync(summaryPath, md);
  console.log(`\n  Summary saved: ${summaryPath}`);

  // Print table to console
  console.log('\n' + md);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const { force, skipScan, skipAgent } = parseArgs();

  console.log('='.repeat(70));
  console.log('GROUND TRUTH TESTING PIPELINE');
  console.log('='.repeat(70));
  console.log(`Companies: ${COMPANIES.length}`);
  console.log(`Force: ${force}`);
  console.log(`Skip scan: ${skipScan}`);
  console.log(`Skip agent: ${skipAgent}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('='.repeat(70));

  // Phase 1: Scans
  let results: Map<string, CompanyResult>;
  if (skipScan) {
    console.log('\n  Skipping Playwright scans (--skip-scan)');
    results = new Map();
    for (const company of COMPANIES) {
      const slug = slugify(company.name);
      const gtPath = path.join(__dirname, slug, 'ground-truth.json');
      let scanPages = 0;
      let scanStatus = 'skipped';
      if (fs.existsSync(gtPath)) {
        try {
          const gt = JSON.parse(fs.readFileSync(gtPath, 'utf-8'));
          scanPages = (gt.sections?.length || 0) + 1;
          scanStatus = 'cached';
        } catch { /* ignore */ }
      }
      results.set(company.name, {
        name: company.name,
        url: company.url,
        scanStatus,
        scanPages,
        agentStatus: 'pending',
        agentQuestions: 0,
        accuracy: 0,
        keyIssues: '',
        errors: [],
      });
    }
  } else {
    results = await runScans(COMPANIES, force);
  }

  // Phase 2: Agent tests
  if (skipAgent) {
    console.log('\n  Skipping agent tests (--skip-agent)');
    for (const company of COMPANIES) {
      const r = results.get(company.name)!;
      const slug = slugify(company.name);
      const agentPath = path.join(__dirname, slug, 'agent-test.json');
      if (fs.existsSync(agentPath)) {
        try {
          const agentResult = JSON.parse(fs.readFileSync(agentPath, 'utf-8'));
          r.agentStatus = 'cached';
          r.agentQuestions = agentResult.summary?.totalQuestions || agentResult.conversations?.length || 0;
        } catch { /* ignore */ }
      } else {
        r.agentStatus = 'skipped';
      }
    }
  } else {
    await runAgentTests(COMPANIES, results, force);
  }

  // Phase 3: Comparisons
  runComparisons(COMPANIES, results);

  // Phase 4: Summary
  generateSummary(results);

  console.log('\n=== PIPELINE COMPLETE ===\n');
}

main().catch((err) => {
  console.error('Fatal orchestrator error:', err);
  process.exit(1);
});
