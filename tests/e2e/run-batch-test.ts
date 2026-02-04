#!/usr/bin/env npx ts-node

/**
 * Batch Test Runner for Constructor AI Simulator
 *
 * This script runs the Playwright tests for multiple companies and generates
 * a comprehensive report.
 *
 * Usage:
 *   npx ts-node tests/e2e/run-batch-test.ts [options]
 *
 * Options:
 *   --url <url>         Base URL (default: http://localhost:3000)
 *   --production        Use production URL
 *   --companies <n>     Number of companies to test (default: all)
 *   --headed            Run with browser visible
 *   --debug             Enable debug output
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const PRODUCTION_URL = 'https://constructor-ai-simulator.vercel.app';
const LOCAL_URL = 'http://localhost:3000';

interface RunOptions {
  baseUrl: string;
  headed: boolean;
  debug: boolean;
  companiesLimit?: number;
}

function parseArgs(): RunOptions {
  const args = process.argv.slice(2);
  const options: RunOptions = {
    baseUrl: LOCAL_URL,
    headed: false,
    debug: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--url':
        options.baseUrl = args[++i];
        break;
      case '--production':
        options.baseUrl = PRODUCTION_URL;
        break;
      case '--companies':
        const companiesArg = args[++i];
        if (companiesArg === undefined || isNaN(parseInt(companiesArg, 10))) {
          console.error('Error: --companies requires a valid number');
          process.exit(1);
        }
        options.companiesLimit = parseInt(companiesArg, 10);
        break;
      case '--headed':
        options.headed = true;
        break;
      case '--debug':
        options.debug = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Constructor AI Simulator - Batch Test Runner

Usage:
  npx ts-node tests/e2e/run-batch-test.ts [options]

Options:
  --url <url>         Base URL to test against
  --production        Use production URL (${PRODUCTION_URL})
  --companies <n>     Limit number of companies to test
  --headed            Run with browser visible
  --debug             Enable debug output
  --help              Show this help message

Examples:
  # Test locally with all companies
  npx ts-node tests/e2e/run-batch-test.ts

  # Test production with 3 companies
  npx ts-node tests/e2e/run-batch-test.ts --production --companies 3

  # Test with visible browser
  npx ts-node tests/e2e/run-batch-test.ts --headed
  `);
}

async function runTests(options: RunOptions): Promise<void> {
  console.log('='.repeat(60));
  console.log('Constructor AI Simulator - Batch Test Runner');
  console.log('='.repeat(60));
  console.log(`Base URL: ${options.baseUrl}`);
  console.log(`Headed: ${options.headed}`);
  console.log(`Debug: ${options.debug}`);
  if (options.companiesLimit) {
    console.log(`Companies Limit: ${options.companiesLimit}`);
  }
  console.log('='.repeat(60));

  // Build Playwright command
  const playwrightArgs = [
    'playwright',
    'test',
    '--config=tests/e2e/playwright.config.ts',
  ];

  if (options.headed) {
    playwrightArgs.push('--headed');
  }

  if (options.debug) {
    playwrightArgs.push('--debug');
  }

  // Set environment variables
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    BASE_URL: options.baseUrl,
  };

  if (options.companiesLimit) {
    env.COMPANIES_LIMIT = String(options.companiesLimit);
  }

  // Run Playwright
  console.log(`\nRunning: npx ${playwrightArgs.join(' ')}\n`);

  return new Promise((resolve, reject) => {
    const proc = spawn('npx', playwrightArgs, {
      cwd: process.cwd(),
      env,
      stdio: 'inherit',
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Tests failed with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

async function showLatestReport(): Promise<void> {
  const resultsDir = path.join(__dirname, 'results');

  if (!fs.existsSync(resultsDir)) {
    console.log('No results directory found');
    return;
  }

  // Find latest batch directory
  const dirs = fs.readdirSync(resultsDir)
    .filter(d => d.startsWith('batch-'))
    .sort()
    .reverse();

  if (dirs.length === 0) {
    console.log('No batch reports found');
    return;
  }

  const latestBatch = dirs[0];
  const reportPath = path.join(resultsDir, latestBatch, 'summary-report.json');

  if (!fs.existsSync(reportPath)) {
    console.log('Report file not found');
    return;
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

  console.log('\n' + '='.repeat(60));
  console.log('LATEST BATCH REPORT');
  console.log('='.repeat(60));
  console.log(`Batch ID: ${report.batchId}`);
  console.log(`Timestamp: ${report.timestamp}`);
  console.log('');
  console.log('SUMMARY:');
  console.log(`  Companies Tested: ${report.summary.companiesTested}`);
  console.log(`  Companies Passed: ${report.summary.companiesPassed}`);
  console.log(`  Pass Rate: ${report.summary.passRate}%`);
  console.log(`  Average Score: ${report.summary.averageScore}/100`);
  console.log('');

  if (report.summary.bestCompany) {
    console.log(`  Best: ${report.summary.bestCompany.name} (${report.summary.bestCompany.score})`);
  }
  if (report.summary.worstCompany) {
    console.log(`  Worst: ${report.summary.worstCompany.name} (${report.summary.worstCompany.score})`);
  }

  console.log('\nQUESTION STATS:');
  for (const q of report.questionStats) {
    const bar = '█'.repeat(Math.floor(q.averageScore / 10));
    console.log(`  ${q.questionId.padEnd(20)} ${bar} ${q.averageScore}%`);
  }

  console.log('\nRECOMMENDATIONS:');
  for (const rec of report.recommendations) {
    console.log(`  - ${rec}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Full report: ${reportPath}`);
  console.log(`Markdown report: ${path.join(resultsDir, latestBatch, 'REPORT.md')}`);
}

// Main execution
async function main() {
  const options = parseArgs();

  try {
    await runTests(options);
    console.log('\n✓ Tests completed successfully\n');
  } catch (error) {
    console.error('\n✗ Tests failed\n');
    await showLatestReport();
    process.exit(1);
  }

  await showLatestReport();
}

main().catch(console.error);
