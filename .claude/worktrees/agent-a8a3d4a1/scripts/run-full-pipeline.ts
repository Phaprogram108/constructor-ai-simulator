import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface PhaseResult {
  name: string;
  success: boolean;
  durationMs: number;
  skipped: boolean;
  error?: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const ROOT_DIR = path.resolve(__dirname, '..');
const GROUND_TRUTH_DIR = path.join(ROOT_DIR, 'ground-truth');

function parseArgs(argv: string[]): {
  skipGroundTruth: boolean;
  skipAgentTest: boolean;
  company: string | null;
} {
  const args = argv.slice(2);
  const skipGroundTruth = args.includes('--skip-ground-truth');
  const skipAgentTest = args.includes('--skip-agent-test');

  let company: string | null = null;
  const companyIdx = args.indexOf('--company');
  if (companyIdx !== -1 && companyIdx + 1 < args.length) {
    company = args[companyIdx + 1];
  }

  return { skipGroundTruth, skipAgentTest, company };
}

function checkGroundTruthDir(): boolean {
  return fs.existsSync(GROUND_TRUTH_DIR);
}

function checkServerRunning(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode !== undefined && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSec = seconds % 60;
  return `${minutes}m ${remainingSec}s`;
}

function printBanner(): void {
  console.log('');
  console.log('==========================================================');
  console.log('  Constructor AI Simulator - Full Diagnostic Pipeline');
  console.log('==========================================================');
  console.log('');
}

function printSummary(results: PhaseResult[], totalMs: number): void {
  console.log('');
  console.log('==========================================================');
  console.log('  Pipeline Summary');
  console.log('==========================================================');
  console.log('');

  const colName = 30;
  const colStatus = 12;
  const colDuration = 12;

  const header =
    'Phase'.padEnd(colName) +
    'Status'.padEnd(colStatus) +
    'Duration'.padEnd(colDuration);
  console.log(header);
  console.log('-'.repeat(colName + colStatus + colDuration));

  for (const r of results) {
    let status: string;
    if (r.skipped) {
      status = 'SKIPPED';
    } else if (r.success) {
      status = 'PASS';
    } else {
      status = 'FAIL';
    }

    const line =
      r.name.padEnd(colName) +
      status.padEnd(colStatus) +
      formatDuration(r.durationMs).padEnd(colDuration);
    console.log(line);
  }

  console.log('-'.repeat(colName + colStatus + colDuration));
  console.log(`Total: ${formatDuration(totalMs)}`);
  console.log('');

  const failed = results.filter((r) => !r.success && !r.skipped);
  if (failed.length > 0) {
    console.log(`${failed.length} phase(s) failed:`);
    for (const f of failed) {
      console.log(`  - ${f.name}: ${f.error || 'Unknown error'}`);
    }
    console.log('');
  } else {
    console.log('All phases completed successfully.');
    console.log('');
  }
}

// ─────────────────────────────────────────────
// Phase runner
// ─────────────────────────────────────────────

function runPhase(
  name: string,
  script: string,
  args: string[]
): Promise<PhaseResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();

    console.log('----------------------------------------------------------');
    console.log(`  Phase: ${name}`);
    console.log(`  Script: ${script} ${args.join(' ')}`);
    console.log('----------------------------------------------------------');
    console.log('');

    const scriptPath = path.join(ROOT_DIR, script);

    if (!fs.existsSync(scriptPath)) {
      const durationMs = Date.now() - startTime;
      console.error(`  ERROR: Script not found: ${scriptPath}`);
      console.log('');
      resolve({
        name,
        success: false,
        durationMs,
        skipped: false,
        error: `Script not found: ${script}`,
      });
      return;
    }

    const child: ChildProcess = spawn('npx', ['tsx', scriptPath, ...args], {
      cwd: ROOT_DIR,
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    child.stdout?.on('data', (data: Buffer) => {
      process.stdout.write(data);
    });

    child.stderr?.on('data', (data: Buffer) => {
      process.stderr.write(data);
    });

    child.on('error', (err) => {
      const durationMs = Date.now() - startTime;
      console.error(`  ERROR spawning process: ${err.message}`);
      console.log('');
      resolve({
        name,
        success: false,
        durationMs,
        skipped: false,
        error: err.message,
      });
    });

    child.on('close', (code) => {
      const durationMs = Date.now() - startTime;
      console.log('');
      console.log(
        `  Phase "${name}" finished with exit code ${code} in ${formatDuration(durationMs)}`
      );
      console.log('');

      resolve({
        name,
        success: code === 0,
        durationMs,
        skipped: false,
        error: code !== 0 ? `Exit code ${code}` : undefined,
      });
    });
  });
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main(): Promise<void> {
  const pipelineStart = Date.now();
  const { skipGroundTruth, skipAgentTest, company } = parseArgs(process.argv);

  printBanner();

  // Show config
  console.log('Configuration:');
  if (company) console.log(`  Company: ${company}`);
  if (skipGroundTruth) console.log('  Skipping: Ground Truth Capture');
  if (skipAgentTest) console.log('  Skipping: Agent Testing');
  console.log('');

  // Build extra args to pass through
  const extraArgs: string[] = [];
  if (company) extraArgs.push('--company', company);

  // ── Prerequisites ──

  console.log('Checking prerequisites...');

  if (!skipGroundTruth) {
    // ground-truth dir is created by Phase 1, no need to check beforehand
    console.log('  Ground truth directory will be created by Phase 1.');
  } else {
    if (!checkGroundTruthDir()) {
      console.warn(
        '  WARNING: ground-truth/ directory does not exist. Phase 2 and 3 may fail.'
      );
    } else {
      console.log('  Ground truth directory exists (reusing existing data).');
    }
  }

  if (!skipAgentTest) {
    const serverUp = await checkServerRunning('http://localhost:3000');
    if (!serverUp) {
      console.warn(
        '  WARNING: Server at localhost:3000 is not responding. Agent Testing may fail.'
      );
      console.warn('  Hint: Run "npm run dev" in another terminal first.');
    } else {
      console.log('  Server at localhost:3000 is running.');
    }
  }

  console.log('');

  // ── Run Phases ──

  const results: PhaseResult[] = [];

  // Phase 1: Ground Truth Capture
  if (skipGroundTruth) {
    results.push({
      name: 'Ground Truth Capture',
      success: true,
      durationMs: 0,
      skipped: true,
    });
  } else {
    const result = await runPhase(
      'Ground Truth Capture',
      'scripts/ground-truth-capture.ts',
      extraArgs
    );
    results.push(result);
  }

  // Phase 2: Agent Testing
  if (skipAgentTest) {
    results.push({
      name: 'Agent Testing',
      success: true,
      durationMs: 0,
      skipped: true,
    });
  } else {
    const result = await runPhase(
      'Agent Testing',
      'scripts/agent-test.ts',
      extraArgs
    );
    results.push(result);
  }

  // Phase 3: Diagnosis (always runs)
  const diagnosisResult = await runPhase(
    'Diagnosis',
    'scripts/diagnosis.ts',
    extraArgs
  );
  results.push(diagnosisResult);

  // ── Summary ──

  const totalMs = Date.now() - pipelineStart;
  printSummary(results, totalMs);

  // Exit with error code if any phase failed
  const anyFailed = results.some((r) => !r.success && !r.skipped);
  process.exit(anyFailed ? 1 : 0);
}

main().catch((err) => {
  console.error('Pipeline crashed:', err);
  process.exit(1);
});
