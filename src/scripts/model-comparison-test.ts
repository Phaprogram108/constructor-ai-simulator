/**
 * Model Comparison Test Script
 *
 * Compares GPT-5 family models (nano, mini, 5.1) to find the quality/cost
 * sweet spot for the construction company AI chatbot.
 *
 * Requires the local dev server running (npm run dev) to create sessions
 * and obtain system prompts.
 *
 * Run: npx tsx src/scripts/model-comparison-test.ts
 * Output: src/scripts/model-comparison-results.json
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';

// Load env from .env.local
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

// ============================================
// CONFIG
// ============================================

const API_BASE = 'http://localhost:3000';
const SESSION_TIMEOUT_MS = 120_000;
const CHAT_TIMEOUT_MS = 60_000;
const DELAY_BETWEEN_QUESTIONS_MS = 1_500;
const DELAY_BETWEEN_COMPANIES_MS = 3_000;

const GROUND_TRUTH_DIR = path.resolve(__dirname, '../../ground-truth');
const OUTPUT_FILE = path.resolve(__dirname, 'model-comparison-results.json');

const COMPANIES = ['habika', 'importainer', 'lucys-house', 'vibert'];

interface ModelConfig {
  id: string;
  inputPricePer1M: number;
  cachedInputPricePer1M: number;
  outputPricePer1M: number;
  temperature?: number; // Some models only support temperature=1
}

const MODELS: ModelConfig[] = [
  { id: 'gpt-5-nano', inputPricePer1M: 0.05, cachedInputPricePer1M: 0.005, outputPricePer1M: 0.40, temperature: 1 },
  { id: 'gpt-5-mini', inputPricePer1M: 0.25, cachedInputPricePer1M: 0.025, outputPricePer1M: 2.00, temperature: 1 },
  { id: 'gpt-5.1', inputPricePer1M: 1.25, cachedInputPricePer1M: 0.125, outputPricePer1M: 10.00 },
];

// Production params (from src/app/api/chat/route.ts)
const MAX_COMPLETION_TOKENS = 600;
const TEMPERATURE = 0.7;

// ============================================
// TYPES
// ============================================

interface AgentTestFile {
  company: string;
  url: string;
  conversations: {
    question: string;
    questionType: string;
    response: string;
  }[];
}

interface ModelResult {
  response: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  cost: number;
  latencyMs: number;
  error?: string;
}

interface QuestionResult {
  company: string;
  question: string;
  questionType: string;
  expectedAnswer: string;
  models: Record<string, ModelResult>;
}

interface ModelSummary {
  avgLatencyMs: number;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedInputTokens: number;
  successCount: number;
  errorCount: number;
}

interface ComparisonResults {
  timestamp: string;
  config: {
    maxCompletionTokens: number;
    temperature: number;
    models: string[];
    companies: string[];
  };
  results: QuestionResult[];
  summary: Record<string, ModelSummary>;
}

// ============================================
// HELPERS
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateCost(model: ModelConfig, inputTokens: number, outputTokens: number, cachedInputTokens: number): number {
  const uncachedInputTokens = inputTokens - cachedInputTokens;
  const inputCost = (uncachedInputTokens / 1_000_000) * model.inputPricePer1M;
  const cachedCost = (cachedInputTokens / 1_000_000) * model.cachedInputPricePer1M;
  const outputCost = (outputTokens / 1_000_000) * model.outputPricePer1M;
  return inputCost + cachedCost + outputCost;
}

function loadGroundTruth(companySlug: string): AgentTestFile | null {
  const filePath = path.join(GROUND_TRUTH_DIR, companySlug, 'agent-test.json');
  if (!fs.existsSync(filePath)) {
    console.error(`  [ERROR] Ground truth not found: ${filePath}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

async function createSession(websiteUrl: string): Promise<{ sessionId: string; systemPrompt: string } | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SESSION_TIMEOUT_MS);

    const res = await fetch(`${API_BASE}/api/simulator/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ websiteUrl }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const body = await res.text();
      console.error(`  [ERROR] Session creation failed (${res.status}): ${body}`);
      return null;
    }

    const data = await res.json();
    return { sessionId: data.sessionId, systemPrompt: data.systemPrompt };
  } catch (err) {
    console.error(`  [ERROR] Session creation error:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ============================================
// MAIN TEST LOGIC
// ============================================

async function testQuestion(
  openai: OpenAI,
  model: ModelConfig,
  systemPrompt: string,
  question: string,
): Promise<ModelResult> {
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);

    const completion = await openai.chat.completions.create(
      {
        model: model.id,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        temperature: model.temperature ?? TEMPERATURE,
      },
      { signal: controller.signal },
    );

    clearTimeout(timeoutId);

    const latencyMs = Date.now() - start;
    const response = completion.choices[0]?.message?.content || '';
    const usage = completion.usage;

    const inputTokens = usage?.prompt_tokens || 0;
    const outputTokens = usage?.completion_tokens || 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usageAny = usage as any;
    const cachedInputTokens = usageAny?.prompt_tokens_details?.cached_tokens || 0;

    const cost = calculateCost(model, inputTokens, outputTokens, cachedInputTokens);

    return { response, inputTokens, outputTokens, cachedInputTokens, cost, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`    [ERROR] ${model.id}: ${errorMsg}`);
    return {
      response: '',
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      cost: 0,
      latencyMs,
      error: errorMsg,
    };
  }
}

async function runCompanyTest(
  openai: OpenAI,
  companySlug: string,
  groundTruth: AgentTestFile,
  systemPrompt: string,
): Promise<QuestionResult[]> {
  const results: QuestionResult[] = [];

  for (let qi = 0; qi < groundTruth.conversations.length; qi++) {
    const conv = groundTruth.conversations[qi];
    console.log(`    [${qi + 1}/${groundTruth.conversations.length}] "${conv.question.slice(0, 60)}..."`);

    const modelResults: Record<string, ModelResult> = {};

    for (const model of MODELS) {
      process.stdout.write(`      ${model.id}... `);
      const result = await testQuestion(openai, model, systemPrompt, conv.question);
      modelResults[model.id] = result;

      if (result.error) {
        console.log(`ERROR (${result.latencyMs}ms)`);
      } else {
        console.log(`OK ${result.latencyMs}ms, $${result.cost.toFixed(6)}, ${result.outputTokens} out tokens`);
      }

      // Small delay between model calls to avoid rate limits
      await sleep(500);
    }

    results.push({
      company: groundTruth.company,
      question: conv.question,
      questionType: conv.questionType,
      expectedAnswer: conv.response,
      models: modelResults,
    });

    if (qi < groundTruth.conversations.length - 1) {
      await sleep(DELAY_BETWEEN_QUESTIONS_MS);
    }
  }

  return results;
}

function buildSummary(results: QuestionResult[]): Record<string, ModelSummary> {
  const summary: Record<string, ModelSummary> = {};

  for (const model of MODELS) {
    const modelResults = results.map(r => r.models[model.id]).filter(Boolean);
    const successful = modelResults.filter(r => !r.error);
    const errors = modelResults.filter(r => r.error);

    summary[model.id] = {
      avgLatencyMs: successful.length > 0
        ? Math.round(successful.reduce((sum, r) => sum + r.latencyMs, 0) / successful.length)
        : 0,
      totalCost: modelResults.reduce((sum, r) => sum + r.cost, 0),
      totalInputTokens: modelResults.reduce((sum, r) => sum + r.inputTokens, 0),
      totalOutputTokens: modelResults.reduce((sum, r) => sum + r.outputTokens, 0),
      totalCachedInputTokens: modelResults.reduce((sum, r) => sum + r.cachedInputTokens, 0),
      successCount: successful.length,
      errorCount: errors.length,
    };
  }

  return summary;
}

function printSummaryTable(summary: Record<string, ModelSummary>): void {
  console.log('\n' + '='.repeat(100));
  console.log('MODEL COMPARISON SUMMARY');
  console.log('='.repeat(100));

  const headers = ['Model', 'Avg Latency', 'Total Cost', 'Input Tokens', 'Output Tokens', 'Cached', 'OK', 'Errors'];
  const widths = [14, 12, 12, 14, 14, 10, 5, 7];

  console.log(headers.map((h, i) => h.padEnd(widths[i])).join(' | '));
  console.log(widths.map(w => '-'.repeat(w)).join('-+-'));

  for (const model of MODELS) {
    const s = summary[model.id];
    const row = [
      model.id.padEnd(widths[0]),
      `${s.avgLatencyMs}ms`.padEnd(widths[1]),
      `$${s.totalCost.toFixed(4)}`.padEnd(widths[2]),
      s.totalInputTokens.toLocaleString().padEnd(widths[3]),
      s.totalOutputTokens.toLocaleString().padEnd(widths[4]),
      s.totalCachedInputTokens.toLocaleString().padEnd(widths[5]),
      String(s.successCount).padEnd(widths[6]),
      String(s.errorCount).padEnd(widths[7]),
    ];
    console.log(row.join(' | '));
  }

  console.log('='.repeat(100));

  // Cost comparison
  const baseModel = summary[MODELS[0].id];
  if (baseModel.totalCost > 0) {
    console.log('\nCost relative to gpt-5-nano:');
    for (const model of MODELS) {
      const ratio = summary[model.id].totalCost / baseModel.totalCost;
      console.log(`  ${model.id}: ${ratio.toFixed(1)}x`);
    }
  }
}

// ============================================
// MAIN
// ============================================

async function main(): Promise<void> {
  console.log('Model Comparison Test');
  console.log('=====================');
  console.log(`Models: ${MODELS.map(m => m.id).join(', ')}`);
  console.log(`Companies: ${COMPANIES.join(', ')}`);
  console.log(`Production params: max_tokens=${MAX_COMPLETION_TOKENS}, temperature=${TEMPERATURE}`);
  console.log('');

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not found in environment or .env.local');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const allResults: QuestionResult[] = [];

  for (let ci = 0; ci < COMPANIES.length; ci++) {
    const companySlug = COMPANIES[ci];
    console.log(`\n[${ ci + 1}/${COMPANIES.length}] Company: ${companySlug}`);
    console.log('-'.repeat(50));

    // Load ground truth
    const groundTruth = loadGroundTruth(companySlug);
    if (!groundTruth) {
      console.log('  Skipping (no ground truth)');
      continue;
    }

    console.log(`  URL: ${groundTruth.url}`);
    console.log(`  Questions: ${groundTruth.conversations.length}`);

    // Create session to get system prompt
    console.log('  Creating session to obtain system prompt...');
    const session = await createSession(groundTruth.url);
    if (!session) {
      console.log('  Skipping (session creation failed)');
      continue;
    }
    console.log(`  Session created: ${session.sessionId}`);
    console.log(`  System prompt length: ${session.systemPrompt.length} chars`);

    // Test all questions
    console.log('  Running model comparisons...');
    const companyResults = await runCompanyTest(openai, companySlug, groundTruth, session.systemPrompt);
    allResults.push(...companyResults);

    if (ci < COMPANIES.length - 1) {
      console.log(`  Waiting ${DELAY_BETWEEN_COMPANIES_MS / 1000}s before next company...`);
      await sleep(DELAY_BETWEEN_COMPANIES_MS);
    }
  }

  // Build summary
  const summary = buildSummary(allResults);

  // Save results
  const output: ComparisonResults = {
    timestamp: new Date().toISOString(),
    config: {
      maxCompletionTokens: MAX_COMPLETION_TOKENS,
      temperature: TEMPERATURE,
      models: MODELS.map(m => m.id),
      companies: COMPANIES,
    },
    results: allResults,
    summary,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nResults saved to: ${OUTPUT_FILE}`);

  // Print summary table
  printSummaryTable(summary);

  console.log(`\nTotal questions tested: ${allResults.length}`);
  console.log(`Total API calls: ${allResults.length * MODELS.length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
