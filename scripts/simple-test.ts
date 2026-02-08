#!/usr/bin/env tsx
import * as fs from 'fs';
import path from 'path';

const API_BASE = 'https://agenteiagratis.com';
const SESSION_TIMEOUT = 180_000;
const CHAT_TIMEOUT = 60_000;
const DELAY_BETWEEN_COMPANIES = 3_000;
const DELAY_BETWEEN_QUESTIONS = 1_500;

interface Company {
  name: string;
  url: string;
}

interface TestResult {
  company: string;
  success: boolean;
  sessionTime?: number;
  answered?: number;
  noInfo?: number;
  avgResponseTime?: number;
  error?: string;
}

// Load companies from JSON + extras
function loadCompanies(): Company[] {
  const jsonPath = path.join(__dirname, '../src/scripts/test-companies.json');
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  const companies: Company[] = [
    ...data.companies.problematicas.map((c: any) => ({ name: c.name, url: c.url })),
    ...data.companies.aleatorias.map((c: any) => ({ name: c.name, url: c.url })),
    ...data.companies.fase2.map((c: any) => ({ name: c.name, url: c.url })),
    { name: "Makenhaus", url: "https://makenhaus.com/" },
    { name: "Cabanas del Sol", url: "https://cabanasdelsol.com.ar/" },
    { name: "Arq Steel", url: "https://arqsteel.com.ar/" },
    { name: "Casas Fenix", url: "https://casasfenix.com.ar/" },
    { name: "Modhouse", url: "https://modhouse.com.ar/" },
    { name: "InduHouse", url: "https://induhouse.com.ar/" },
    { name: "Steelplex", url: "https://steelplex.com.ar/" },
    { name: "Sipanel", url: "https://sipanel.com.ar/" },
    { name: "Wood Frames", url: "https://woodframes.com.ar/" },
    { name: "Bauhaus Modular", url: "https://bauhausmodular.com.ar/" }
  ];

  return companies;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// Extract first model from system prompt
function extractFirstModel(systemPrompt: string): string | null {
  const lines = systemPrompt.split('\n');
  let inModelsSection = false;

  for (const line of lines) {
    if (line.includes('### ') && (line.includes('MODELO') || line.includes('CASA'))) {
      const match = line.match(/###\s+(.+)/);
      if (match) return match[1].trim();
    }
    if (line.includes('DISPONIBLES')) inModelsSection = true;
    if (inModelsSection && line.startsWith('###')) {
      const match = line.match(/###\s+(.+)/);
      if (match) return match[1].trim();
    }
  }
  return null;
}

// Create session
async function createSession(url: string): Promise<{ sessionId: string; systemPrompt: string; time: number }> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SESSION_TIMEOUT);

  try {
    const res = await fetch(`${API_BASE}/api/simulator/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ websiteUrl: url }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { sessionId: data.sessionId, systemPrompt: data.systemPrompt, time: Date.now() - start };
  } catch (err: any) {
    clearTimeout(timeout);
    throw err;
  }
}

// Ask question
async function askQuestion(sessionId: string, message: string, systemPrompt: string, history: any[], companyName: string, websiteUrl: string): Promise<{ response: string; time: number }> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHAT_TIMEOUT);

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message, systemPrompt, conversationHistory: history, companyName, websiteUrl }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { response: data.message || data.response || '[Sin respuesta]', time: Date.now() - start };
  } catch (err: any) {
    clearTimeout(timeout);
    throw err;
  }
}

// Test one company
async function testCompany(company: Company, force: boolean): Promise<TestResult> {
  const slug = slugify(company.name);
  const outputPath = path.join(__dirname, '../tests/conversations', `${slug}.txt`);

  // Skip if exists
  if (!force) {
    try {
      if (fs.existsSync(outputPath)) {
        console.log(`  ${company.name} - already tested (use --force to rerun)`);
        return { company: company.name, success: true };
      }
    } catch {}
  }

  console.log(`🧪 Testing ${company.name}...`);

  try {
    // Create session
    const { sessionId, systemPrompt, time: sessionTime } = await createSession(company.url);

    // Get model name
    const modelName = extractFirstModel(systemPrompt) || 'su modelo más popular';

    // Questions
    const questions = [
      "¿Qué es tu empresa y qué hacen?",
      "¿Qué productos o servicios ofrecen?",
      "¿Cuántos modelos/casas tienen?",
      `Contame sobre ${modelName}`,
      "¿Cuánto sale aproximadamente una casa de 2 dormitorios?",
      "¿Qué garantía ofrecen?",
      "¿Cuál es su WhatsApp o teléfono?"
    ];

    const history: any[] = [];
    const responses: Array<{ question: string; answer: string; time: number }> = [];

    for (const question of questions) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_QUESTIONS));
      const { response, time } = await askQuestion(sessionId, question, systemPrompt, history, company.name, company.url);
      history.push({ role: 'user', content: question });
      history.push({ role: 'assistant', content: response });
      responses.push({ question, answer: response, time });
    }

    // Calculate stats
    const noInfo = responses.filter(r => r.answer.toLowerCase().includes('no tengo') || r.answer.toLowerCase().includes('no dispongo')).length;
    const avgResponseTime = responses.reduce((sum, r) => sum + r.time, 0) / responses.length;

    // Save conversation
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const output = [
      `=== ${company.name.toUpperCase()} ===`,
      `URL: ${company.url}`,
      `Session: ${sessionId}`,
      `Date: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
      `Session creation: ${(sessionTime / 1000).toFixed(1)}s`,
      '',
      ...responses.flatMap(r => [
        `USUARIO: ${r.question}`,
        `AGENTE (${(r.time / 1000).toFixed(1)}s): ${r.answer}`,
        ''
      ]),
      '--- RESUMEN ---',
      `Preguntas: ${questions.length}`,
      `Respondidas: ${responses.length}`,
      `"No tengo info": ${noInfo}`,
      `Tiempo promedio: ${(avgResponseTime / 1000).toFixed(1)}s`
    ].join('\n');

    fs.writeFileSync(outputPath, output, 'utf-8');

    console.log(`✅ ${company.name} - ${responses.length}/${questions.length} answered, ${noInfo} no-info, avg ${(avgResponseTime / 1000).toFixed(1)}s`);

    return {
      company: company.name,
      success: true,
      sessionTime: sessionTime / 1000,
      answered: responses.length,
      noInfo,
      avgResponseTime: avgResponseTime / 1000
    };

  } catch (err: any) {
    console.log(`❌ ${company.name} - ${err.message}`);
    return { company: company.name, success: false, error: err.message };
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const singleCompany = args.find(a => a.startsWith('--company'))?.split('=')[1]?.replace(/"/g, '');

  let companies = loadCompanies();
  if (singleCompany) {
    companies = companies.filter(c => c.name.toLowerCase().includes(singleCompany.toLowerCase()));
    if (companies.length === 0) {
      console.error(`❌ Company "${singleCompany}" not found`);
      process.exit(1);
    }
  }

  console.log(`🚀 Testing ${companies.length} companies\n`);

  const results: TestResult[] = [];

  for (const company of companies) {
    const result = await testCompany(company, force);
    results.push(result);

    if (companies.indexOf(company) < companies.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_COMPANIES));
    }
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  const ok = results.filter(r => r.success);
  const fail = results.filter(r => !r.success);

  for (const r of results) {
    if (r.success && r.answered !== undefined) {
      console.log(`OK   ${r.company.padEnd(25)} | ${r.sessionTime!.toFixed(1)}s session | ${r.answered}/7 answered | ${r.noInfo} no-info | avg ${r.avgResponseTime!.toFixed(1)}s`);
    } else if (r.success) {
      console.log(`SKIP ${r.company.padEnd(25)} | Already tested`);
    } else {
      console.log(`FAIL ${r.company.padEnd(25)} | ${r.error}`);
    }
  }

  const totalAnswered = ok.filter(r => r.answered !== undefined).reduce((sum, r) => sum + r.answered!, 0);
  const totalNoInfo = ok.filter(r => r.noInfo !== undefined).reduce((sum, r) => sum + r.noInfo!, 0);

  console.log(`\nTotal: ${ok.length}/${results.length} OK, ${fail.length} FAIL, ${totalAnswered}/${ok.length * 7} answered, ${totalNoInfo} no-info (${((totalNoInfo / totalAnswered) * 100).toFixed(1)}%)`);
}

main().catch(console.error);
