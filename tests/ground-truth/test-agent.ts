/**
 * Production Agent Tester
 *
 * Tests the AI agent against production (agenteiagratis.com).
 * Creates a session, asks questions, and saves transcript + structured results.
 *
 * Usage:
 *   npx tsx tests/ground-truth/test-agent.ts --name "ViBert" --url "https://vibert.com.ar"
 *   npx tsx tests/ground-truth/test-agent.ts --name "ViBert" --url "https://vibert.com.ar" --force
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const API_BASE = 'https://agenteiagratis.com';
const SESSION_TIMEOUT_MS = 180_000; // 3 min for session creation (Firecrawl can be slow)
const CHAT_TIMEOUT_MS = 60_000;
const DELAY_BETWEEN_QUESTIONS_MS = 2_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SessionResponse {
  sessionId: string;
  companyName: string;
  welcomeMessage: string;
  systemPrompt: string;
  websiteUrl: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ConversationEntry {
  question: string;
  response: string;
  responseTimeMs: number;
  saidNoInfo: boolean;
  reSearchTriggered: boolean;
  timestamp: string;
}

interface AgentTestResult {
  company: string;
  url: string;
  testedAt: string;
  sessionId: string;
  companyName: string;
  welcomeMessage: string;
  systemPromptPreview: string;
  systemPromptLength: number;
  sessionCreationTimeMs: number;
  conversations: ConversationEntry[];
  summary: {
    totalQuestions: number;
    answered: number;
    noInfo: number;
    reSearches: number;
    avgResponseTimeMs: number;
  };
  errors: string[];
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
function parseArgs(): { name: string; url: string; force: boolean } {
  const args = process.argv.slice(2);
  let name = '';
  let url = '';
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      name = args[i + 1];
      i++;
    } else if (args[i] === '--url' && args[i + 1]) {
      url = args[i + 1];
      i++;
    } else if (args[i] === '--force') {
      force = true;
    }
  }

  if (!name || !url) {
    console.error('Usage: npx tsx test-agent.ts --name "CompanyName" --url "https://example.com"');
    process.exit(1);
  }

  return { name, url, force };
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

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDateTime(date: Date): string {
  return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
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
  'no puedo confirmar',
  'no tengo detalles',
];

function detectNoInfo(response: string): boolean {
  const lower = response.toLowerCase();
  return noInfoPhrases.some(phrase => lower.includes(phrase));
}

function detectReSearch(response: string): boolean {
  // Detect if agent indicated it re-searched the website
  const lower = response.toLowerCase();
  return lower.includes('busqué') || lower.includes('busque') ||
         lower.includes('revisé') || lower.includes('revise') ||
         lower.includes('consulté') || lower.includes('verifiqué');
}

function extractModelsFromPrompt(prompt: string): string[] {
  const productSection = prompt.match(
    /## [A-ZÁÉÍÓÚÑ,\s]+ DISPONIBLES[\s\S]*?(?=\n##[^#]|$)/i
  ) || prompt.match(
    /## (?:MODELOS|PRODUCTOS|TIPOLOGIAS|PROYECTOS|UNIDADES|SERVICIOS|CATALOGO)[^\n]*[\s\S]*?(?=\n##[^#]|$)/i
  );
  if (!productSection) return [];

  const section = productSection[0];
  const models: string[] = [];

  // Pattern: numbered headings "### 1. ProductName"
  const numberedMatches = section.matchAll(/###\s+\d+\.\s+(.+?)(?:\n|$)/gi);
  for (const m of numberedMatches) {
    const name = m[1].trim();
    if (name && name.length > 0 && name.length < 80) models.push(name);
  }

  // Pattern: unnumbered headings "### ProductName"
  if (models.length === 0) {
    const unnumberedMatches = section.matchAll(/###\s+([A-ZÁÉÍÓÚÑ][^\n]{1,79})(?:\n|$)/gi);
    for (const m of unnumberedMatches) {
      const name = m[1].trim();
      if (name && !name.match(/^\d+\./) && name.length < 80) models.push(name);
    }
  }

  return models;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------
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
  companyName: string,
  websiteUrl: string
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
        websiteUrl,
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
function generateQuestions(systemPrompt: string): string[] {
  const questions: string[] = [
    '¿Qué es tu empresa y qué hacen?',
    '¿Qué productos o servicios ofrecen?',
    '¿Cuántos modelos/casas tienen?',
  ];

  // Try to find a specific model name to ask about
  const models = extractModelsFromPrompt(systemPrompt);
  if (models.length > 0) {
    questions.push(`Contame sobre ${models[0]}`);
    questions.push(`¿Cuáles son los detalles técnicos de ${models[0]}? Superficie, dormitorios.`);
  } else {
    questions.push('Contame sobre el modelo más popular que tengan');
    questions.push('¿Cuáles son los detalles técnicos del modelo más vendido? Superficie, dormitorios.');
  }

  questions.push(
    '¿Cuánto sale aproximadamente una casa de 2 dormitorios?',
    '¿Qué incluye el precio?',
    '¿Qué garantía ofrecen?',
    '¿Cuál es su WhatsApp o teléfono?',
    '¿A qué zonas llegan?',
  );

  return questions;
}

// ---------------------------------------------------------------------------
// Transcript generator
// ---------------------------------------------------------------------------
function generateTranscript(result: AgentTestResult): string {
  let txt = '';
  txt += `=== AGENT TEST: ${result.company} ===\n`;
  txt += `URL: ${result.url}\n`;
  txt += `Session: ${result.sessionId}\n`;
  txt += `Tested: ${formatDateTime(new Date(result.testedAt))}\n`;
  txt += `Session creation: ${(result.sessionCreationTimeMs / 1000).toFixed(1)}s\n\n`;

  txt += `--- System Prompt (first 500 chars) ---\n`;
  txt += result.systemPromptPreview + '\n';
  txt += '...\n\n';

  txt += `--- Welcome Message ---\n`;
  txt += result.welcomeMessage + '\n\n';

  txt += `--- Conversation ---\n\n`;

  for (const conv of result.conversations) {
    txt += `[${formatTime(new Date(conv.timestamp))}] USER: ${conv.question}\n`;
    txt += `[${formatTime(new Date(new Date(conv.timestamp).getTime() + conv.responseTimeMs))}] AGENT (${(conv.responseTimeMs / 1000).toFixed(1)}s): ${conv.response}\n`;
    txt += `[re-search: ${conv.reSearchTriggered ? 'yes' : 'no'}]\n\n`;
  }

  txt += `--- Summary ---\n`;
  txt += `Questions: ${result.summary.totalQuestions}\n`;
  txt += `Answered: ${result.summary.answered}\n`;
  txt += `No-info: ${result.summary.noInfo}\n`;
  txt += `Re-searches triggered: ${result.summary.reSearches}\n`;
  txt += `Avg response time: ${(result.summary.avgResponseTimeMs / 1000).toFixed(1)}s\n`;

  if (result.errors.length > 0) {
    txt += `\n--- Errors ---\n`;
    for (const err of result.errors) {
      txt += `- ${err}\n`;
    }
  }

  return txt;
}

// ---------------------------------------------------------------------------
// Main test function
// ---------------------------------------------------------------------------
export async function testAgent(
  companyName: string,
  websiteUrl: string,
  force: boolean = false
): Promise<AgentTestResult> {
  const slug = slugify(companyName);
  const outputDir = path.join(__dirname, slug);
  const resultPath = path.join(outputDir, 'agent-test.json');
  const transcriptPath = path.join(outputDir, 'agent-conversation.txt');

  // Check if already tested
  if (!force && fs.existsSync(resultPath)) {
    console.log(`  Agent test already exists for ${companyName}, skipping (use --force to re-run)`);
    return JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const errors: string[] = [];
  const now = new Date();

  // Create session
  console.log(`  Creating session for ${websiteUrl}...`);
  const sessionStart = Date.now();
  let session: SessionResponse;

  try {
    session = await createSession(websiteUrl);
  } catch (err: any) {
    const msg = `Session creation failed: ${err.message}`;
    console.error(`  FAILED: ${msg}`);

    const failResult: AgentTestResult = {
      company: companyName,
      url: websiteUrl,
      testedAt: now.toISOString(),
      sessionId: '',
      companyName: '',
      welcomeMessage: '',
      systemPromptPreview: '',
      systemPromptLength: 0,
      sessionCreationTimeMs: Date.now() - sessionStart,
      conversations: [],
      summary: { totalQuestions: 0, answered: 0, noInfo: 0, reSearches: 0, avgResponseTimeMs: 0 },
      errors: [msg],
    };

    fs.writeFileSync(resultPath, JSON.stringify(failResult, null, 2));
    return failResult;
  }

  const sessionCreationTimeMs = Date.now() - sessionStart;

  console.log(`  Session created in ${(sessionCreationTimeMs / 1000).toFixed(1)}s`);
  console.log(`  Session ID: ${session.sessionId}`);
  console.log(`  Company: ${session.companyName}`);
  console.log(`  System prompt: ${session.systemPrompt.length} chars`);

  // Generate questions
  const questions = generateQuestions(session.systemPrompt);
  console.log(`  Will ask ${questions.length} questions\n`);

  // Ask questions
  const conversations: ConversationEntry[] = [];
  const chatHistory: ChatMessage[] = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const timestamp = new Date();
    console.log(`  [${i + 1}/${questions.length}] ${q}`);

    const chatStart = Date.now();

    try {
      chatHistory.push({ role: 'user', content: q });

      const response = await sendChat(
        session.sessionId,
        session.systemPrompt,
        q,
        chatHistory.slice(0, -1), // exclude current message
        session.companyName,
        websiteUrl
      );

      const responseTimeMs = Date.now() - chatStart;
      chatHistory.push({ role: 'assistant', content: response });

      const noInfo = detectNoInfo(response);
      const reSearch = detectReSearch(response);

      conversations.push({
        question: q,
        response,
        responseTimeMs,
        saidNoInfo: noInfo,
        reSearchTriggered: reSearch,
        timestamp: timestamp.toISOString(),
      });

      const preview = response.substring(0, 120).replace(/\n/g, ' ');
      console.log(`    ${(responseTimeMs / 1000).toFixed(1)}s | noInfo=${noInfo} | "${preview}..."`);
    } catch (err: any) {
      const msg = `Question "${q}": ${err.message}`;
      console.error(`    ERROR: ${msg}`);
      errors.push(msg);

      chatHistory.pop(); // remove failed user message

      conversations.push({
        question: q,
        response: `[ERROR: ${err.message}]`,
        responseTimeMs: Date.now() - chatStart,
        saidNoInfo: false,
        reSearchTriggered: false,
        timestamp: timestamp.toISOString(),
      });
    }

    // Delay between questions
    if (i < questions.length - 1) {
      await sleep(DELAY_BETWEEN_QUESTIONS_MS);
    }
  }

  // Build result
  const answered = conversations.filter(c => c.response && !c.response.startsWith('[ERROR')).length;
  const noInfoCount = conversations.filter(c => c.saidNoInfo).length;
  const reSearchCount = conversations.filter(c => c.reSearchTriggered).length;
  const totalTime = conversations.reduce((s, c) => s + c.responseTimeMs, 0);
  const avgTime = conversations.length > 0 ? Math.round(totalTime / conversations.length) : 0;

  const result: AgentTestResult = {
    company: companyName,
    url: websiteUrl,
    testedAt: now.toISOString(),
    sessionId: session.sessionId,
    companyName: session.companyName,
    welcomeMessage: session.welcomeMessage,
    systemPromptPreview: session.systemPrompt.slice(0, 500),
    systemPromptLength: session.systemPrompt.length,
    sessionCreationTimeMs,
    conversations,
    summary: {
      totalQuestions: conversations.length,
      answered,
      noInfo: noInfoCount,
      reSearches: reSearchCount,
      avgResponseTimeMs: avgTime,
    },
    errors,
  };

  // Save JSON
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log(`\n  Saved: ${resultPath}`);

  // Save transcript
  const transcript = generateTranscript(result);
  fs.writeFileSync(transcriptPath, transcript);
  console.log(`  Saved: ${transcriptPath}`);

  return result;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
if (require.main === module) {
  const { name, url, force } = parseArgs();
  testAgent(name, url, force).catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
