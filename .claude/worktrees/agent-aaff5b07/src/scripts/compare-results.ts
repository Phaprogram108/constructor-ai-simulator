/**
 * Compare Results Script - FASE 6
 *
 * Compara resultados de QA antes y despues de mejoras
 * Ejecutar: npx tsx src/scripts/compare-results.ts --before=logs/qa-baseline-before.json --after=logs/qa-baseline-after.json
 *
 * Output: logs/qa-comparison-YYYY-MM-DD.json + stdout
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================
// TIPOS
// ============================================

// Formato BaselineReport (generado por qa-baseline.ts)
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

interface CompanyTestResult {
  company: {
    name: string;
    url: string;
    knownIssue?: string;
    expectedModels?: string[];
    notes?: string;
  };
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

// Formato Simplificado (generado por scripts anteriores como qa-20-empresas)
interface SimplifiedReport {
  fecha: string;
  resumen: {
    totalEmpresas: number;
    exitosas: number;
    fallidas: number;
    scorePromedio: number;
    respuestasDudosas: number;
  };
  empresasPorScore: Array<{
    empresa: string;
    score: number;
    especificas: number;
    dudosas: number;
    scrapingTime: string;
  }>;
  respuestasDudosas: Array<{
    empresa: string;
    pregunta: string;
    respuesta: string;
    redFlags: string[];
  }>;
}

// Tipos para comparacion
interface CompanyComparison {
  company: string;
  url: string;
  before: {
    score: number;
    modelsCount: number;
    hasWhatsApp: boolean;
    noInfoResponses: number;
    possibleHallucinations: number;
    scrapingTimeMs: number;
  };
  after: {
    score: number;
    modelsCount: number;
    hasWhatsApp: boolean;
    noInfoResponses: number;
    possibleHallucinations: number;
    scrapingTimeMs: number;
  };
  delta: {
    scoreChange: number;
    scoreChangePercent: number;
    modelsChange: number;
    whatsAppGained: boolean;
    whatsAppLost: boolean;
    noInfoChange: number;
    hallucinationChange: number;
    scrapingTimeChange: number;
  };
  verdict: 'improved' | 'degraded' | 'unchanged';
}

interface SummaryComparison {
  before: {
    avgQualityScore: number;
    whatsAppExtractionRate: number;
    noInfoResponseRate: number;
    hallucinationRate: number;
    avgScrapingTimeMs: number;
    successfulSessions: number;
  };
  after: {
    avgQualityScore: number;
    whatsAppExtractionRate: number;
    noInfoResponseRate: number;
    hallucinationRate: number;
    avgScrapingTimeMs: number;
    successfulSessions: number;
  };
  delta: {
    avgScoreChange: number;
    avgScoreChangePercent: number;
    whatsAppRateChange: number;
    noInfoRateChange: number;
    hallucinationRateChange: number;
    scrapingTimeChange: number;
  };
  objectivesMet: {
    modelsExtraction: boolean;
    whatsAppExtraction: boolean;
    noInfoReduction: boolean;
    hallucinationReduction: boolean;
    scrapingTime: boolean;
  };
}

interface ComparisonReport {
  metadata: {
    version: string;
    createdAt: string;
    beforeFile: string;
    afterFile: string;
  };
  summary: SummaryComparison;
  companies: CompanyComparison[];
  topImprovements: CompanyComparison[];
  regressions: CompanyComparison[];
  recommendations: string[];
}

// Tipo normalizado para trabajar internamente
interface NormalizedReport {
  date: string;
  summary: {
    totalCompanies: number;
    successfulSessions: number;
    failedSessions: number;
    avgQualityScore: number;
    avgScrapingTimeMs: number;
    whatsAppExtractionRate: number;
    noInfoResponseRate: number;
    hallucinationRate: number;
  };
  companies: Array<{
    name: string;
    url: string;
    score: number;
    modelsCount: number;
    hasWhatsApp: boolean;
    noInfoResponses: number;
    possibleHallucinations: number;
    scrapingTimeMs: number;
  }>;
}

// ============================================
// FUNCIONES DE UTILIDAD
// ============================================

function isBaselineReport(data: unknown): data is BaselineReport {
  return (
    typeof data === 'object' &&
    data !== null &&
    'metadata' in data &&
    'summary' in data &&
    'results' in data
  );
}

function isSimplifiedReport(data: unknown): data is SimplifiedReport {
  return (
    typeof data === 'object' &&
    data !== null &&
    'fecha' in data &&
    'resumen' in data &&
    'empresasPorScore' in data
  );
}

function parseScrapingTime(timeStr: string): number {
  const match = timeStr.match(/([\d.]+)s/);
  return match ? parseFloat(match[1]) * 1000 : 0;
}

function normalizeReport(data: unknown, filePath: string): NormalizedReport | null {
  if (isBaselineReport(data)) {
    // Formato BaselineReport - usa datos pre-calculados del summary
    return {
      date: data.metadata.createdAt,
      summary: {
        totalCompanies: data.summary.totalCompanies,
        successfulSessions: data.summary.successfulSessions,
        failedSessions: data.summary.failedSessions,
        avgQualityScore: data.summary.avgQualityScore,
        avgScrapingTimeMs: data.summary.avgScrapingTimeMs,
        whatsAppExtractionRate: data.summary.whatsAppExtractionRate,
        noInfoResponseRate: data.summary.noInfoResponseRate,
        hallucinationRate: data.summary.hallucinationRate,
      },
      companies: data.results.map(r => ({
        name: r.company.name,
        url: r.company.url,
        score: r.metrics.qualityScore,
        modelsCount: r.scraping.modelsCount,
        hasWhatsApp: r.scraping.hasWhatsApp,
        noInfoResponses: r.metrics.noInfoResponses,
        possibleHallucinations: r.metrics.possibleHallucinations,
        scrapingTimeMs: r.sessionCreation.scrapingDurationMs,
      })),
    };
  }

  if (isSimplifiedReport(data)) {
    // Formato Simplificado - necesitamos estimar algunos valores
    const successCount = data.resumen.exitosas;
    const totalDudosas = data.resumen.respuestasDudosas;
    const totalQuestions = successCount * 5; // Asumimos 5 preguntas por empresa

    // Estimar metricas basadas en datos disponibles
    const avgScrapingTime = data.empresasPorScore.reduce((sum, e) => {
      return sum + parseScrapingTime(e.scrapingTime);
    }, 0) / data.empresasPorScore.length;

    // Contar empresas con WhatsApp (las que tienen score alto probablemente lo tengan)
    // Esta es una estimacion porque el formato simplificado no tiene este dato directamente
    const whatsAppCount = data.empresasPorScore.filter(e => e.score >= 70).length;

    return {
      date: data.fecha,
      summary: {
        totalCompanies: data.resumen.totalEmpresas,
        successfulSessions: data.resumen.exitosas,
        failedSessions: data.resumen.fallidas,
        avgQualityScore: data.resumen.scorePromedio,
        avgScrapingTimeMs: avgScrapingTime,
        whatsAppExtractionRate: successCount > 0 ? whatsAppCount / successCount : 0,
        noInfoResponseRate: totalQuestions > 0 ? totalDudosas / totalQuestions : 0,
        hallucinationRate: 0, // No disponible en formato simplificado
      },
      companies: data.empresasPorScore.map(e => ({
        name: e.empresa,
        url: '', // No disponible en formato simplificado
        score: e.score,
        modelsCount: 0, // No disponible
        hasWhatsApp: e.score >= 70, // Estimacion
        noInfoResponses: 5 - e.especificas, // Estimacion
        possibleHallucinations: e.dudosas,
        scrapingTimeMs: parseScrapingTime(e.scrapingTime),
      })),
    };
  }

  console.error(`ERROR: Formato de reporte no reconocido en ${filePath}`);
  return null;
}

function loadReport(filePath: string): NormalizedReport | null {
  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: No se encontro ${filePath}`);
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return normalizeReport(data, filePath);
  } catch (error) {
    console.error(`ERROR: No se pudo parsear ${filePath}:`, error);
    return null;
  }
}

function compareCompany(
  companyName: string,
  beforeCompanies: NormalizedReport['companies'],
  afterCompanies: NormalizedReport['companies']
): CompanyComparison | null {
  const before = beforeCompanies.find(c => c.name.toLowerCase() === companyName.toLowerCase());
  const after = afterCompanies.find(c => c.name.toLowerCase() === companyName.toLowerCase());

  if (!before || !after) return null;

  const scoreChange = after.score - before.score;
  const modelsChange = after.modelsCount - before.modelsCount;
  const noInfoChange = after.noInfoResponses - before.noInfoResponses;
  const hallucinationChange = after.possibleHallucinations - before.possibleHallucinations;
  const scrapingTimeChange = after.scrapingTimeMs - before.scrapingTimeMs;

  // Determinar veredicto
  let verdict: 'improved' | 'degraded' | 'unchanged' = 'unchanged';
  if (scoreChange > 5) verdict = 'improved';
  if (scoreChange < -5) verdict = 'degraded';

  return {
    company: before.name,
    url: before.url || after.url || '',
    before: {
      score: before.score,
      modelsCount: before.modelsCount,
      hasWhatsApp: before.hasWhatsApp,
      noInfoResponses: before.noInfoResponses,
      possibleHallucinations: before.possibleHallucinations,
      scrapingTimeMs: before.scrapingTimeMs,
    },
    after: {
      score: after.score,
      modelsCount: after.modelsCount,
      hasWhatsApp: after.hasWhatsApp,
      noInfoResponses: after.noInfoResponses,
      possibleHallucinations: after.possibleHallucinations,
      scrapingTimeMs: after.scrapingTimeMs,
    },
    delta: {
      scoreChange,
      scoreChangePercent: before.score > 0 ? (scoreChange / before.score) * 100 : 0,
      modelsChange,
      whatsAppGained: !before.hasWhatsApp && after.hasWhatsApp,
      whatsAppLost: before.hasWhatsApp && !after.hasWhatsApp,
      noInfoChange,
      hallucinationChange,
      scrapingTimeChange,
    },
    verdict,
  };
}

function checkObjectivesMet(summary: SummaryComparison): SummaryComparison['objectivesMet'] {
  return {
    // Objetivo: >90% modelos correctos (aproximado por score >= 70)
    modelsExtraction: summary.after.avgQualityScore >= 70,
    // Objetivo: >50% WhatsApp encontrado
    whatsAppExtraction: summary.after.whatsAppExtractionRate >= 0.5,
    // Objetivo: <10% respuestas "no tengo info"
    noInfoReduction: summary.after.noInfoResponseRate <= 0.1,
    // Objetivo: <5% alucinaciones
    hallucinationReduction: summary.after.hallucinationRate <= 0.05,
    // Objetivo: <20s tiempo de scraping
    scrapingTime: summary.after.avgScrapingTimeMs <= 20000,
  };
}

function generateRecommendations(report: ComparisonReport): string[] {
  const recs: string[] = [];

  // Analizar objetivos no cumplidos
  if (!report.summary.objectivesMet.whatsAppExtraction) {
    recs.push('WhatsApp extraction aun bajo objetivo (50%). Revisar linktree explorer y patrones de extraccion.');
  }
  if (!report.summary.objectivesMet.noInfoReduction) {
    recs.push('Tasa de "no tengo info" aun alta. Considerar RAG con embeddings (Fase 3.2 opcional).');
  }
  if (!report.summary.objectivesMet.hallucinationReduction) {
    recs.push('Alucinaciones detectadas siguen altas. Reforzar response-validator.');
  }
  if (!report.summary.objectivesMet.scrapingTime) {
    recs.push('Tiempo de scraping alto. Evaluar cache o paralelizacion.');
  }

  // Analizar regresiones
  if (report.regressions.length > 0) {
    recs.push(`ATENCION: ${report.regressions.length} empresas empeoraron. Revisar: ${report.regressions.map(r => r.company).join(', ')}`);
  }

  // Analizar mejoras
  if (report.summary.delta.avgScoreChange > 10) {
    recs.push(`EXCELENTE: Score promedio mejoro ${report.summary.delta.avgScoreChange.toFixed(1)} puntos.`);
  }

  // Exito total
  const allMet = Object.values(report.summary.objectivesMet).every(v => v);
  if (allMet) {
    recs.push('EXITO: Todos los objetivos cumplidos. Sistema listo para produccion.');
  }

  return recs;
}

function printSummary(report: ComparisonReport): void {
  console.log('\n' + '='.repeat(60));
  console.log('RESUMEN DE COMPARACION');
  console.log('='.repeat(60));

  const { before, after, delta } = report.summary;

  console.log('\n--- METRICAS GLOBALES ---');
  console.log(`Score Promedio:     ${before.avgQualityScore.toFixed(1)}% -> ${after.avgQualityScore.toFixed(1)}%  (${delta.avgScoreChange >= 0 ? '+' : ''}${delta.avgScoreChange.toFixed(1)} pts)`);
  console.log(`WhatsApp Rate:      ${(before.whatsAppExtractionRate * 100).toFixed(0)}% -> ${(after.whatsAppExtractionRate * 100).toFixed(0)}%  (${delta.whatsAppRateChange >= 0 ? '+' : ''}${(delta.whatsAppRateChange * 100).toFixed(0)} pts)`);
  console.log(`No Info Rate:       ${(before.noInfoResponseRate * 100).toFixed(0)}% -> ${(after.noInfoResponseRate * 100).toFixed(0)}%  (${delta.noInfoRateChange >= 0 ? '+' : ''}${(delta.noInfoRateChange * 100).toFixed(0)} pts)`);
  console.log(`Hallucination Rate: ${(before.hallucinationRate * 100).toFixed(0)}% -> ${(after.hallucinationRate * 100).toFixed(0)}%  (${delta.hallucinationRateChange >= 0 ? '+' : ''}${(delta.hallucinationRateChange * 100).toFixed(0)} pts)`);
  console.log(`Scraping Time:      ${(before.avgScrapingTimeMs / 1000).toFixed(1)}s -> ${(after.avgScrapingTimeMs / 1000).toFixed(1)}s  (${delta.scrapingTimeChange >= 0 ? '+' : ''}${(delta.scrapingTimeChange / 1000).toFixed(1)}s)`);

  console.log('\n--- OBJETIVOS ---');
  const objectives = report.summary.objectivesMet;
  console.log(`Score >=70%:        ${objectives.modelsExtraction ? 'CUMPLIDO' : 'PENDIENTE'}`);
  console.log(`WhatsApp >50%:      ${objectives.whatsAppExtraction ? 'CUMPLIDO' : 'PENDIENTE'}`);
  console.log(`No Info <10%:       ${objectives.noInfoReduction ? 'CUMPLIDO' : 'PENDIENTE'}`);
  console.log(`Hallucinations <5%: ${objectives.hallucinationReduction ? 'CUMPLIDO' : 'PENDIENTE'}`);
  console.log(`Scraping <20s:      ${objectives.scrapingTime ? 'CUMPLIDO' : 'PENDIENTE'}`);

  console.log('\n--- EMPRESAS ---');
  const improved = report.companies.filter(c => c.verdict === 'improved').length;
  const degraded = report.companies.filter(c => c.verdict === 'degraded').length;
  const unchanged = report.companies.filter(c => c.verdict === 'unchanged').length;
  console.log(`Mejoraron:  ${improved}`);
  console.log(`Empeoraron: ${degraded}`);
  console.log(`Sin cambio: ${unchanged}`);

  if (report.topImprovements.length > 0) {
    console.log('\n--- TOP MEJORAS ---');
    for (const c of report.topImprovements) {
      console.log(`  ${c.company}: ${c.before.score}% -> ${c.after.score}% (+${c.delta.scoreChange})`);
    }
  }

  if (report.regressions.length > 0) {
    console.log('\n--- REGRESIONES ---');
    for (const c of report.regressions) {
      console.log(`  ${c.company}: ${c.before.score}% -> ${c.after.score}% (${c.delta.scoreChange})`);
    }
  }

  if (report.recommendations.length > 0) {
    console.log('\n--- RECOMENDACIONES ---');
    for (const rec of report.recommendations) {
      console.log(`  - ${rec}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('FIN DE COMPARACION');
  console.log('='.repeat(60));
}

function showHelp(): void {
  console.log(`
Compare Results Script - FASE 6

Compara dos reportes de QA para medir mejoras entre versiones.

USO:
  npx tsx src/scripts/compare-results.ts --before=FILE --after=FILE

ARGUMENTOS:
  --before=FILE   Archivo JSON con el baseline inicial (antes de mejoras)
  --after=FILE    Archivo JSON con el baseline final (despues de mejoras)
  --help          Muestra esta ayuda

EJEMPLOS:
  # Comparar baseline antes y despues de mejoras
  npx tsx src/scripts/compare-results.ts \\
    --before=logs/qa-baseline-before.json \\
    --after=logs/qa-baseline-after.json

  # Test rapido comparando el mismo archivo (deberia dar 0 cambios)
  npx tsx src/scripts/compare-results.ts \\
    --before=logs/qa-baseline-before.json \\
    --after=logs/qa-baseline-before.json

FORMATOS SOPORTADOS:
  - BaselineReport (generado por qa-baseline.ts)
  - Formato simplificado (generado por qa-20-empresas.ts)

OUTPUT:
  - logs/qa-comparison-YYYY-MM-DD.json (reporte completo)
  - stdout (resumen legible)
`);
}

// ============================================
// MAIN
// ============================================

async function main(): Promise<void> {
  // Verificar --help
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  console.log('='.repeat(60));
  console.log('COMPARACION QA - FASE 6');
  console.log(`Fecha: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  // Parsear argumentos
  const beforeArg = process.argv.find(a => a.startsWith('--before='))?.split('=')[1];
  const afterArg = process.argv.find(a => a.startsWith('--after='))?.split('=')[1];

  if (!beforeArg || !afterArg) {
    console.error('\nERROR: Faltan argumentos requeridos.');
    console.log('Uso: npx tsx src/scripts/compare-results.ts --before=FILE --after=FILE');
    console.log('Ejemplo: npx tsx src/scripts/compare-results.ts --before=logs/qa-baseline-before.json --after=logs/qa-baseline-after.json');
    console.log('\nUsa --help para mas informacion.');
    process.exit(1);
  }

  // Cargar reportes
  const beforeReport = loadReport(beforeArg);
  const afterReport = loadReport(afterArg);

  if (!beforeReport || !afterReport) {
    process.exit(1);
  }

  console.log(`\nBefore: ${beforeArg}`);
  console.log(`  Fecha: ${beforeReport.date}`);
  console.log(`  Empresas: ${beforeReport.companies.length}`);
  console.log(`After: ${afterArg}`);
  console.log(`  Fecha: ${afterReport.date}`);
  console.log(`  Empresas: ${afterReport.companies.length}`);

  // Obtener lista de empresas en comun
  const beforeNames = new Set(beforeReport.companies.map(c => c.name.toLowerCase()));
  const afterNames = new Set(afterReport.companies.map(c => c.name.toLowerCase()));
  const commonNames = [...beforeNames].filter(name => afterNames.has(name));

  console.log(`\nEmpresas en comun: ${commonNames.length}`);

  if (commonNames.length === 0) {
    console.error('ERROR: No hay empresas en comun entre los dos reportes.');
    process.exit(1);
  }

  // Comparar cada empresa
  const comparisons: CompanyComparison[] = [];
  for (const name of commonNames) {
    const comparison = compareCompany(name, beforeReport.companies, afterReport.companies);
    if (comparison) {
      comparisons.push(comparison);
    }
  }

  // Calcular summary
  const summary: SummaryComparison = {
    before: {
      avgQualityScore: beforeReport.summary.avgQualityScore,
      whatsAppExtractionRate: beforeReport.summary.whatsAppExtractionRate,
      noInfoResponseRate: beforeReport.summary.noInfoResponseRate,
      hallucinationRate: beforeReport.summary.hallucinationRate,
      avgScrapingTimeMs: beforeReport.summary.avgScrapingTimeMs,
      successfulSessions: beforeReport.summary.successfulSessions,
    },
    after: {
      avgQualityScore: afterReport.summary.avgQualityScore,
      whatsAppExtractionRate: afterReport.summary.whatsAppExtractionRate,
      noInfoResponseRate: afterReport.summary.noInfoResponseRate,
      hallucinationRate: afterReport.summary.hallucinationRate,
      avgScrapingTimeMs: afterReport.summary.avgScrapingTimeMs,
      successfulSessions: afterReport.summary.successfulSessions,
    },
    delta: {
      avgScoreChange: afterReport.summary.avgQualityScore - beforeReport.summary.avgQualityScore,
      avgScoreChangePercent: beforeReport.summary.avgQualityScore > 0
        ? ((afterReport.summary.avgQualityScore - beforeReport.summary.avgQualityScore) / beforeReport.summary.avgQualityScore) * 100
        : 0,
      whatsAppRateChange: afterReport.summary.whatsAppExtractionRate - beforeReport.summary.whatsAppExtractionRate,
      noInfoRateChange: afterReport.summary.noInfoResponseRate - beforeReport.summary.noInfoResponseRate,
      hallucinationRateChange: afterReport.summary.hallucinationRate - beforeReport.summary.hallucinationRate,
      scrapingTimeChange: afterReport.summary.avgScrapingTimeMs - beforeReport.summary.avgScrapingTimeMs,
    },
    objectivesMet: {
      modelsExtraction: false,
      whatsAppExtraction: false,
      noInfoReduction: false,
      hallucinationReduction: false,
      scrapingTime: false,
    },
  };

  summary.objectivesMet = checkObjectivesMet(summary);

  // Identificar mejoras y regresiones
  const topImprovements = comparisons
    .filter(c => c.verdict === 'improved')
    .sort((a, b) => b.delta.scoreChange - a.delta.scoreChange)
    .slice(0, 5);

  const regressions = comparisons
    .filter(c => c.verdict === 'degraded')
    .sort((a, b) => a.delta.scoreChange - b.delta.scoreChange);

  // Generar reporte
  const report: ComparisonReport = {
    metadata: {
      version: '1.0',
      createdAt: new Date().toISOString(),
      beforeFile: beforeArg,
      afterFile: afterArg,
    },
    summary,
    companies: comparisons,
    topImprovements,
    regressions,
    recommendations: [],
  };

  report.recommendations = generateRecommendations(report);

  // Guardar reporte
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(logsDir, `qa-comparison-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\nReporte guardado en: ${reportPath}`);

  // Imprimir resumen en consola
  printSummary(report);
}

main().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});
