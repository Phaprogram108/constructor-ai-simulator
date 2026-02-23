/**
 * Dynamic Test Script
 *
 * Tests the Constructor AI Simulator by having realistic 4-message
 * conversations with ~30 construction company chatbots.
 *
 * Run: npx tsx src/scripts/dynamic-test.ts
 * Output: src/scripts/dynamic-test-results.json
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================
// CONFIG
// ============================================

const BASE_URL = 'http://localhost:3000';
const CREATE_TIMEOUT_MS = 120_000;
const CHAT_TIMEOUT_MS = 30_000;
const DELAY_BETWEEN_COMPANIES_MS = 5_000;
const MAX_COMPANIES = 30;
const SKIP_COMPANIES = ['Habika', 'ViBert', 'Importainer', 'Lucys House'];

// ============================================
// TYPES
// ============================================

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
    fase2: CompanyEntry[];
  };
}

interface CreateResponse {
  sessionId: string;
  companyName: string;
  welcomeMessage: string;
  systemPrompt: string;
  messagesRemaining: number;
  websiteUrl?: string;
}

interface ChatResponse {
  message: string;
  researched: boolean;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface TestResult {
  company: string;
  url: string;
  status: 'OK' | 'FAIL' | 'PARTIAL';
  scrapingTimeMs: number;
  companyNameDetected: string;
  modelsFound: string[];
  garbageDetected: string[];
  noInfoResponses: number;
  totalMessages: number;
  errorMessages: string[];
  hasContactInfo: boolean;
  hasWhatsApp: boolean;
  qualityScore: number;
  notes: string;
  conversation: ConversationMessage[];
}

// ============================================
// GARBAGE DETECTION
// ============================================

const GARBAGE_PATTERNS: RegExp[] = [
  /^proyecto\s+\d+$/i,
  /^detalle\s+\d+$/i,
  /entregas\s+inmediatas/i,
  /módulos\s+habitacionales/i,
  /equipamientos/i,
  /read\s+more/i,
  /back\s+to\s+top/i,
  /consultanos/i,
  /ver\s+más/i,
  /whatsapp\s+chat/i,
];

const NO_INFO_PATTERNS: RegExp[] = [
  /no tengo (?:esa )?informaci[oó]n/i,
  /no (?:tengo|cuento con).*(?:cargad|disponible|espec[ií]fic)/i,
  /no puedo (?:acceder|verificar|confirmar)/i,
  /no dispongo de/i,
  /no (?:tengo|poseo) (?:datos|detalles)/i,
  /te (?:recomiendo|sugiero) (?:contactar|comunicarte)/i,
  /para (?:más|mayor) informaci[oó]n.*contact/i,
];

const CONTACT_PATTERNS: RegExp[] = [
  /whatsapp/i,
  /\+?54\s?\d/,
  /\(\d{2,4}\)/,
  /@[\w.-]+\.\w+/,
  /tel[eé]fono/i,
  /llamanos/i,
  /llam[aá]/i,
  /email/i,
  /correo/i,
  /mail/i,
];

const WHATSAPP_PATTERNS: RegExp[] = [
  /whatsapp/i,
  /wa\.me/i,
  /api\.whatsapp/i,
];

// ============================================
// HELPERS
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

function detectGarbage(text: string): string[] {
  const found: string[] = [];
  for (const pattern of GARBAGE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      found.push(match[0]);
    }
  }
  return found;
}

function isNoInfoResponse(text: string): boolean {
  return NO_INFO_PATTERNS.some(p => p.test(text));
}

function hasContactInfo(text: string): boolean {
  return CONTACT_PATTERNS.some(p => p.test(text));
}

function hasWhatsApp(text: string): boolean {
  return WHATSAPP_PATTERNS.some(p => p.test(text));
}

/**
 * Extract model names from AI response text.
 * Looks for patterns like quoted names, bold names, or list items that look like product names.
 */
function extractModelNames(text: string): string[] {
  const models: string[] = [];

  // Match bold text (markdown): **Model Name**
  const boldMatches = text.matchAll(/\*\*([^*]+)\*\*/g);
  for (const m of boldMatches) {
    const name = m[1].trim();
    // Filter out generic phrases
    if (name.length > 2 && name.length < 60 && !/^(nota|precio|importante|incluye|detalle)/i.test(name)) {
      models.push(name);
    }
  }

  // Match quoted names: "Model Name" or «Model Name»
  const quotedMatches = text.matchAll(/[""«]([^""»]+)[""»]/g);
  for (const m of quotedMatches) {
    const name = m[1].trim();
    if (name.length > 2 && name.length < 60) {
      models.push(name);
    }
  }

  // Match list items that start with a dash and look like model names
  const listMatches = text.matchAll(/^[-•]\s+([A-Z][^:.\n]{3,50})/gm);
  for (const m of listMatches) {
    const name = m[1].trim();
    if (!/^(para|con|en|el|la|los|las|un|una|si|no|te|se)/i.test(name)) {
      models.push(name);
    }
  }

  // Deduplicate
  return [...new Set(models)];
}

/**
 * Calculate quality score 1-5 based on conversation analysis.
 */
function calculateQualityScore(params: {
  sessionOk: boolean;
  totalMessages: number;
  noInfoCount: number;
  garbageCount: number;
  hasModels: boolean;
  hasContact: boolean;
  errorCount: number;
}): number {
  if (!params.sessionOk) return 1;

  let score = 3; // baseline

  // Models found is a strong positive signal
  if (params.hasModels) score += 1;

  // Contact info provided is a positive signal
  if (params.hasContact) score += 0.5;

  // Too many "no info" responses drags score down
  const noInfoRatio = params.totalMessages > 0 ? params.noInfoCount / params.totalMessages : 0;
  if (noInfoRatio > 0.5) score -= 1.5;
  else if (noInfoRatio > 0.25) score -= 0.5;

  // Garbage detected is a negative signal
  if (params.garbageCount > 0) score -= 0.5;
  if (params.garbageCount > 3) score -= 0.5;

  // Errors
  if (params.errorCount > 0) score -= 0.5;

  // Clamp between 1-5
  return Math.max(1, Math.min(5, Math.round(score)));
}

// ============================================
// DYNAMIC CONVERSATION
// ============================================

/**
 * Generate message 2 based on the AI's first response.
 */
function generateMessage2(firstResponse: string): string {
  // Look for a specific model name to ask about
  const models = extractModelNames(firstResponse);
  if (models.length > 0) {
    const modelName = models[0];
    return `Me interesa el modelo ${modelName}. ¿Cuánto sale? ¿Qué incluye?`;
  }
  // Fallback: generic follow-up
  return '¿Pueden darme más detalles sobre las opciones que manejan? Me interesa saber superficies y qué incluyen.';
}

/**
 * Generate message 3 based on conversation so far.
 */
function generateMessage3(responses: string[]): string {
  const allText = responses.join(' ').toLowerCase();

  // If pricing was mentioned, ask about delivery
  if (/\$|usd|precio|cuesta|sale|cotizaci/i.test(allText)) {
    return '¿Cuánto tiempo demora la entrega una vez que se confirma? ¿Hacen entregas en Buenos Aires?';
  }

  // If delivery was already mentioned, ask about financing
  if (/entrega|plazo|demora|d[ií]as/i.test(allText)) {
    return '¿Tienen financiación? ¿Cuáles son las formas de pago?';
  }

  // Default: ask about timelines
  return '¿Cuánto demora todo el proceso desde que arranco hasta que me entregan la casa?';
}

const MESSAGE_1 = 'Hola, estoy buscando una casa prefabricada. ¿Qué modelos tienen disponibles?';
const MESSAGE_4 = 'Me interesa, ¿cómo puedo contactarlos? ¿Tienen WhatsApp?';

// ============================================
// API CALLS
// ============================================

async function createSession(url: string): Promise<CreateResponse> {
  const resp = await fetchWithTimeout(
    `${BASE_URL}/api/simulator/create`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ websiteUrl: url }),
    },
    CREATE_TIMEOUT_MS
  );

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${resp.status}`);
  }

  return resp.json();
}

async function sendChat(
  sessionId: string,
  message: string,
  systemPrompt: string,
  conversationHistory: ConversationMessage[],
  websiteUrl: string
): Promise<ChatResponse> {
  const resp = await fetchWithTimeout(
    `${BASE_URL}/api/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        message,
        systemPrompt,
        conversationHistory,
        websiteUrl,
      }),
    },
    CHAT_TIMEOUT_MS
  );

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${resp.status}`);
  }

  return resp.json();
}

// ============================================
// TEST A SINGLE COMPANY
// ============================================

async function testCompany(company: CompanyEntry, index: number, total: number): Promise<TestResult> {
  const result: TestResult = {
    company: company.name,
    url: company.url,
    status: 'FAIL',
    scrapingTimeMs: 0,
    companyNameDetected: '',
    modelsFound: [],
    garbageDetected: [],
    noInfoResponses: 0,
    totalMessages: 0,
    errorMessages: [],
    hasContactInfo: false,
    hasWhatsApp: false,
    qualityScore: 1,
    notes: '',
    conversation: [],
  };

  const prefix = `[${index + 1}/${total}]`;

  // Step 1: Create session (scraping)
  process.stdout.write(`${prefix} Testing ${company.name}... scraping...`);
  const scrapeStart = Date.now();

  let session: CreateResponse;
  try {
    session = await createSession(company.url);
    result.scrapingTimeMs = Date.now() - scrapeStart;
    result.companyNameDetected = session.companyName;
    process.stdout.write(` done (${Math.round(result.scrapingTimeMs / 1000)}s)`);
  } catch (err: unknown) {
    result.scrapingTimeMs = Date.now() - scrapeStart;
    const errMsg = err instanceof Error ? err.message : String(err);
    result.errorMessages.push(`Create failed: ${errMsg}`);
    result.notes = `Session creation failed: ${errMsg}`;
    console.log(` FAILED (${errMsg})`);
    return result;
  }

  // Add welcome message to conversation
  result.conversation.push({ role: 'assistant', content: session.welcomeMessage });

  // Check welcome message for garbage
  const welcomeGarbage = detectGarbage(session.welcomeMessage);
  result.garbageDetected.push(...welcomeGarbage);

  // Step 2: 4-message conversation
  process.stdout.write(' chatting...');

  const conversationHistory: ConversationMessage[] = [];
  const aiResponses: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const messages = [MESSAGE_1]; // Start with message 1; messages 2-4 will be generated dynamically

  for (let msgIdx = 0; msgIdx < 4; msgIdx++) {
    let userMessage: string;

    if (msgIdx === 0) {
      userMessage = MESSAGE_1;
    } else if (msgIdx === 1) {
      userMessage = generateMessage2(aiResponses[0]);
    } else if (msgIdx === 2) {
      userMessage = generateMessage3(aiResponses);
    } else {
      userMessage = MESSAGE_4;
    }

    try {
      const chatResp = await sendChat(
        session.sessionId,
        userMessage,
        session.systemPrompt,
        conversationHistory,
        company.url
      );

      // Record conversation
      result.conversation.push({ role: 'user', content: userMessage });
      result.conversation.push({ role: 'assistant', content: chatResp.message });
      result.totalMessages++;

      // Update conversation history for next message
      conversationHistory.push({ role: 'user', content: userMessage });
      conversationHistory.push({ role: 'assistant', content: chatResp.message });

      aiResponses.push(chatResp.message);

      // Analyze this response
      if (isNoInfoResponse(chatResp.message)) {
        result.noInfoResponses++;
      }

      const garbage = detectGarbage(chatResp.message);
      result.garbageDetected.push(...garbage);

      // Extract models from first response
      if (msgIdx === 0) {
        result.modelsFound = extractModelNames(chatResp.message);
      }

      // Check last response for contact info
      if (msgIdx === 3) {
        result.hasContactInfo = hasContactInfo(chatResp.message);
        result.hasWhatsApp = hasWhatsApp(chatResp.message);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      result.errorMessages.push(`Chat ${msgIdx + 1} failed: ${errMsg}`);
      // Continue trying remaining messages
    }
  }

  // Deduplicate garbage
  result.garbageDetected = [...new Set(result.garbageDetected)];

  // Calculate quality
  result.qualityScore = calculateQualityScore({
    sessionOk: true,
    totalMessages: result.totalMessages,
    noInfoCount: result.noInfoResponses,
    garbageCount: result.garbageDetected.length,
    hasModels: result.modelsFound.length > 0,
    hasContact: result.hasContactInfo,
    errorCount: result.errorMessages.length,
  });

  // Set status
  if (result.errorMessages.length === 0 && result.totalMessages === 4) {
    result.status = 'OK';
  } else if (result.totalMessages > 0) {
    result.status = 'PARTIAL';
  }

  // Build notes
  const notesParts: string[] = [];
  if (company.knownIssue) notesParts.push(`Known: ${company.knownIssue}`);
  if (result.modelsFound.length > 0) notesParts.push(`Models: ${result.modelsFound.join(', ')}`);
  if (result.garbageDetected.length > 0) notesParts.push(`Garbage: ${result.garbageDetected.join(', ')}`);
  if (result.noInfoResponses > 0) notesParts.push(`No-info: ${result.noInfoResponses}/${result.totalMessages}`);
  result.notes = notesParts.join(' | ');

  console.log(` done (score: ${result.qualityScore}/5)`);

  return result;
}

// ============================================
// SUMMARY TABLE
// ============================================

function printSummaryTable(results: TestResult[]): void {
  console.log('\n' + '='.repeat(120));
  console.log('SUMMARY TABLE');
  console.log('='.repeat(120));

  const header = [
    'Company'.padEnd(25),
    'Status'.padEnd(8),
    'Models'.padEnd(8),
    'Garbage'.padEnd(9),
    'NoInfo'.padEnd(8),
    'Score'.padEnd(7),
    'Time'.padEnd(7),
    'Notes',
  ].join(' | ');

  console.log(header);
  console.log('-'.repeat(120));

  for (const r of results) {
    const row = [
      r.company.padEnd(25).slice(0, 25),
      r.status.padEnd(8),
      String(r.modelsFound.length).padEnd(8),
      (r.garbageDetected.length > 0 ? 'Y' : 'N').padEnd(9),
      `${r.noInfoResponses}/${r.totalMessages}`.padEnd(8),
      `${r.qualityScore}/5`.padEnd(7),
      `${Math.round(r.scrapingTimeMs / 1000)}s`.padEnd(7),
      r.notes.slice(0, 60),
    ].join(' | ');

    console.log(row);
  }

  console.log('-'.repeat(120));

  // Aggregates
  const total = results.length;
  const okCount = results.filter(r => r.status === 'OK').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const partialCount = results.filter(r => r.status === 'PARTIAL').length;
  const avgScore = total > 0 ? (results.reduce((s, r) => s + r.qualityScore, 0) / total).toFixed(1) : '0';
  const avgScrape = total > 0 ? Math.round(results.reduce((s, r) => s + r.scrapingTimeMs, 0) / total / 1000) : 0;
  const totalModels = results.reduce((s, r) => s + r.modelsFound.length, 0);
  const garbageCompanies = results.filter(r => r.garbageDetected.length > 0).length;
  const contactRate = total > 0 ? Math.round(results.filter(r => r.hasContactInfo).length / total * 100) : 0;
  const whatsappRate = total > 0 ? Math.round(results.filter(r => r.hasWhatsApp).length / total * 100) : 0;

  console.log(`\nTotals: ${okCount} OK, ${partialCount} PARTIAL, ${failCount} FAIL (${total} companies)`);
  console.log(`Avg Quality Score: ${avgScore}/5`);
  console.log(`Avg Scraping Time: ${avgScrape}s`);
  console.log(`Total Models Found: ${totalModels}`);
  console.log(`Companies with Garbage: ${garbageCompanies}/${total}`);
  console.log(`Contact Info Rate: ${contactRate}%`);
  console.log(`WhatsApp Rate: ${whatsappRate}%`);
}

// ============================================
// MAIN
// ============================================

async function main(): Promise<void> {
  console.log('=== Constructor AI Simulator - Dynamic Test ===');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Timeout: create=${CREATE_TIMEOUT_MS / 1000}s, chat=${CHAT_TIMEOUT_MS / 1000}s`);
  console.log(`Delay between companies: ${DELAY_BETWEEN_COMPANIES_MS / 1000}s`);
  console.log('');

  // Load companies
  const companiesPath = path.join(__dirname, 'test-companies.json');
  const companiesFile: CompaniesFile = JSON.parse(fs.readFileSync(companiesPath, 'utf-8'));

  // Flatten all groups
  const allCompanies: CompanyEntry[] = [
    ...companiesFile.companies.problematicas,
    ...companiesFile.companies.aleatorias,
    ...companiesFile.companies.fase2,
  ];

  // Filter out already-tested companies
  const filteredCompanies = allCompanies.filter(
    c => !SKIP_COMPANIES.includes(c.name)
  );

  // Take up to MAX_COMPANIES
  const companies = filteredCompanies.slice(0, MAX_COMPANIES);

  console.log(`Loaded ${allCompanies.length} companies, skipping ${SKIP_COMPANIES.length}, testing ${companies.length}`);
  console.log(`Skipped: ${SKIP_COMPANIES.join(', ')}`);
  console.log('');

  const results: TestResult[] = [];
  const startTime = Date.now();

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];

    try {
      const result = await testCompany(company, i, companies.length);
      results.push(result);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.log(`[${i + 1}/${companies.length}] ${company.name}: UNEXPECTED ERROR - ${errMsg}`);
      results.push({
        company: company.name,
        url: company.url,
        status: 'FAIL',
        scrapingTimeMs: 0,
        companyNameDetected: '',
        modelsFound: [],
        garbageDetected: [],
        noInfoResponses: 0,
        totalMessages: 0,
        errorMessages: [errMsg],
        hasContactInfo: false,
        hasWhatsApp: false,
        qualityScore: 1,
        notes: `Unexpected error: ${errMsg}`,
        conversation: [],
      });
    }

    // Delay between companies (except after the last one)
    if (i < companies.length - 1) {
      await sleep(DELAY_BETWEEN_COMPANIES_MS);
    }
  }

  const totalTimeMs = Date.now() - startTime;
  console.log(`\nAll tests completed in ${Math.round(totalTimeMs / 1000)}s (${Math.round(totalTimeMs / 60000)}min)`);

  // Print summary table
  printSummaryTable(results);

  // Write results to JSON
  const outputPath = path.join(__dirname, 'dynamic-test-results.json');
  const output = {
    metadata: {
      createdAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      totalCompanies: companies.length,
      totalTimeMs,
      skipped: SKIP_COMPANIES,
    },
    results,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\nResults written to: ${outputPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
