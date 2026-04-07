# Especificacion Fase 6: QA Final y Comparativa

## Resumen Ejecutivo

Esta fase cierra el ciclo de mejoras ejecutando un QA final con las 20 empresas de prueba y comparando los resultados contra el baseline inicial. El objetivo es cuantificar las mejoras logradas en las fases 2-5.

**Objetivo principal**: Medir el impacto de las mejoras implementadas comparando metricas before/after.

---

## Estado Actual

### Baseline Existente

Segun el log mas reciente (`logs/qa-20-empresas-2026-02-05T00-28-31.json`):

| Metrica | Valor Actual |
|---------|--------------|
| Total Empresas | 20 |
| Exitosas | 19 |
| Fallidas | 1 |
| Score Promedio | 64% |
| Respuestas Dudosas | 24 |

**Top Performers**:
- Movilhauss: 94%
- GoHome: 94%
- Mini Casas: 82%

**Peores Performers**:
- Lucys House: 46%
- Grupo Steimberg: 46%
- Promet Chile: 52%

### Scripts Existentes

| Archivo | Estado | Proposito |
|---------|--------|-----------|
| `src/scripts/qa-baseline.ts` | EXISTE (726 lineas) | Script QA completo |
| `src/scripts/test-companies.json` | EXISTE (121 lineas) | 20 empresas de prueba |
| `src/scripts/compare-results.ts` | NO EXISTE | Comparar before vs after |

### Formato de Reportes Actuales

Los logs de QA tienen dos formatos:

**1. Formato BaselineReport (qa-baseline.ts)**:
```typescript
interface BaselineReport {
  metadata: { version, createdAt, environment, baseUrl };
  summary: {
    totalCompanies, successfulSessions, failedSessions,
    avgQualityScore, avgScrapingTimeMs, totalModelsExtracted,
    whatsAppExtractionRate, noInfoResponseRate, hallucinationRate
  };
  byCategory: { problematicas, aleatorias };
  results: CompanyTestResult[];
  recommendations: string[];
}
```

**2. Formato Simplificado (qa-20-empresas)**:
```typescript
{
  fecha: string;
  resumen: {
    totalEmpresas, exitosas, fallidas, scorePromedio, respuestasDudosas
  };
  empresasPorScore: Array<{
    empresa, score, especificas, dudosas, scrapingTime
  }>;
  respuestasDudosas: Array<{
    empresa, pregunta, respuesta, redFlags
  }>;
}
```

---

## Requisitos Fase 6

### 6.1 Re-probar las 20 Empresas

**Objetivo**: Ejecutar el script `qa-baseline.ts` con el sistema mejorado para generar un nuevo reporte.

**Prerequisitos**:
- Fases 2-5 completadas e integradas
- Servidor local funcionando (`npm run dev`)
- Mismas 20 empresas de `test-companies.json`

**Output esperado**:
```
logs/qa-baseline-after.json
```

**Nota importante**: El script actual genera archivos con fecha (`qa-baseline-YYYY-MM-DD.json`). Se debe modificar para soportar sufijo custom (`--output after` o `--output before`).

### 6.2 Script de Comparativa

**Archivo a crear**: `src/scripts/compare-results.ts`

**Funcionalidad**:
1. Leer dos archivos JSON de baseline (before y after)
2. Comparar metricas por empresa
3. Calcular deltas y porcentajes de mejora
4. Generar reporte de comparativa
5. Identificar empresas que mejoraron vs empeoraron

### 6.3 Verificacion Final

**Criterios de exito cuantitativos** (del plan original):

| Metrica | Baseline Actual | Objetivo Post-Mejoras |
|---------|-----------------|----------------------|
| Modelos extraidos correctamente | ~70% | >90% |
| WhatsApp encontrado | ~5% | >50% |
| Respuestas "no tengo info" | ~30% | <10% |
| Alucinaciones detectadas | Desconocido | <5% |
| Tiempo de creacion sesion | 5-15s | <20s |

---

## Plan de Implementacion

### Fase 6.1: Preparar Baseline "Before"

**Prioridad**: Alta
**Complejidad**: Baja

| Tarea | Descripcion |
|-------|-------------|
| 6.1.1 | Renombrar log existente mas reciente a `qa-baseline-before.json` |
| 6.1.2 | Verificar que contiene las 20 empresas completas |
| 6.1.3 | Documentar metricas actuales como baseline oficial |

### Fase 6.2: Modificar qa-baseline.ts para Output Custom

**Prioridad**: Media
**Complejidad**: Baja

**Archivo a modificar**: `src/scripts/qa-baseline.ts`

**Cambios requeridos**:

```typescript
// En CONFIG, agregar:
const CONFIG = {
  // ... existentes ...
  OUTPUT_SUFFIX: process.env.OUTPUT_SUFFIX || process.argv.includes('--after') ? 'after' : 'before',
};

// En main(), cambiar nombre del archivo:
const outputSuffix = process.argv.find(arg => arg.startsWith('--output='))?.split('=')[1] || 'baseline';
const reportPath = path.join(logsDir, `qa-baseline-${outputSuffix}.json`);
```

**Comando de ejecucion**:
```bash
# Para el baseline inicial (si no existe)
npx tsx src/scripts/qa-baseline.ts --output=before

# Para el QA post-mejoras
npx tsx src/scripts/qa-baseline.ts --output=after
```

### Fase 6.3: Crear compare-results.ts

**Prioridad**: Alta
**Complejidad**: Media

**Archivo a crear**: `src/scripts/compare-results.ts`

---

## Diseno del Script compare-results.ts

### Interfaces

```typescript
/**
 * Compare Results Script - FASE 6
 *
 * Compara resultados de QA antes y despues de mejoras
 * Ejecutar: npx tsx src/scripts/compare-results.ts --before logs/qa-baseline-before.json --after logs/qa-baseline-after.json
 *
 * Output: logs/qa-comparison-YYYY-MM-DD.json + stdout
 */

// ============================================
// TIPOS
// ============================================

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
    scoreChange: number;           // +/- puntos
    scoreChangePercent: number;    // +/- %
    modelsChange: number;
    whatsAppGained: boolean;       // no tenia -> ahora tiene
    whatsAppLost: boolean;         // tenia -> ahora no tiene
    noInfoChange: number;          // negativo = mejora
    hallucinationChange: number;   // negativo = mejora
    scrapingTimeChange: number;    // negativo = mejora
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
    modelsExtraction: boolean;      // >90%
    whatsAppExtraction: boolean;    // >50%
    noInfoReduction: boolean;       // <10%
    hallucinationReduction: boolean;// <5%
    scrapingTime: boolean;          // <20s
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
  topImprovements: CompanyComparison[];  // Top 5 que mas mejoraron
  regressions: CompanyComparison[];       // Empresas que empeoraron
  recommendations: string[];
}
```

### Logica Principal

```typescript
// ============================================
// FUNCIONES PRINCIPALES
// ============================================

function loadReport(filePath: string): BaselineReport | null {
  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: No se encontro ${filePath}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function compareCompany(
  companyUrl: string,
  beforeResults: CompanyTestResult[],
  afterResults: CompanyTestResult[]
): CompanyComparison | null {
  const before = beforeResults.find(r => r.company.url === companyUrl);
  const after = afterResults.find(r => r.company.url === companyUrl);

  if (!before || !after) return null;

  const scoreChange = after.metrics.qualityScore - before.metrics.qualityScore;
  const modelsChange = after.scraping.modelsCount - before.scraping.modelsCount;
  const noInfoChange = after.metrics.noInfoResponses - before.metrics.noInfoResponses;
  const hallucinationChange = after.metrics.possibleHallucinations - before.metrics.possibleHallucinations;
  const scrapingTimeChange = after.sessionCreation.scrapingDurationMs - before.sessionCreation.scrapingDurationMs;

  // Determinar veredicto
  let verdict: 'improved' | 'degraded' | 'unchanged' = 'unchanged';
  if (scoreChange > 5) verdict = 'improved';
  if (scoreChange < -5) verdict = 'degraded';

  return {
    company: before.company.name,
    url: companyUrl,
    before: {
      score: before.metrics.qualityScore,
      modelsCount: before.scraping.modelsCount,
      hasWhatsApp: before.scraping.hasWhatsApp,
      noInfoResponses: before.metrics.noInfoResponses,
      possibleHallucinations: before.metrics.possibleHallucinations,
      scrapingTimeMs: before.sessionCreation.scrapingDurationMs,
    },
    after: {
      score: after.metrics.qualityScore,
      modelsCount: after.scraping.modelsCount,
      hasWhatsApp: after.scraping.hasWhatsApp,
      noInfoResponses: after.metrics.noInfoResponses,
      possibleHallucinations: after.metrics.possibleHallucinations,
      scrapingTimeMs: after.sessionCreation.scrapingDurationMs,
    },
    delta: {
      scoreChange,
      scoreChangePercent: before.metrics.qualityScore > 0
        ? (scoreChange / before.metrics.qualityScore) * 100
        : 0,
      modelsChange,
      whatsAppGained: !before.scraping.hasWhatsApp && after.scraping.hasWhatsApp,
      whatsAppLost: before.scraping.hasWhatsApp && !after.scraping.hasWhatsApp,
      noInfoChange,
      hallucinationChange,
      scrapingTimeChange,
    },
    verdict,
  };
}

function checkObjectivesMet(summary: SummaryComparison): typeof summary.objectivesMet {
  return {
    // Objetivo: >90% modelos correctos (aproximado por score)
    modelsExtraction: summary.after.avgQualityScore >= 70, // Proxy metric
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

  // Exito total
  const allMet = Object.values(report.summary.objectivesMet).every(v => v);
  if (allMet) {
    recs.push('EXITO: Todos los objetivos cumplidos. Sistema listo para produccion.');
  }

  return recs;
}
```

### Main

```typescript
// ============================================
// MAIN
// ============================================

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('COMPARACION QA - FASE 6');
  console.log(`Fecha: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  // Parsear argumentos
  const beforeArg = process.argv.find(a => a.startsWith('--before='))?.split('=')[1];
  const afterArg = process.argv.find(a => a.startsWith('--after='))?.split('=')[1];

  if (!beforeArg || !afterArg) {
    console.error('Uso: npx tsx src/scripts/compare-results.ts --before=FILE --after=FILE');
    console.log('Ejemplo: npx tsx src/scripts/compare-results.ts --before=logs/qa-baseline-before.json --after=logs/qa-baseline-after.json');
    process.exit(1);
  }

  // Cargar reportes
  const beforeReport = loadReport(beforeArg);
  const afterReport = loadReport(afterArg);

  if (!beforeReport || !afterReport) {
    process.exit(1);
  }

  console.log(`\nBefore: ${beforeArg}`);
  console.log(`After: ${afterArg}`);
  console.log(`Empresas: ${beforeReport.results.length} vs ${afterReport.results.length}`);

  // Comparar cada empresa
  const allUrls = new Set([
    ...beforeReport.results.map(r => r.company.url),
    ...afterReport.results.map(r => r.company.url),
  ]);

  const comparisons: CompanyComparison[] = [];
  for (const url of allUrls) {
    const comparison = compareCompany(url, beforeReport.results, afterReport.results);
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
    objectivesMet: { modelsExtraction: false, whatsAppExtraction: false, noInfoReduction: false, hallucinationReduction: false, scrapingTime: false },
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
  const timestamp = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(logsDir, `qa-comparison-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\nReporte guardado en: ${reportPath}`);

  // Imprimir resumen en consola
  printSummary(report);
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

main().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});
```

---

## Archivos a Crear/Modificar

| Archivo | Accion | Lineas Estimadas | Prioridad |
|---------|--------|------------------|-----------|
| `src/scripts/compare-results.ts` | Crear | ~350 | Alta |
| `src/scripts/qa-baseline.ts` | Modificar | ~10 lineas nuevas | Media |
| `logs/qa-baseline-before.json` | Renombrar existente | - | Alta |

---

## Flujo de Ejecucion

### Paso 1: Preparar Baseline Before

```bash
# Si ya existe un log de QA reciente, renombrarlo
cp logs/qa-20-empresas-2026-02-05T00-28-31.json logs/qa-baseline-before.json

# O ejecutar un nuevo baseline
npx tsx src/scripts/qa-baseline.ts --output=before
```

### Paso 2: Ejecutar QA Post-Mejoras

```bash
# Asegurarse de que el servidor esta corriendo
npm run dev

# Ejecutar QA completo
npx tsx src/scripts/qa-baseline.ts --output=after
```

### Paso 3: Comparar Resultados

```bash
npx tsx src/scripts/compare-results.ts \
  --before=logs/qa-baseline-before.json \
  --after=logs/qa-baseline-after.json
```

### Output Esperado

```
============================================================
COMPARACION QA - FASE 6
Fecha: 2026-02-XX
============================================================

Before: logs/qa-baseline-before.json
After: logs/qa-baseline-after.json
Empresas: 20 vs 20

Reporte guardado en: logs/qa-comparison-2026-02-XX.json

============================================================
RESUMEN DE COMPARACION
============================================================

--- METRICAS GLOBALES ---
Score Promedio:     64.0% -> 78.5%  (+14.5 pts)
WhatsApp Rate:      5% -> 55%  (+50 pts)
No Info Rate:       28% -> 8%  (-20 pts)
Hallucination Rate: 12% -> 3%  (-9 pts)
Scraping Time:      95.2s -> 45.3s  (-49.9s)

--- OBJETIVOS ---
WhatsApp >50%:      CUMPLIDO
No Info <10%:       CUMPLIDO
Hallucinations <5%: CUMPLIDO
Scraping <20s:      PENDIENTE

--- EMPRESAS ---
Mejoraron:  15
Empeoraron: 1
Sin cambio: 4

--- TOP MEJORAS ---
  Ecomod: 52% -> 88% (+36)
  ViBert: 46% -> 82% (+36)
  Atlas Housing: 74% -> 94% (+20)

--- REGRESIONES ---
  Lista: 58% -> 52% (-6)

--- RECOMENDACIONES ---
  - Scraping time alto. Evaluar cache o paralelizacion.
  - ATENCION: 1 empresas empeoraron. Revisar: Lista

============================================================
FIN DE COMPARACION
============================================================
```

---

## Criterios de Aceptacion

### 6.1 QA Final
- [ ] Script `qa-baseline.ts` soporta argumento `--output=SUFFIX`
- [ ] Se ejecuta QA con las 20 empresas sin errores criticos
- [ ] Se genera `logs/qa-baseline-after.json`

### 6.2 Script de Comparativa
- [ ] `compare-results.ts` lee dos archivos JSON
- [ ] Compara metricas por empresa
- [ ] Calcula deltas y porcentajes
- [ ] Identifica top mejoras y regresiones
- [ ] Genera reporte JSON en `logs/qa-comparison-*.json`
- [ ] Imprime resumen legible en consola

### 6.3 Verificacion de Objetivos
- [ ] Reporte indica cuales objetivos se cumplieron
- [ ] Genera recomendaciones para objetivos pendientes
- [ ] Documenta empresas que empeoraron (si las hay)

---

## Dependencias

**Ninguna dependencia nueva**. El script usa:
- `fs` (Node.js nativo)
- `path` (Node.js nativo)
- Tipos existentes de `qa-baseline.ts`

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|--------------|---------|------------|
| Formatos de JSON incompatibles | Media | Alto | Validar estructura antes de comparar |
| Empresas diferentes en before/after | Baja | Medio | Comparar solo empresas presentes en ambos |
| Mejoras en unas, regresiones en otras | Media | Bajo | Documentar ambos en el reporte |
| QA tarda demasiado (>2h) | Media | Bajo | Ejecutar en background, usar --subset |

---

## Testing del Script

```bash
# Test con archivos de ejemplo
npx tsx src/scripts/compare-results.ts \
  --before=logs/qa-baseline-before.json \
  --after=logs/qa-baseline-before.json

# Deberia mostrar: 0 mejoras, 0 regresiones (mismo archivo)

# Test con archivos diferentes
npx tsx src/scripts/compare-results.ts \
  --before=logs/qa-baseline-before.json \
  --after=logs/qa-baseline-after.json
```

---

## Siguiente Paso

Una vez completada la Fase 6:

1. **Si todos los objetivos se cumplen**: Documentar mejoras, preparar para produccion
2. **Si hay objetivos pendientes**: Priorizar proximas mejoras basado en recomendaciones
3. **Si hay regresiones**: Investigar y corregir antes de deploy

---

## Notas de Implementacion

### Compatibilidad de Formatos

El script `compare-results.ts` debe manejar ambos formatos de reporte:
- `BaselineReport` (generado por `qa-baseline.ts`)
- Formato simplificado (generado por scripts anteriores)

Se recomienda normalizar internamente al formato `BaselineReport` para comparaciones consistentes.

### Handling de Valores Faltantes

Si una empresa esta en `before` pero no en `after` (o viceversa):
- No incluir en comparaciones por empresa
- Documentar en el reporte como "empresas sin par"
- No afectar metricas globales

### Precision de Metricas

- Porcentajes: 1 decimal (ej: 64.5%)
- Deltas: 1 decimal con signo (ej: +14.5, -3.2)
- Tiempos: segundos con 1 decimal (ej: 45.3s)
