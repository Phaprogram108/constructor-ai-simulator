/**
 * Agent Test Script
 *
 * Tests the AI agent by creating sessions and asking questions informed by
 * ground truth data. Outputs structured results per company for comparison.
 *
 * Usage:
 *   npx tsx scripts/agent-test.ts                    # Test all 20 companies
 *   npx tsx scripts/agent-test.ts --company Habika   # Test single company
 *   npx tsx scripts/agent-test.ts --skip-session      # Reuse existing sessions
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_BASE = 'http://localhost:3000';
const PROJECT_ROOT = path.resolve(__dirname, '..');
const GROUND_TRUTH_DIR = path.join(PROJECT_ROOT, 'ground-truth');
const COMPANIES_FILE = path.join(PROJECT_ROOT, 'src', 'scripts', 'test-companies.json');

const DELAY_BETWEEN_COMPANIES_MS = 5_000;
const DELAY_BETWEEN_QUESTIONS_MS = 2_000;
const SESSION_TIMEOUT_MS = 120_000;
const CHAT_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompanyEntry {
  name: string;
  url: string;
  knownIssue?: string;
  expectedModels?: string[];
  notes?: string;
}

interface CompaniesFile {
  companies: {
    problematicas: CompanyEntry[];
    aleatorias: CompanyEntry[];
  };
}

interface GroundTruth {
  models?: { name: string; [key: string]: unknown }[];
  whatsapp?: string;
  financing?: string;
  [key: string]: unknown;
}

interface SessionResponse {
  sessionId: string;
  companyName: string;
  welcomeMessage: string;
  messagesRemaining: number;
  systemPrompt: string;
  error?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ConversationEntry {
  question: string;
  questionType: QuestionType;
  response: string;
  mentionedModels: string[];
  saidNoInfo: boolean;
  hasSpecificData: boolean;
  responseTimeMs: number;
}

interface AgentTestResult {
  company: string;
  url: string;
  testedAt: string;
  sessionId: string;
  systemPromptLength: number;
  systemPromptModelsFound: string[];
  systemPromptWhatsApp?: string;
  systemPromptType?: string;
  conversations: ConversationEntry[];
  sessionCreationTimeMs: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function extractModelsFromPrompt(prompt: string): string[] {
  // Try to find product/model section - expand patterns to match new format
  // Match any section ending in "DISPONIBLES" (may have commas, mixed words)
  const productSection = prompt.match(
    /## [A-ZÁÉÍÓÚÑ,\s]+ DISPONIBLES[\s\S]*?(?=\n##[^#]|$)/i
  ) || prompt.match(
    /## (?:MODELOS|PRODUCTOS|TIPOLOGIAS|PROYECTOS|UNIDADES|SERVICIOS|CATALOGO)[^\n]*[\s\S]*?(?=\n##[^#]|$)/i
  );
  if (!productSection) return [];

  const section = productSection[0];
  const models: string[] = [];

  // Pattern 1: Numbered headings "### 1. ProductName" or "### 2. ProductName" (FORMATO V4)
  const numberedMatches = section.matchAll(/###\s+\d+\.\s+(.+?)(?:\n|$)/gi);
  for (const m of numberedMatches) {
    const name = m[1].trim();
    if (name && name.length > 0 && name.length < 80) {
      models.push(name);
    }
  }

  // Pattern 2: Unnumbered headings "### ProductName" (FORMATO V4 sin numero)
  if (models.length === 0) {
    const unnumberedMatches = section.matchAll(/###\s+([A-ZÁÉÍÓÚÑ][^\n]{1,79})(?:\n|$)/gi);
    for (const m of unnumberedMatches) {
      const name = m[1].trim();
      // Skip if it starts with a number (already captured)
      if (name && !name.match(/^\d+\./) && name.length < 80) {
        models.push(name);
      }
    }
  }

  // Pattern 3: Traditional "### Modelo: XXX" or "### Casa XXX" headings
  if (models.length === 0) {
    const headingMatches = section.match(
      /### (?:Modelo|Casa|Vivienda|Proyecto|Producto|Unidad|Servicio)[:\s]+(.+)/gi
    ) || [];
    for (const m of headingMatches) {
      const name = m.replace(/^###\s*(?:Modelo|Casa|Vivienda|Proyecto|Producto|Unidad|Servicio)[:\s]+/i, '').trim();
      if (name) models.push(name);
    }
  }

  // Pattern 4: Bold list items "- **ProductName**:" or "- **ProductName** -"
  if (models.length === 0) {
    const boldListMatches = section.match(/^- \*\*(.+?)\*\*[:\-]?/gm) || [];
    for (const m of boldListMatches) {
      const nameMatch = m.match(/^- \*\*(.+?)\*\*/);
      if (nameMatch) {
        const name = nameMatch[1].trim();
        if (name && name.length > 0 && name.length < 80) {
          models.push(name);
        }
      }
    }
  }

  // Pattern 5: List items "- ModelName: details" or "- ModelName (details)"
  if (models.length === 0) {
    const listMatches = section.match(/^- .+/gm) || [];
    for (const line of listMatches) {
      // Extract the first meaningful part of the list item (model name)
      const cleaned = line.replace(/^- /, '').replace(/\*\*/g, '');
      // Take text before first colon, pipe, or long description
      const nameMatch = cleaned.match(/^([^:|(\n]{2,50})/);
      if (nameMatch) {
        const name = nameMatch[1].trim();
        // Skip generic phrases
        if (name && !name.match(/^(No se encontraron|IMPORTANTE|ANTES|SOLO|La informacion|Incluye)/i)) {
          models.push(name);
        }
      }
    }
  }

  return models;
}

function extractWhatsAppFromPrompt(prompt: string): string | undefined {
  const match = prompt.match(
    /(?:whatsapp|wa\.me|tel)[:\s]*\+?[\d\s\-().]{8,}/i
  );
  if (!match) return undefined;
  const digits = match[0].replace(/[^\d+]/g, '');
  return digits.length >= 8 ? digits : undefined;
}

function extractTypeFromPrompt(prompt: string): string | undefined {
  const tipoMatch = prompt.match(/TIPO[:\s]+(.+)/i);
  if (tipoMatch) return tipoMatch[1].trim();

  const keywords: Record<string, string> = {
    modular: 'modular',
    industrializada: 'industrializada',
    prefabricada: 'prefabricada',
    tradicional: 'tradicional',
    'steel frame': 'steel frame',
    container: 'container',
  };

  const lower = prompt.toLowerCase();
  for (const [keyword, type] of Object.entries(keywords)) {
    if (lower.includes(keyword)) return type;
  }

  return undefined;
}

const noInfoPhrases = [
  'no tengo esa informacion',
  'no cuento con',
  'no tengo cargad',
  'no dispongo',
  'te recomiendo contactar',
  'no tengo datos',
  'no tengo los precios',
  'no tengo informacion',
];

function detectNoInfo(response: string): boolean {
  const lower = response.toLowerCase();
  return noInfoPhrases.some(phrase => lower.includes(phrase));
}

function detectSpecificData(response: string): boolean {
  // Look for numbers followed by measurement units, currency, or percentages
  return /\d+\s*(m2|m²|metros|usd|us\$|\$|ars|cuotas|%|dormitorio|ambiente)/i.test(
    response
  );
}

function detectMentionedModels(
  response: string,
  knownModels: string[]
): string[] {
  const found: string[] = [];
  const lower = response.toLowerCase();

  for (const model of knownModels) {
    if (lower.includes(model.toLowerCase())) {
      found.push(model);
    }
  }

  // Also try to detect model names from patterns like "modelo X", "casa Y"
  // Use strict regex: name must start with uppercase and be short (max ~40 chars)
  const patterns = response.match(
    /(?:modelo|casa|vivienda|proyecto)\s+["']?([A-Z][A-Za-z0-9\s+-]{1,40})(?=[.,;:!?\s"']|$)/g
  ) || [];

  for (const p of patterns) {
    const name = p
      .replace(/^(?:modelo|casa|vivienda|proyecto)\s+["']?/i, '')
      .replace(/[.,;:!?"'\s]+$/, '')
      .trim();
    // Only add if it looks like a proper model name (short, no full sentences)
    if (name.length > 1 && name.length < 40 && !name.includes(' es ') && !name.includes(' en ') && !found.includes(name)) {
      found.push(name);
    }
  }

  return found;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

async function checkServerRunning(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(
      API_BASE,
      { method: 'HEAD' },
      5_000
    );
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

async function createSession(websiteUrl: string): Promise<SessionResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/simulator/create`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ websiteUrl }),
    },
    SESSION_TIMEOUT_MS
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Session creation failed (${response.status}): ${text}`);
  }

  return response.json();
}

async function sendChat(
  sessionId: string,
  systemPrompt: string,
  message: string,
  conversationHistory: ChatMessage[],
  companyName: string
): Promise<string> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        message,
        systemPrompt,
        conversationHistory,
        companyName,
      }),
    },
    CHAT_TIMEOUT_MS
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Chat failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  return data.message || '[Sin respuesta]';
}

// ---------------------------------------------------------------------------
// Question generation
// ---------------------------------------------------------------------------

type QuestionType =
  | 'identity'          // Qué es la empresa
  | 'offering'          // Qué ofrece
  | 'contact'           // Contacto
  | 'product_count'     // Cuántos productos tiene
  | 'product_specific'  // Sobre un producto específico
  | 'product_specs'     // Specs de un producto
  | 'financing'         // Financiación
  | 'coverage'          // Cobertura geográfica
  | 'differentiator'    // Qué los diferencia
  | 'process'           // Proceso de construcción
  | 'customization';    // Personalización

interface Question {
  text: string;
  type: QuestionType;
}

/**
 * Infer product terminology from prompt models list
 */
function inferProductLabel(promptModels: string[]): string {
  const joined = promptModels.join(' ').toLowerCase();

  if (/cabin/i.test(joined)) return 'cabañas';
  if (/m[oó]dulo/i.test(joined)) return 'módulos';
  if (/proyecto/i.test(joined)) return 'proyectos';
  if (/unidad|departamento|depto/i.test(joined)) return 'unidades';
  if (/lote|terreno/i.test(joined)) return 'lotes';
  if (/tipolog[ií]a/i.test(joined)) return 'tipologías';
  if (/servicio/i.test(joined)) return 'servicios';
  if (/casa|vivienda/i.test(joined)) return 'modelos de casas';

  return 'modelos';
}

/**
 * Check if ground truth mentions financing
 */
function hasFinancingMention(groundTruth: GroundTruth): boolean {
  const rawStr = JSON.stringify(groundTruth).toLowerCase();
  return rawStr.includes('financi') || rawStr.includes('cuota') || rawStr.includes('plan de pago');
}

/**
 * Pick up to 2 models with descriptive names (not codes like "CM0" or single letters).
 * Prefers models with spaces or longer names. Deterministic: takes first 2 valid ones.
 */
function pickBestModels(models: string[], count: number): string[] {
  // Separate descriptive names from code-like names
  const descriptive = models.filter(m =>
    m.length > 3 && /[a-záéíóúñ\s]/i.test(m) && !/^\w{1,3}\d*$/.test(m)
  );
  const rest = models.filter(m => !descriptive.includes(m));

  const picked: string[] = [];
  for (const m of [...descriptive, ...rest]) {
    if (picked.length >= count) break;
    picked.push(m);
  }
  return picked;
}

/**
 * Generate dynamic questions based on prompt models and ground truth context.
 * Uses prompt models (what the scraper found) for product-specific questions,
 * NOT ground truth models (which may differ from what the agent knows).
 */
function generateQuestions(
  groundTruth: GroundTruth | null,
  promptModels: string[],
  promptHasFinancing: boolean
): Question[] {
  const questions: Question[] = [];

  // 1. Universal questions (ALWAYS ask these)
  questions.push(
    { text: '¿Qué es tu empresa y qué hacen?', type: 'identity' },
    { text: '¿Qué productos o servicios ofrecen?', type: 'offering' },
    { text: '¿Cuál es su WhatsApp o teléfono de contacto?', type: 'contact' },
  );

  // 2. Product questions based on what the PROMPT actually has
  if (promptModels.length > 0) {
    const label = inferProductLabel(promptModels);

    questions.push({
      text: `¿Cuántos ${label} ofrecen?`,
      type: 'product_count',
    });

    // Pick up to 2 descriptive models
    const modelsToAsk = pickBestModels(promptModels, 2);
    for (const modelName of modelsToAsk) {
      questions.push({
        text: `Contame sobre ${modelName}`,
        type: 'product_specific',
      });
      questions.push({
        text: `¿Cuáles son los detalles técnicos de ${modelName}? Superficie, dormitorios, características.`,
        type: 'product_specs',
      });
    }

    // Process and customization questions
    questions.push({
      text: '¿Cuál es el proceso de construcción y cuánto demoran?',
      type: 'process',
    });
    questions.push({
      text: `¿Se pueden personalizar los ${label}?`,
      type: 'customization',
    });
  }

  // 3. Financing: check prompt OR ground truth
  const gtHasFinancing = groundTruth ? hasFinancingMention(groundTruth) : false;
  if (promptHasFinancing || gtHasFinancing || groundTruth?.financing) {
    questions.push({
      text: '¿Tienen financiamiento o planes de pago?',
      type: 'financing',
    });
  }

  // 4. General quality questions (ALWAYS ask)
  questions.push({
    text: '¿Qué los diferencia de otras empresas similares?',
    type: 'differentiator',
  });
  questions.push({
    text: '¿A qué zonas o regiones llegan?',
    type: 'coverage',
  });

  return questions;
}

// ---------------------------------------------------------------------------
// Core test logic
// ---------------------------------------------------------------------------

async function testCompany(
  company: CompanyEntry,
  skipSession: boolean
): Promise<AgentTestResult> {
  const slug = slugify(company.name);
  const companyDir = path.join(GROUND_TRUTH_DIR, slug);
  const resultPath = path.join(companyDir, 'agent-test.json');
  const groundTruthPath = path.join(companyDir, 'ground-truth.json');

  const errors: string[] = [];

  // Load ground truth if available
  let groundTruth: GroundTruth | null = null;
  if (fs.existsSync(groundTruthPath)) {
    try {
      groundTruth = JSON.parse(fs.readFileSync(groundTruthPath, 'utf-8'));
      console.log(`  Ground truth loaded (${groundTruthPath})`);
    } catch (err) {
      const msg = `Failed to parse ground truth: ${err}`;
      console.warn(`  ${msg}`);
      errors.push(msg);
    }
  } else {
    console.log('  No ground truth file found, using generic questions');
  }

  // Session: create or reuse
  let sessionId: string;
  let systemPrompt: string;
  let companyName: string;
  let sessionCreationTimeMs: number;

  if (skipSession && fs.existsSync(resultPath)) {
    const existing: AgentTestResult = JSON.parse(
      fs.readFileSync(resultPath, 'utf-8')
    );
    if (existing.sessionId) {
      console.log(`  Reusing existing session: ${existing.sessionId}`);
      sessionId = existing.sessionId;
      systemPrompt = ''; // Will need to re-create if empty
      companyName = existing.company;
      sessionCreationTimeMs = existing.sessionCreationTimeMs;

      // We still need the systemPrompt for chat calls - must create new session
      if (!systemPrompt) {
        console.log('  No systemPrompt cached, creating new session anyway');
      }
    }
  }

  // @ts-ignore - variables may be assigned in the block above
  if (!sessionId) {
    console.log(`  Creating session for ${company.url}...`);
    const startSession = Date.now();

    try {
      const session = await createSession(company.url);
      sessionCreationTimeMs = Date.now() - startSession;
      sessionId = session.sessionId;
      systemPrompt = session.systemPrompt;
      companyName = session.companyName;

      console.log(`  Session created in ${sessionCreationTimeMs}ms`);
      console.log(`  Session ID: ${sessionId}`);
      console.log(`  Company name: ${companyName}`);
      console.log(`  System prompt length: ${systemPrompt.length} chars`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAILED to create session: ${msg}`);
      errors.push(`Session creation failed: ${msg}`);

      return {
        company: company.name,
        url: company.url,
        testedAt: new Date().toISOString(),
        sessionId: '',
        systemPromptLength: 0,
        systemPromptModelsFound: [],
        conversations: [],
        sessionCreationTimeMs: Date.now() - startSession,
        errors,
      };
    }
  }

  // Parse system prompt
  const promptModels = extractModelsFromPrompt(systemPrompt!);
  const promptWhatsApp = extractWhatsAppFromPrompt(systemPrompt!);
  const promptType = extractTypeFromPrompt(systemPrompt!);

  if (promptModels.length > 0) {
    console.log(`  Models in prompt: ${promptModels.join(', ')}`);
  }
  if (promptWhatsApp) {
    console.log(`  WhatsApp in prompt: ${promptWhatsApp}`);
  }
  if (promptType) {
    console.log(`  Type in prompt: ${promptType}`);
  }

  // Build the list of known model names for detection
  const knownModels = [
    ...promptModels,
    ...(groundTruth?.models?.map(m => m.name) || []),
    ...(company.expectedModels || []),
  ];
  const uniqueModels = Array.from(new Set(knownModels));

  // Generate questions from prompt models (not ground truth models)
  const promptHasFinancing = /financi|cuota|plan de pago/i.test(systemPrompt!);
  const questions = generateQuestions(groundTruth, promptModels, promptHasFinancing);
  console.log(`  Will ask ${questions.length} questions`);

  // Ask questions
  const conversations: ConversationEntry[] = [];
  const chatHistory: ChatMessage[] = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`\n  [${i + 1}/${questions.length}] ${q.text}`);

    const startChat = Date.now();

    try {
      chatHistory.push({ role: 'user', content: q.text });

      const response = await sendChat(
        sessionId!,
        systemPrompt!,
        q.text,
        chatHistory.slice(0, -1),
        companyName!
      );

      const responseTimeMs = Date.now() - startChat;

      chatHistory.push({ role: 'assistant', content: response });

      const mentioned = detectMentionedModels(response, uniqueModels);
      const noInfo = detectNoInfo(response);
      const specificData = detectSpecificData(response);

      conversations.push({
        question: q.text,
        questionType: q.type,
        response,
        mentionedModels: mentioned,
        saidNoInfo: noInfo,
        hasSpecificData: specificData,
        responseTimeMs,
      });

      const preview = response.substring(0, 120).replace(/\n/g, ' ');
      console.log(`    ${responseTimeMs}ms | noInfo=${noInfo} | specific=${specificData} | models=[${mentioned.join(',')}]`);
      console.log(`    "${preview}..."`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`    ERROR: ${msg}`);
      errors.push(`Question "${q.text}": ${msg}`);

      // Remove the user message we added
      chatHistory.pop();

      conversations.push({
        question: q.text,
        questionType: q.type,
        response: '',
        mentionedModels: [],
        saidNoInfo: false,
        hasSpecificData: false,
        responseTimeMs: Date.now() - startChat,
      });
    }

    // Delay between questions
    if (i < questions.length - 1) {
      await sleep(DELAY_BETWEEN_QUESTIONS_MS);
    }
  }

  const result: AgentTestResult = {
    company: company.name,
    url: company.url,
    testedAt: new Date().toISOString(),
    sessionId: sessionId!,
    systemPromptLength: systemPrompt!.length,
    systemPromptModelsFound: promptModels,
    systemPromptWhatsApp: promptWhatsApp,
    systemPromptType: promptType,
    conversations,
    sessionCreationTimeMs: sessionCreationTimeMs!,
    errors,
  };

  // Save result
  if (!fs.existsSync(companyDir)) {
    fs.mkdirSync(companyDir, { recursive: true });
  }
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log(`\n  Saved: ${resultPath}`);

  return result;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(): { companyFilter?: string; skipSession: boolean } {
  const args = process.argv.slice(2);
  let companyFilter: string | undefined;
  let skipSession = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--company' && args[i + 1]) {
      companyFilter = args[i + 1];
      i++;
    } else if (args[i] === '--skip-session') {
      skipSession = true;
    }
  }

  return { companyFilter, skipSession };
}

function loadCompanies(): CompanyEntry[] {
  const raw: CompaniesFile = JSON.parse(
    fs.readFileSync(COMPANIES_FILE, 'utf-8')
  );
  return [
    ...raw.companies.problematicas,
    ...raw.companies.aleatorias,
  ];
}

async function main(): Promise<void> {
  const { companyFilter, skipSession } = parseArgs();
  const allCompanies = loadCompanies();

  let companies = allCompanies;
  if (companyFilter) {
    const filter = companyFilter.toLowerCase();
    companies = allCompanies.filter(c =>
      c.name.toLowerCase().includes(filter)
    );
    if (companies.length === 0) {
      console.error(`No company matching: "${companyFilter}"`);
      console.log(
        'Available:',
        allCompanies.map(c => c.name).join(', ')
      );
      process.exit(1);
    }
  }

  console.log('='.repeat(60));
  console.log('AGENT TEST');
  console.log(`Companies: ${companies.length}`);
  console.log(`Skip session: ${skipSession}`);
  console.log(`Output: ${GROUND_TRUTH_DIR}/{slug}/agent-test.json`);
  console.log('='.repeat(60));

  // Verify server
  console.log('\nChecking server at ' + API_BASE + '...');
  const serverOk = await checkServerRunning();
  if (!serverOk) {
    console.error('Server is not running at ' + API_BASE);
    console.error('Start it with: npm run dev');
    process.exit(1);
  }
  console.log('Server is running.\n');

  // Ensure output dir
  if (!fs.existsSync(GROUND_TRUTH_DIR)) {
    fs.mkdirSync(GROUND_TRUTH_DIR, { recursive: true });
  }

  const results: AgentTestResult[] = [];

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${i + 1}/${companies.length}] ${company.name}`);
    console.log(`URL: ${company.url}`);
    if (company.knownIssue) {
      console.log(`Known issue: ${company.knownIssue}`);
    }
    console.log('='.repeat(60));

    const result = await testCompany(company, skipSession);
    results.push(result);

    // Delay between companies
    if (i < companies.length - 1) {
      console.log(`\nWaiting ${DELAY_BETWEEN_COMPANIES_MS / 1000}s before next company...`);
      await sleep(DELAY_BETWEEN_COMPANIES_MS);
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log('='.repeat(60));

  let totalQuestions = 0;
  let totalAnswered = 0;
  let totalNoInfo = 0;
  let totalSpecific = 0;

  for (const r of results) {
    const answered = r.conversations.filter(c => c.response).length;
    const noInfo = r.conversations.filter(c => c.saidNoInfo).length;
    const specific = r.conversations.filter(c => c.hasSpecificData).length;
    const status = r.sessionId ? 'OK' : 'FAIL';
    const avgTime =
      r.conversations.length > 0
        ? Math.round(
            r.conversations.reduce((s, c) => s + c.responseTimeMs, 0) /
              r.conversations.length
          )
        : 0;

    console.log(
      `  ${status.padEnd(5)} ${r.company.padEnd(20)} | ` +
        `session: ${(r.sessionCreationTimeMs / 1000).toFixed(1)}s | ` +
        `${answered}/${r.conversations.length} answered | ` +
        `${noInfo} no-info | ${specific} specific | ` +
        `avg ${avgTime}ms | models: [${r.systemPromptModelsFound.join(', ')}]` +
        (r.errors.length > 0 ? ` | ${r.errors.length} errors` : '')
    );

    totalQuestions += r.conversations.length;
    totalAnswered += answered;
    totalNoInfo += noInfo;
    totalSpecific += specific;
  }

  console.log('');
  console.log(`Total: ${totalAnswered}/${totalQuestions} answered, ${totalNoInfo} no-info, ${totalSpecific} with specific data`);
  console.log(`Sessions created: ${results.filter(r => r.sessionId).length}/${results.length}`);
  console.log(`Results saved to: ${GROUND_TRUTH_DIR}/`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
