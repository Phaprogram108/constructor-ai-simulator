# Spec FASE 1: Diagnostico y QA Inicial

## Objetivo

Establecer un baseline de rendimiento con 20 empresas del "nuevo master" del phascraper para medir el estado actual del sistema antes de implementar mejoras.

---

## Resumen Ejecutivo

La FASE 1 consiste en crear un script de QA automatizado que:
1. Lea una lista de 20 empresas (10 problematicas + 10 aleatorias)
2. Cree sesiones del simulador para cada una
3. Ejecute 5 preguntas estandar
4. Capture metricas detalladas
5. Genere un reporte JSON con el baseline

---

## Analisis del Codebase Existente

### Archivos Relevantes Ya Existentes

| Archivo | Proposito | Reutilizable |
|---------|-----------|--------------|
| `scripts/test-20-empresas-qa.ts` | Script QA existente (380 lineas) | SI - base para qa-baseline.ts |
| `scripts/qa-chat-test.ts` | Tests de chat estandarizados | SI - patrones de comunicacion |
| `src/app/api/simulator/create/route.ts` | Endpoint de creacion | Referencia para tipos |
| `src/app/api/chat/route.ts` | Endpoint de chat | Referencia para comunicacion |
| `src/types/index.ts` | Tipos TypeScript | Extender con nuevos tipos |

### Estructura de Respuesta de /api/simulator/create

```typescript
// POST /api/simulator/create
// Body: { websiteUrl: string, pdfUrl?: string }
// Response:
{
  sessionId: string;
  companyName: string;
  welcomeMessage: string;
  messagesRemaining: number;
  systemPrompt: string;  // IMPORTANTE: incluido para chat client-side
}
```

### Estructura de Respuesta de /api/chat

```typescript
// POST /api/chat
// Body:
{
  sessionId: string;
  message: string;
  systemPrompt: string;
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
  companyName?: string;
}
// Response:
{
  message: string;
}
```

### Logs Actuales

Los logs se guardan en `logs/conversations/` con formato:
```
TIMESTAMP_COMPANY_NAME.txt
```

El script qa-baseline.ts guardara en:
```
logs/qa-baseline-YYYY-MM-DD.json
```

---

## Archivos a Crear

### 1. `src/scripts/test-companies.json`

**Ubicacion**: `/Users/joaquingonzalez/Documents/dev/constructor-ai-simulator/src/scripts/test-companies.json`

```json
{
  "version": "1.0",
  "createdAt": "2026-02-04",
  "description": "Lista de empresas para QA baseline - FASE 1",
  "companies": {
    "problematicas": [
      {
        "name": "Atlas Housing",
        "url": "https://atlashousing.com.ar",
        "knownIssue": "Info falsa sobre modelos - inventa datos",
        "expectedModels": ["Casa 1", "Casa 2"]
      },
      {
        "name": "Habitatio",
        "url": "https://habitatio.com.ar",
        "knownIssue": "Info parcial del modelo Flex - scraping incompleto",
        "expectedModels": ["Flex"]
      },
      {
        "name": "ViBert",
        "url": "https://vibert.com.ar",
        "knownIssue": "Modelos en linktree - no extrae de links externos",
        "expectedModels": ["Casa Sara", "Casa Maria", "Casa Elena"]
      },
      {
        "name": "Ecomod",
        "url": "https://ecomod.com.ar/",
        "knownIssue": "Sin WhatsApp extraido aunque lo tiene",
        "expectedModels": []
      },
      {
        "name": "Movilhauss",
        "url": "https://movilhauss.com",
        "knownIssue": "Respuestas genericas - no tengo esa info",
        "expectedModels": []
      },
      {
        "name": "PlugArq",
        "url": "https://www.plugarq.com/",
        "knownIssue": "SPA pesada - timeout frecuente",
        "expectedModels": []
      },
      {
        "name": "Lucys House",
        "url": "https://www.lucyshousearg.com/",
        "knownIssue": "Precios inventados",
        "expectedModels": []
      },
      {
        "name": "Sienna Modular",
        "url": "https://www.siennamodular.com.ar/",
        "knownIssue": "Modelos con nombres genericos",
        "expectedModels": []
      },
      {
        "name": "Grupo Steimberg",
        "url": "https://www.gruposteimberg.com/",
        "knownIssue": "Es tradicional, no modular - clasificacion incorrecta",
        "expectedModels": []
      },
      {
        "name": "T1 Modular",
        "url": "https://www.t1modular.com.ar/",
        "knownIssue": "FAQ no expandido - info oculta",
        "expectedModels": []
      }
    ],
    "aleatorias": [
      {
        "name": "Habika",
        "url": "https://habika.ar/",
        "notes": "Del master phascraper"
      },
      {
        "name": "Arcohouse",
        "url": "https://arcohouse.com.ar/",
        "notes": "Del master phascraper"
      },
      {
        "name": "Wellmod",
        "url": "https://www.wellmod.com.ar/",
        "notes": "Del master phascraper"
      },
      {
        "name": "Mini Casas",
        "url": "https://www.minicasas.com.ar/",
        "notes": "Del master phascraper"
      },
      {
        "name": "Offis",
        "url": "https://www.offis.ar/",
        "notes": "Del master phascraper"
      },
      {
        "name": "Efede",
        "url": "https://efede.com.ar/casas-modulares/",
        "notes": "Del master phascraper"
      },
      {
        "name": "GoHome",
        "url": "https://gohomeconstrucciones.com.ar/",
        "notes": "Del master phascraper"
      },
      {
        "name": "Aftamantes",
        "url": "https://aftamantes.net/refugios/",
        "notes": "Del master phascraper"
      },
      {
        "name": "Arqtainer",
        "url": "https://arqtainer.com.ar/",
        "notes": "Del master phascraper"
      },
      {
        "name": "Lista",
        "url": "https://lista.com.ar/",
        "notes": "Del master phascraper"
      }
    ]
  }
}
```

---

### 2. `src/scripts/qa-baseline.ts`

**Ubicacion**: `/Users/joaquingonzalez/Documents/dev/constructor-ai-simulator/src/scripts/qa-baseline.ts`

**Dependencias**: Ninguna nueva (usa node nativo + existentes)

**Estructura del archivo**:

```typescript
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
    qualityScore: number;  // 0-100
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
    whatsAppExtractionRate: number;  // 0-1
    noInfoResponseRate: number;       // 0-1
    hallucinationRate: number;        // 0-1
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
  TIMEOUT_SESSION_MS: 120000,  // 2 min para scraping
  TIMEOUT_CHAT_MS: 30000,      // 30s para respuesta
};

// Preguntas estandar para el baseline
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
  // Buscar seccion de modelos
  const modelsSection = systemPrompt.match(/## MODELOS DISPONIBLES[\s\S]*?(?=##|$)/i);
  if (!modelsSection) return [];

  // Extraer items de lista
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

  // Detectar "no tengo info"
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

  // Detectar info especifica
  const hasNumbers = /\d+\s*(m²|m2|metros|usd|\$|dormitorio|bano)/i.test(response);
  const hasModelNames = /\b(modelo|casa|vivienda)\s+[A-Z0-9]/i.test(response);
  const hasPhoneNumber = /(\+?54|011|15|0800)[\s\-]?[\d\s\-]{6,}/i.test(response);
  const hasSpecificInfo = hasNumbers || hasModelNames || hasPhoneNumber;

  // Detectar posibles alucinaciones
  let possibleHallucination = false;

  if (detectsHallucination) {
    // Precios muy redondos
    const roundPrices = response.match(/USD?\s*([\d,.]+)/gi) || [];
    for (const price of roundPrices) {
      const num = parseFloat(price.replace(/[^\d.]/g, ''));
      if (num > 0 && num % 10000 === 0 && num >= 50000) {
        redFlags.push(`Precio muy redondo sospechoso: ${price}`);
        possibleHallucination = true;
      }
    }

    // Nombres de modelos genericos
    const genericModelNames = ['modelo a', 'modelo b', 'modelo c', 'casa tipo'];
    for (const name of genericModelNames) {
      if (responseLower.includes(name)) {
        redFlags.push(`Nombre de modelo generico: ${name}`);
        possibleHallucination = true;
      }
    }

    // Contradictorio: dice no tener info pero da datos
    if (saidNoInfo && hasSpecificInfo) {
      redFlags.push('Contradictorio: dice no tener info pero da datos');
    }
  }

  return { hasSpecificInfo, saidNoInfo, possibleHallucination, redFlags };
}

function calculateQualityScore(result: CompanyTestResult): number {
  const { metrics } = result;

  // Ponderacion:
  // - 40% respuestas con info especifica
  // - 30% sin alucinaciones
  // - 20% WhatsApp extraido
  // - 10% tiempo de respuesta razonable

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

  // 1. Crear sesion
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

  // 2. Extraer info del system prompt
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

  // 3. Ejecutar preguntas
  console.log('  [2/2] Running questions...');
  const history: { role: 'user' | 'assistant'; content: string }[] = [];
  let totalResponseTime = 0;

  // Agregar welcome message al historial
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

    // Actualizar historial
    history.push({ role: 'user', content: q.text });
    history.push({ role: 'assistant', content: response });

    // Analizar respuesta
    const analysis = analyzeResponse(q.text, response, q.detectsHallucination);

    result.conversations.push({
      question: q.text,
      questionId: q.id,
      response,
      responseDurationMs: chatResult.durationMs,
      analysis,
    });

    // Actualizar metricas
    if (analysis.hasSpecificInfo) result.metrics.specificResponses++;
    if (analysis.saidNoInfo) result.metrics.noInfoResponses++;
    if (analysis.possibleHallucination) result.metrics.possibleHallucinations++;

    // Log resultado
    const status = analysis.hasSpecificInfo
      ? (analysis.possibleHallucination ? 'WARN' : 'OK')
      : 'NO_INFO';
    console.log(`      ${status} (${chatResult.durationMs}ms)`);

    await delay(CONFIG.DELAY_BETWEEN_QUESTIONS_MS);
  }

  // 4. Calcular metricas finales
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

  // Separar por categoria
  const problematicasResults = results.filter(r =>
    companies.problematicas.some(c => c.url === r.company.url)
  );
  const aleatoriasResults = results.filter(r =>
    companies.aleatorias.some(c => c.url === r.company.url)
  );

  // Calcular metricas
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

  // Identificar issues comunes
  const findCommonIssues = (categoryResults: CompanyTestResult[]): string[] => {
    const issues: string[] = [];
    const noInfoRate = categoryResults.filter(r =>
      r.metrics.noInfoResponses > r.metrics.totalQuestions * 0.5
    ).length / categoryResults.length;

    if (noInfoRate > 0.3) issues.push('Alta tasa de respuestas sin info especifica');

    const hallucinationRate = categoryResults.filter(r =>
      r.metrics.possibleHallucinations > 0
    ).length / categoryResults.length;

    if (hallucinationRate > 0.2) issues.push('Posibles alucinaciones detectadas');

    const noWhatsAppRate = categoryResults.filter(r => !r.scraping.hasWhatsApp).length / categoryResults.length;
    if (noWhatsAppRate > 0.5) issues.push('Baja extraccion de WhatsApp');

    return issues;
  };

  // Generar recomendaciones
  const recommendations: string[] = [];

  if (avgQualityScore < 50) {
    recommendations.push('CRITICO: Score promedio bajo - revisar scraping y prompt generation');
  }
  if (whatsAppCount / successfulResults.length < 0.3) {
    recommendations.push('Implementar mejoras en extraccion de WhatsApp (FASE 2.3)');
  }
  if (noInfoCount / totalQuestions > 0.25) {
    recommendations.push('Implementar RAG/keyword search para reducir respuestas sin info (FASE 3)');
  }
  if (hallucinationCount / totalQuestions > 0.1) {
    recommendations.push('Implementar validador de respuestas anti-alucinacion (FASE 3.3)');
  }

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
      whatsAppExtractionRate: Math.round((whatsAppCount / successfulResults.length) * 100) / 100,
      noInfoResponseRate: Math.round((noInfoCount / totalQuestions) * 100) / 100,
      hallucinationRate: Math.round((hallucinationCount / totalQuestions) * 100) / 100,
    },
    byCategory: {
      problematicas: {
        count: problematicasResults.length,
        avgScore: problematicasResults.length > 0
          ? Math.round(problematicasResults.reduce((a, b) => a + b.metrics.qualityScore, 0) / problematicasResults.length)
          : 0,
        commonIssues: findCommonIssues(problematicasResults),
      },
      aleatorias: {
        count: aleatoriasResults.length,
        avgScore: aleatoriasResults.length > 0
          ? Math.round(aleatoriasResults.reduce((a, b) => a + b.metrics.qualityScore, 0) / aleatoriasResults.length)
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
  console.log('='.repeat(60));
  console.log('QA BASELINE - FASE 1');
  console.log(`Fecha: ${new Date().toISOString()}`);
  console.log(`Base URL: ${CONFIG.BASE_URL}`);
  console.log('='.repeat(60));

  // Cargar empresas
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

  // Verificar servidor
  console.log('\nVerificando servidor...');
  try {
    const response = await fetch(`${CONFIG.BASE_URL}`, { method: 'HEAD' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    console.log('Servidor OK');
  } catch (error) {
    console.error(`ERROR: No se puede conectar a ${CONFIG.BASE_URL}`);
    console.log('Asegurate de ejecutar: npm run dev');
    process.exit(1);
  }

  // Testear empresas
  const results: CompanyTestResult[] = [];

  for (let i = 0; i < allCompanies.length; i++) {
    console.log(`\n[${ i + 1}/${allCompanies.length}]`);

    const result = await testCompany(allCompanies[i]);
    results.push(result);

    if (i < allCompanies.length - 1) {
      console.log(`\nEsperando ${CONFIG.DELAY_BETWEEN_COMPANIES_MS / 1000}s antes de la siguiente empresa...`);
      await delay(CONFIG.DELAY_BETWEEN_COMPANIES_MS);
    }
  }

  // Generar reporte
  console.log('\n' + '='.repeat(60));
  console.log('GENERANDO REPORTE');
  console.log('='.repeat(60));

  const report = await generateReport(results, companiesData.companies);

  // Guardar reporte
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(logsDir, `qa-baseline-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\nReporte guardado en: ${reportPath}`);

  // Imprimir resumen
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
```

---

## Metricas a Capturar

### Por Empresa

| Metrica | Tipo | Descripcion |
|---------|------|-------------|
| `scrapingDurationMs` | number | Tiempo de scraping en ms |
| `modelsCount` | number | Cantidad de modelos extraidos |
| `modelsExtracted` | string[] | Lista de modelos extraidos |
| `hasWhatsApp` | boolean | Si se extrajo WhatsApp |
| `whatsAppNumber` | string | Numero de WhatsApp extraido |
| `specificResponses` | number | Respuestas con info especifica |
| `noInfoResponses` | number | Respuestas "no tengo info" |
| `possibleHallucinations` | number | Respuestas sospechosas |
| `avgResponseTimeMs` | number | Tiempo promedio de respuesta |
| `qualityScore` | number | Score de calidad 0-100 |

### Global (Summary)

| Metrica | Formula | Objetivo FASE 1 |
|---------|---------|-----------------|
| `avgQualityScore` | Promedio de qualityScore | Baseline (medir) |
| `whatsAppExtractionRate` | empresas_con_wa / total | >5% (actual estimado) |
| `noInfoResponseRate` | no_info / total_questions | <30% (actual estimado ~30%) |
| `hallucinationRate` | hallucinations / total | <5% (desconocido) |
| `avgScrapingTimeMs` | Promedio scraping | <20s |

---

## Ejecucion

### Prerequisitos

1. Servidor local corriendo: `npm run dev`
2. Variables de entorno configuradas (`.env.local`)
3. Archivo `test-companies.json` creado

### Comando

```bash
# Desde la raiz del proyecto
npx tsx src/scripts/qa-baseline.ts
```

### Output

```
logs/qa-baseline-2026-02-04.json
```

---

## Estructura del Reporte JSON

```json
{
  "metadata": {
    "version": "1.0",
    "createdAt": "2026-02-04T10:30:00.000Z",
    "environment": "local",
    "baseUrl": "http://localhost:3000"
  },
  "summary": {
    "totalCompanies": 20,
    "successfulSessions": 18,
    "failedSessions": 2,
    "avgQualityScore": 52.3,
    "avgScrapingTimeMs": 15400,
    "totalModelsExtracted": 45,
    "whatsAppExtractionRate": 0.15,
    "noInfoResponseRate": 0.28,
    "hallucinationRate": 0.08
  },
  "byCategory": {
    "problematicas": {
      "count": 10,
      "avgScore": 38,
      "commonIssues": ["Alta tasa de respuestas sin info especifica"]
    },
    "aleatorias": {
      "count": 10,
      "avgScore": 66,
      "commonIssues": []
    }
  },
  "results": [
    // Array de CompanyTestResult
  ],
  "recommendations": [
    "Implementar mejoras en extraccion de WhatsApp (FASE 2.3)",
    "Implementar RAG/keyword search para reducir respuestas sin info (FASE 3)"
  ]
}
```

---

## Validacion de Exito de FASE 1

La FASE 1 se considera exitosa cuando:

1. El script ejecuta sin errores criticos
2. Se obtiene baseline para al menos 15/20 empresas
3. Se genera el reporte JSON con todas las metricas
4. Se identifican las empresas problematicas vs las que funcionan bien

**Criterio de salida**: Tener un archivo `qa-baseline-YYYY-MM-DD.json` con metricas medibles para comparar despues de FASE 2-6.

---

## Siguiente Paso

Una vez completada FASE 1, usar `@coder` para implementar los archivos:
1. `src/scripts/test-companies.json`
2. `src/scripts/qa-baseline.ts`

Luego ejecutar y guardar el baseline antes de comenzar FASE 2.
