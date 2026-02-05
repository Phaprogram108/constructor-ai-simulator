/**
 * QA Baseline Script - FASE 1
 *
 * Establece baseline de rendimiento con 20 empresas
 * Ejecutar: npx tsx src/scripts/qa-baseline.ts
 *
 * Output: logs/qa-baseline-YYYY-MM-DD.json
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================
// TIPOS
// ============================================

interface TestCompany {
  name: string;
  url: string;
  knownIssue?: string;
  expectedModels?: string[];
  notes?: string;
}

interface CompanyTestResult {
  company: TestCompany;
  sessionCreation: {
    success: boolean;
    sessionId?: string;
    companyNameDetected?: string;
    scrapingDurationMs: number;
    error?: string;
  };
  scraping: {
    modelsExtracted: string[];
    modelsCount: number;
    hasWhatsApp: boolean;
    whatsAppNumber?: string;
    hasInstagram: boolean;
    instagramUrl?: string;
    scrapingMethod?: 'firecrawl' | 'playwright' | 'fetch' | 'vision';
  };
  conversations: {
    question: string;
    questionId: string;
    response: string;
    responseDurationMs: number;
    analysis: {
      hasSpecificInfo: boolean;
      saidNoInfo: boolean;
      possibleHallucination: boolean;
      redFlags: string[];
    };
  }[];
  systemPromptExcerpt: string;
  metrics: {
    totalQuestions: number;
    specificResponses: number;
    noInfoResponses: number;
    possibleHallucinations: number;
    avgResponseTimeMs: number;
    qualityScore: number;
  };
}

interface BaselineReport {
  metadata: {
    version: string;
    createdAt: string;
    environment: 'local' | 'production';
    baseUrl: string;
  };
  summary: {
    totalCompanies: number;
    successfulSessions: number;
    failedSessions: number;
    avgQualityScore: number;
    avgScrapingTimeMs: number;
    totalModelsExtracted: number;
    whatsAppExtractionRate: number;
    noInfoResponseRate: number;
    hallucinationRate: number;
  };
  byCategory: {
    problematicas: {
      count: number;
      avgScore: number;
      commonIssues: string[];
    };
    aleatorias: {
      count: number;
      avgScore: number;
      commonIssues: string[];
    };
  };
  results: CompanyTestResult[];
  recommendations: string[];
}

// ============================================
// CONFIGURACION
// ============================================

const CONFIG = {
  BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
  DELAY_BETWEEN_COMPANIES_MS: 3000,
  DELAY_BETWEEN_QUESTIONS_MS: 1500,
  TIMEOUT_SESSION_MS: 120000,
  TIMEOUT_CHAT_MS: 30000,
};

const STANDARD_QUESTIONS = [
  {
    id: 'modelos',
    text: 'Que modelos de casas tienen disponibles? Dame los nombres y metros cuadrados.',
    category: 'catalogo',
    detectsHallucination: true,
  },
  {
    id: 'precios',
    text: 'Cuanto cuesta el modelo mas economico?',
    category: 'precios',
    detectsHallucination: true,
  },
  {
    id: 'whatsapp',
    text: 'Cual es el numero de WhatsApp para contactarlos?',
    category: 'contacto',
    detectsHallucination: false,
  },
  {
    id: 'cobertura',
    text: 'Llegan a todo el pais o solo a ciertas zonas?',
    category: 'cobertura',
    detectsHallucination: true,
  },
  {
    id: 'tecnico',
    text: 'De que materiales estan hechas las casas? Tienen DVH?',
    category: 'tecnico',
    detectsHallucination: true,
  },
];

// ============================================
// FUNCIONES AUXILIARES
// ============================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractModelsFromSystemPrompt(systemPrompt: string): string[] {
  const modelsSection = systemPrompt.match(/## MODELOS DISPONIBLES[\s\S]*?(?=##|$)/i);
  if (!modelsSection) return [];

  const models = modelsSection[0].match(/- ([^\n]+)/g) || [];
  return models.map(m => m.replace(/^- /, '').trim());
}

function extractWhatsAppFromSystemPrompt(systemPrompt: string): string | undefined {
  const waMatch = systemPrompt.match(/WhatsApp[:\s]*(\+?[\d\s\-()]{10,20})/i);
  return waMatch ? waMatch[1].trim() : undefined;
}

function analyzeResponse(
  question: string,
  response: string,
  detectsHallucination: boolean
): {
  hasSpecificInfo: boolean;
  saidNoInfo: boolean;
  possibleHallucination: boolean;
  redFlags: string[];
} {
  const redFlags: string[] = [];
  const responseLower = response.toLowerCase();

  const noInfoPhrases = [
    'no tengo esa informacion',
    'no cuento con',
    'no tengo cargad',
    'no dispongo',
    'te recomiendo contactar',
    'no tengo datos especificos',
    'no tengo los precios',
  ];
  const saidNoInfo = noInfoPhrases.some(p => responseLower.includes(p));

  const hasNumbers = /\d+\s*(m²|m2|metros|usd|\$|dormitorio|bano)/i.test(response);
  const hasModelNames = /\b(modelo|casa|vivienda)\s+[A-Z0-9]/i.test(response);
  const hasPhoneNumber = /(\+?54|011|15|0800)[\s\-]?[\d\s\-]{6,}/i.test(response);
  const hasSpecificInfo = hasNumbers || hasModelNames || hasPhoneNumber;

  let possibleHallucination = false;

  if (detectsHallucination) {
    const roundPrices = response.match(/USD?\s*([\d,.]+)/gi) || [];
    for (const price of roundPrices) {
      const num = parseFloat(price.replace(/[^\d.]/g, ''));
      if (num > 0 && num % 10000 === 0 && num >= 50000) {
        redFlags.push(`Precio muy redondo sospechoso: ${price}`);
        possibleHallucination = true;
      }
    }

    const genericModelNames = ['modelo a', 'modelo b', 'modelo c', 'casa tipo'];
    for (const name of genericModelNames) {
      if (responseLower.includes(name)) {
        redFlags.push(`Nombre de modelo generico: ${name}`);
        possibleHallucination = true;
      }
    }

    if (saidNoInfo && hasSpecificInfo) {
      redFlags.push('Contradictorio: dice no tener info pero da datos');
    }
  }

  return { hasSpecificInfo, saidNoInfo, possibleHallucination, redFlags };
}

function calculateQualityScore(result: CompanyTestResult): number {
  const { metrics } = result;

  const specificScore = (metrics.specificResponses / metrics.totalQuestions) * 40;
  const noHallucinationScore = (1 - metrics.possibleHallucinations / metrics.totalQuestions) * 30;
  const whatsAppScore = result.scraping.hasWhatsApp ? 20 : 0;
  const timeScore = metrics.avgResponseTimeMs < 5000 ? 10 : (metrics.avgResponseTimeMs < 10000 ? 5 : 0);

  return Math.round(specificScore + noHallucinationScore + whatsAppScore + timeScore);
}

// ============================================
// FUNCIONES PRINCIPALES
// ============================================

async function createSession(url: string): Promise<{
  success: boolean;
  data?: {
    sessionId: string;
    companyName: string;
    welcomeMessage: string;
    systemPrompt: string;
  };
  durationMs: number;
  error?: string;
}> {
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_SESSION_MS);

    const response = await fetch(`${CONFIG.BASE_URL}/api/simulator/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ websiteUrl: url }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        durationMs: Date.now() - start,
        error: `HTTP ${response.status}: ${text}`,
      };
    }

    const data = await response.json();

    return {
      success: true,
      data: {
        sessionId: data.sessionId,
        companyName: data.companyName,
        welcomeMessage: data.welcomeMessage,
        systemPrompt: data.systemPrompt,
      },
      durationMs: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function sendChatMessage(
  sessionId: string,
  systemPrompt: string,
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  companyName: string
): Promise<{
  success: boolean;
  response?: string;
  durationMs: number;
  error?: string;
}> {
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_CHAT_MS);

    const response = await fetch(`${CONFIG.BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        message,
        systemPrompt,
        conversationHistory: history,
        companyName,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        durationMs: Date.now() - start,
        error: `HTTP ${response.status}: ${text}`,
      };
    }

    const data = await response.json();

    return {
      success: true,
      response: data.message,
      durationMs: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function testCompany(company: TestCompany): Promise<CompanyTestResult> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${company.name}`);
  console.log(`URL: ${company.url}`);
  if (company.knownIssue) {
    console.log(`Known issue: ${company.knownIssue}`);
  }
  console.log('='.repeat(60));

  const result: CompanyTestResult = {
    company,
    sessionCreation: {
      success: false,
      scrapingDurationMs: 0,
    },
    scraping: {
      modelsExtracted: [],
      modelsCount: 0,
      hasWhatsApp: false,
      hasInstagram: false,
    },
    conversations: [],
    systemPromptExcerpt: '',
    metrics: {
      totalQuestions: STANDARD_QUESTIONS.length,
      specificResponses: 0,
      noInfoResponses: 0,
      possibleHallucinations: 0,
      avgResponseTimeMs: 0,
      qualityScore: 0,
    },
  };

  console.log('  [1/2] Creating session...');
  const sessionResult = await createSession(company.url);

  result.sessionCreation = {
    success: sessionResult.success,
    sessionId: sessionResult.data?.sessionId,
    companyNameDetected: sessionResult.data?.companyName,
    scrapingDurationMs: sessionResult.durationMs,
    error: sessionResult.error,
  };

  if (!sessionResult.success || !sessionResult.data) {
    console.log(`  ERROR: ${sessionResult.error}`);
    result.metrics.qualityScore = 0;
    return result;
  }

  console.log(`  Session created in ${(sessionResult.durationMs / 1000).toFixed(1)}s`);
  console.log(`  Company detected: ${sessionResult.data.companyName}`);

  const systemPrompt = sessionResult.data.systemPrompt;
  result.systemPromptExcerpt = systemPrompt.slice(0, 2000);

  const modelsExtracted = extractModelsFromSystemPrompt(systemPrompt);
  const whatsApp = extractWhatsAppFromSystemPrompt(systemPrompt);

  result.scraping = {
    modelsExtracted,
    modelsCount: modelsExtracted.length,
    hasWhatsApp: !!whatsApp,
    whatsAppNumber: whatsApp,
    hasInstagram: systemPrompt.toLowerCase().includes('instagram'),
  };

  console.log(`  Models extracted: ${modelsExtracted.length}`);
  console.log(`  WhatsApp found: ${whatsApp || 'NO'}`);

  console.log('  [2/2] Running questions...');
  const history: { role: 'user' | 'assistant'; content: string }[] = [];
  let totalResponseTime = 0;

  if (sessionResult.data.welcomeMessage) {
    history.push({
      role: 'assistant',
      content: sessionResult.data.welcomeMessage,
    });
  }

  for (let i = 0; i < STANDARD_QUESTIONS.length; i++) {
    const q = STANDARD_QUESTIONS[i];
    console.log(`    [${i + 1}/${STANDARD_QUESTIONS.length}] ${q.id}: "${q.text.slice(0, 40)}..."`);

    const chatResult = await sendChatMessage(
      sessionResult.data.sessionId,
      systemPrompt,
      q.text,
      history,
      sessionResult.data.companyName
    );

    if (!chatResult.success) {
      console.log(`      ERROR: ${chatResult.error}`);
      result.conversations.push({
        question: q.text,
        questionId: q.id,
        response: `ERROR: ${chatResult.error}`,
        responseDurationMs: chatResult.durationMs,
        analysis: {
          hasSpecificInfo: false,
          saidNoInfo: false,
          possibleHallucination: false,
          redFlags: [`Error: ${chatResult.error}`],
        },
      });
      continue;
    }

    const response = chatResult.response || '';
    totalResponseTime += chatResult.durationMs;

    history.push({ role: 'user', content: q.text });
    history.push({ role: 'assistant', content: response });

    const analysis = analyzeResponse(q.text, response, q.detectsHallucination);

    result.conversations.push({
      question: q.text,
      questionId: q.id,
      response,
      responseDurationMs: chatResult.durationMs,
      analysis,
    });

    if (analysis.hasSpecificInfo) result.metrics.specificResponses++;
    if (analysis.saidNoInfo) result.metrics.noInfoResponses++;
    if (analysis.possibleHallucination) result.metrics.possibleHallucinations++;

    const status = analysis.hasSpecificInfo
      ? (analysis.possibleHallucination ? 'WARN' : 'OK')
      : 'NO_INFO';
    console.log(`      ${status} (${chatResult.durationMs}ms)`);

    await delay(CONFIG.DELAY_BETWEEN_QUESTIONS_MS);
  }

  result.metrics.avgResponseTimeMs = Math.round(totalResponseTime / STANDARD_QUESTIONS.length);
  result.metrics.qualityScore = calculateQualityScore(result);

  console.log(`\n  Quality Score: ${result.metrics.qualityScore}%`);
  console.log(`  Specific: ${result.metrics.specificResponses}/${result.metrics.totalQuestions}`);
  console.log(`  No Info: ${result.metrics.noInfoResponses}/${result.metrics.totalQuestions}`);
  console.log(`  Hallucinations: ${result.metrics.possibleHallucinations}/${result.metrics.totalQuestions}`);

  return result;
}

async function generateReport(results: CompanyTestResult[], companies: {
  problematicas: TestCompany[];
  aleatorias: TestCompany[];
}): Promise<BaselineReport> {
  const successfulResults = results.filter(r => r.sessionCreation.success);

  const problematicasResults = results.filter(r =>
    companies.problematicas.some(c => c.url === r.company.url)
  );
  const aleatoriasResults = results.filter(r =>
    companies.aleatorias.some(c => c.url === r.company.url)
  );

  const avgQualityScore = successfulResults.length > 0
    ? successfulResults.reduce((a, b) => a + b.metrics.qualityScore, 0) / successfulResults.length
    : 0;

  const avgScrapingTime = successfulResults.length > 0
    ? successfulResults.reduce((a, b) => a + b.sessionCreation.scrapingDurationMs, 0) / successfulResults.length
    : 0;

  const totalModels = successfulResults.reduce((a, b) => a + b.scraping.modelsCount, 0);

  const whatsAppCount = successfulResults.filter(r => r.scraping.hasWhatsApp).length;

  const totalQuestions = successfulResults.reduce((a, b) => a + b.metrics.totalQuestions, 0);
  const noInfoCount = successfulResults.reduce((a, b) => a + b.metrics.noInfoResponses, 0);
  const hallucinationCount = successfulResults.reduce((a, b) => a + b.metrics.possibleHallucinations, 0);

  const findCommonIssues = (categoryResults: CompanyTestResult[]): string[] => {
    const issues: string[] = [];
    const successCategoryResults = categoryResults.filter(r => r.sessionCreation.success);

    if (successCategoryResults.length === 0) return issues;

    const noInfoRate = successCategoryResults.filter(r =>
      r.metrics.noInfoResponses > r.metrics.totalQuestions * 0.5
    ).length / successCategoryResults.length;

    if (noInfoRate > 0.3) issues.push('Alta tasa de respuestas sin info especifica');

    const hallucinationRate = successCategoryResults.filter(r =>
      r.metrics.possibleHallucinations > 0
    ).length / successCategoryResults.length;

    if (hallucinationRate > 0.2) issues.push('Posibles alucinaciones detectadas');

    const noWhatsAppRate = successCategoryResults.filter(r => !r.scraping.hasWhatsApp).length / successCategoryResults.length;
    if (noWhatsAppRate > 0.5) issues.push('Baja extraccion de WhatsApp');

    return issues;
  };

  const recommendations: string[] = [];

  if (avgQualityScore < 50) {
    recommendations.push('CRITICO: Score promedio bajo - revisar scraping y prompt generation');
  }
  if (successfulResults.length > 0 && whatsAppCount / successfulResults.length < 0.3) {
    recommendations.push('Implementar mejoras en extraccion de WhatsApp (FASE 2.3)');
  }
  if (totalQuestions > 0 && noInfoCount / totalQuestions > 0.25) {
    recommendations.push('Implementar RAG/keyword search para reducir respuestas sin info (FASE 3)');
  }
  if (totalQuestions > 0 && hallucinationCount / totalQuestions > 0.1) {
    recommendations.push('Implementar validador de respuestas anti-alucinacion (FASE 3.3)');
  }

  const successProblematicas = problematicasResults.filter(r => r.sessionCreation.success);
  const successAleatorias = aleatoriasResults.filter(r => r.sessionCreation.success);

  return {
    metadata: {
      version: '1.0',
      createdAt: new Date().toISOString(),
      environment: CONFIG.BASE_URL.includes('localhost') ? 'local' : 'production',
      baseUrl: CONFIG.BASE_URL,
    },
    summary: {
      totalCompanies: results.length,
      successfulSessions: successfulResults.length,
      failedSessions: results.length - successfulResults.length,
      avgQualityScore: Math.round(avgQualityScore * 10) / 10,
      avgScrapingTimeMs: Math.round(avgScrapingTime),
      totalModelsExtracted: totalModels,
      whatsAppExtractionRate: successfulResults.length > 0
        ? Math.round((whatsAppCount / successfulResults.length) * 100) / 100
        : 0,
      noInfoResponseRate: totalQuestions > 0
        ? Math.round((noInfoCount / totalQuestions) * 100) / 100
        : 0,
      hallucinationRate: totalQuestions > 0
        ? Math.round((hallucinationCount / totalQuestions) * 100) / 100
        : 0,
    },
    byCategory: {
      problematicas: {
        count: problematicasResults.length,
        avgScore: successProblematicas.length > 0
          ? Math.round(successProblematicas.reduce((a, b) => a + b.metrics.qualityScore, 0) / successProblematicas.length)
          : 0,
        commonIssues: findCommonIssues(problematicasResults),
      },
      aleatorias: {
        count: aleatoriasResults.length,
        avgScore: successAleatorias.length > 0
          ? Math.round(successAleatorias.reduce((a, b) => a + b.metrics.qualityScore, 0) / successAleatorias.length)
          : 0,
        commonIssues: findCommonIssues(aleatoriasResults),
      },
    },
    results,
    recommendations,
  };
}

// ============================================
// MAIN
// ============================================

async function main(): Promise<void> {
  // Parsear argumento --output=SUFFIX
  const outputArg = process.argv.find(a => a.startsWith('--output='));
  const outputSuffix = outputArg ? outputArg.split('=')[1] : 'baseline';

  console.log('='.repeat(60));
  console.log('QA BASELINE - FASE 1');
  console.log(`Fecha: ${new Date().toISOString()}`);
  console.log(`Base URL: ${CONFIG.BASE_URL}`);
  console.log(`Output suffix: ${outputSuffix}`);
  console.log('='.repeat(60));

  const companiesPath = path.join(__dirname, 'test-companies.json');

  if (!fs.existsSync(companiesPath)) {
    console.error(`ERROR: No se encontro ${companiesPath}`);
    console.log('Crea el archivo test-companies.json primero');
    process.exit(1);
  }

  const companiesData = JSON.parse(fs.readFileSync(companiesPath, 'utf-8'));
  const allCompanies: TestCompany[] = [
    ...companiesData.companies.problematicas,
    ...companiesData.companies.aleatorias,
  ];

  console.log(`\nEmpresas a testear: ${allCompanies.length}`);
  console.log(`  - Problematicas: ${companiesData.companies.problematicas.length}`);
  console.log(`  - Aleatorias: ${companiesData.companies.aleatorias.length}`);
  console.log(`Preguntas por empresa: ${STANDARD_QUESTIONS.length}`);

  console.log('\nVerificando servidor...');
  try {
    const response = await fetch(`${CONFIG.BASE_URL}`, { method: 'HEAD' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    console.log('Servidor OK');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    console.error(`ERROR: No se puede conectar a ${CONFIG.BASE_URL}`);
    console.log('Asegurate de ejecutar: npm run dev');
    process.exit(1);
  }

  const results: CompanyTestResult[] = [];

  for (let i = 0; i < allCompanies.length; i++) {
    console.log(`\n[${i + 1}/${allCompanies.length}]`);

    const result = await testCompany(allCompanies[i]);
    results.push(result);

    if (i < allCompanies.length - 1) {
      console.log(`\nEsperando ${CONFIG.DELAY_BETWEEN_COMPANIES_MS / 1000}s antes de la siguiente empresa...`);
      await delay(CONFIG.DELAY_BETWEEN_COMPANIES_MS);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('GENERANDO REPORTE');
  console.log('='.repeat(60));

  const report = await generateReport(results, companiesData.companies);

  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const reportPath = path.join(logsDir, `qa-baseline-${outputSuffix}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\nReporte guardado en: ${reportPath}`);

  console.log('\n' + '='.repeat(60));
  console.log('RESUMEN FINAL');
  console.log('='.repeat(60));
  console.log(`\nEmpresas testeadas: ${report.summary.totalCompanies}`);
  console.log(`  - Exitosas: ${report.summary.successfulSessions}`);
  console.log(`  - Fallidas: ${report.summary.failedSessions}`);
  console.log(`\nScore promedio: ${report.summary.avgQualityScore}%`);
  console.log(`Tiempo promedio scraping: ${(report.summary.avgScrapingTimeMs / 1000).toFixed(1)}s`);
  console.log(`Total modelos extraidos: ${report.summary.totalModelsExtracted}`);
  console.log(`\nTasas:`);
  console.log(`  - Extraccion WhatsApp: ${(report.summary.whatsAppExtractionRate * 100).toFixed(0)}%`);
  console.log(`  - Respuestas "no tengo info": ${(report.summary.noInfoResponseRate * 100).toFixed(0)}%`);
  console.log(`  - Posibles alucinaciones: ${(report.summary.hallucinationRate * 100).toFixed(0)}%`);

  console.log(`\nPor categoria:`);
  console.log(`  Problematicas: ${report.byCategory.problematicas.avgScore}% promedio`);
  console.log(`  Aleatorias: ${report.byCategory.aleatorias.avgScore}% promedio`);

  if (report.recommendations.length > 0) {
    console.log(`\nRecomendaciones:`);
    for (const rec of report.recommendations) {
      console.log(`  - ${rec}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('FIN DEL BASELINE');
  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});
