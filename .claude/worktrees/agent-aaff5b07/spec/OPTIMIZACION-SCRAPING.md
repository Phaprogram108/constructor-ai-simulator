# Plan de Optimizacion: Reducir Tiempo de Scraping

## Resumen Ejecutivo

**Problema**: El scraping toma 20-25 segundos cuando deberia tomar menos de 8 segundos.
**Objetivo**: Reducir tiempo de scraping de 20-25 seg a < 8 seg.
**Estrategia**: Quick-wins primero (paralelizacion + reducir delays), luego mejoras de UX.

---

## Analisis de Bottlenecks

| # | Bottleneck | Ubicacion | Impacto | Tiempo Desperdiciado |
|---|------------|-----------|---------|---------------------|
| 1 | Scraping secuencial en loop | `firecrawl.ts:203-294` | CRITICO | ~15-20 seg |
| 2 | Rate limit de 500ms entre scrapes | `firecrawl.ts:10,22-24,292-293` | CRITICO | ~5-10 seg (10 URLs * 500ms) |
| 3 | Playwright WAIT_AFTER_LOAD = 5000ms | `scraper.ts:22,110,117,133,168` | ALTO | 75+ seg en fallback |
| 4 | Web + PDF no paralelizados | `route.ts:44-75` | ALTO | ~2-5 seg |
| 5 | UX sin feedback de progreso | `SimulatorForm.tsx:173` | MEDIO | Percepcion de lentitud |

---

## Fases de Implementacion

### FASE 1: Paralelizar Scraping en Firecrawl (QUICK-WIN)
**Impacto estimado**: -12 a -15 segundos
**Complejidad**: Baja
**Riesgo**: Bajo

#### Archivo: `src/lib/firecrawl.ts`

**Cambio 1.1: Reducir RATE_LIMIT_MS**
- Linea 10: Cambiar `RATE_LIMIT_MS = 500` a `RATE_LIMIT_MS = 50`
- Razon: Firecrawl ya tiene rate limiting interno, no necesitamos agregar mas

```typescript
// ANTES (linea 10)
const RATE_LIMIT_MS = 500;

// DESPUES
const RATE_LIMIT_MS = 50; // Firecrawl maneja rate limit interno
```

**Cambio 1.2: Paralelizar scraping de catalogUrls**
- Lineas 203-294: Reemplazar `for await` loop con `Promise.all` + batches

```typescript
// ANTES (lineas 203-294)
for (const catalogUrl of catalogUrls) {
  try {
    console.log('[Firecrawl] Scraping catalog:', catalogUrl);
    const result = await firecrawl.scrapeUrl(catalogUrl, {...});
    // ... procesamiento
  } catch (error) {
    console.error('[Firecrawl] Error scraping catalog:', catalogUrl, error);
  }
  await rateLimitDelay();
}

// DESPUES
const BATCH_SIZE = 5; // Procesar 5 URLs en paralelo
const batches = [];
for (let i = 0; i < catalogUrls.length; i += BATCH_SIZE) {
  batches.push(catalogUrls.slice(i, i + BATCH_SIZE));
}

for (const batch of batches) {
  const results = await Promise.all(
    batch.map(async (catalogUrl) => {
      try {
        console.log('[Firecrawl] Scraping catalog:', catalogUrl);
        const result = await firecrawl.scrapeUrl(catalogUrl, {
          formats: ['markdown', 'extract'],
          extract: { schema: catalogSchema }
        });
        return { catalogUrl, result, error: null };
      } catch (error) {
        console.error('[Firecrawl] Error scraping catalog:', catalogUrl, error);
        return { catalogUrl, result: null, error };
      }
    })
  );

  // Procesar resultados del batch
  for (const { catalogUrl, result, error } of results) {
    if (error || !result?.success) continue;
    // ... mismo procesamiento que antes (lineas 216-287)
  }

  // Pequeno delay entre batches (no entre cada URL)
  if (batches.indexOf(batch) < batches.length - 1) {
    await rateLimitDelay();
  }
}
```

**Cambio 1.3: Limitar cantidad maxima de URLs a scrapear**
- Agregar constante `MAX_CATALOG_URLS = 10` despues de linea 11
- En linea 163: `const urlsToScrape = catalogUrls.slice(0, MAX_CATALOG_URLS);`

```typescript
// Agregar despues de linea 11
const MAX_CATALOG_URLS = 10; // Maximo URLs de catalogo a scrapear

// Modificar linea 163 (antes del loop)
const urlsToScrape = catalogUrls.slice(0, MAX_CATALOG_URLS);
console.log(`[Firecrawl] Scraping ${urlsToScrape.length} of ${catalogUrls.length} catalog URLs`);
```

**Tareas Fase 1:**
- [ ] 1.1 Reducir RATE_LIMIT_MS de 500 a 50
- [ ] 1.2 Implementar batching con Promise.all en loop de catalogUrls
- [ ] 1.3 Agregar MAX_CATALOG_URLS = 10 para limitar scraping

---

### FASE 2: Paralelizar Web + PDF en Route
**Impacto estimado**: -2 a -5 segundos
**Complejidad**: Baja
**Riesgo**: Bajo

#### Archivo: `src/app/api/simulator/create/route.ts`

**Cambio 2.1: Ejecutar scrapeWebsite y analyzePdf en paralelo**
- Lineas 44-75: Usar Promise.all para ejecutar ambas operaciones simultaneamente

```typescript
// ANTES (lineas 44-75)
console.log('[Create] Scraping website:', websiteUrl);
const scrapedContent = await scrapeWebsite(websiteUrl);
// ... logs

let catalog: ExtractedCatalog | undefined;
if (pdfUrl) {
  console.log('[Create] Processing PDF with Vision:', pdfUrl);
  catalog = await analyzePdfWithVision(pdfUrl);
  // ... logs
}

// DESPUES
console.log('[Create] Starting parallel scraping...');
const startTime = Date.now();

// Ejecutar web scraping y PDF analysis en paralelo
const [scrapedContent, catalog] = await Promise.all([
  scrapeWebsite(websiteUrl).then(result => {
    console.log('[Create] Web scrape completed in', Date.now() - startTime, 'ms');
    console.log('[Create] Scraped:', {
      title: result.title,
      modelsCount: result.models.length,
      servicesCount: result.services.length,
    });
    return result;
  }),
  pdfUrl
    ? analyzePdfWithVision(pdfUrl).then(result => {
        console.log('[Create] PDF analysis completed in', Date.now() - startTime, 'ms');
        console.log('[Create] PDF Vision analysis:', {
          modelsCount: result.models.length,
          pricesCount: result.prices.length,
        });
        return result;
      })
    : Promise.resolve(undefined)
]);

console.log('[Create] Total parallel time:', Date.now() - startTime, 'ms');
```

**Tareas Fase 2:**
- [ ] 2.1 Refactorizar route.ts para usar Promise.all con web + PDF

---

### FASE 3: Optimizar Playwright Fallback
**Impacto estimado**: -60 segundos (en caso de fallback)
**Complejidad**: Baja
**Riesgo**: Medio (podria afectar calidad de extraccion en SPAs)

#### Archivo: `src/lib/scraper.ts`

**Cambio 3.1: Reducir timeouts**
- Linea 21: `MAX_PAGES_TO_CRAWL = 15` -> `MAX_PAGES_TO_CRAWL = 8`
- Linea 22: `WAIT_AFTER_LOAD = 5000` -> `WAIT_AFTER_LOAD = 2000`

```typescript
// ANTES (lineas 21-22)
const MAX_PAGES_TO_CRAWL = 15;
const WAIT_AFTER_LOAD = 5000;

// DESPUES
const MAX_PAGES_TO_CRAWL = 8;  // Reducido de 15
const WAIT_AFTER_LOAD = 2000; // Reducido de 5000
```

**Cambio 3.2: Timeout progresivo**
- Implementar timeout que aumenta solo si el contenido es insuficiente

```typescript
// Agregar despues de linea 22
const WAIT_INITIAL = 2000;
const WAIT_RETRY = 3000;

// En linea 110, reemplazar:
await page.waitForTimeout(WAIT_AFTER_LOAD);
// Por:
await page.waitForTimeout(WAIT_INITIAL);
```

**Tareas Fase 3:**
- [ ] 3.1 Reducir MAX_PAGES_TO_CRAWL a 8
- [ ] 3.2 Reducir WAIT_AFTER_LOAD a 2000ms
- [ ] 3.3 Implementar timeout progresivo (opcional)

---

### FASE 4: Feedback de Progreso en UI (UX)
**Impacto estimado**: Mejora percepcion de velocidad
**Complejidad**: Media
**Riesgo**: Bajo

#### Opcion A: Server-Sent Events (SSE) - Recomendada
Crear endpoint que envie updates de progreso en tiempo real.

#### Opcion B: Polling con Timestamps - Mas simple
Cliente hace polling cada 2 segundos para obtener estado.

**Cambios necesarios:**

1. **Nuevo archivo**: `src/app/api/simulator/progress/[sessionId]/route.ts`
   - Endpoint SSE que emite eventos de progreso

2. **Modificar**: `src/lib/scraper.ts`
   - Agregar callbacks de progreso

3. **Modificar**: `src/components/SimulatorForm.tsx`
   - Conectar a SSE y mostrar progreso detallado

```typescript
// SimulatorForm.tsx - UI de progreso mejorada
const progressSteps = [
  { id: 'validate', label: 'Verificando URL...', duration: '1-2s' },
  { id: 'map', label: 'Mapeando sitio web...', duration: '2-3s' },
  { id: 'scrape', label: 'Extrayendo contenido...', duration: '3-5s' },
  { id: 'pdf', label: 'Analizando catalogo PDF...', duration: '2-4s' },
  { id: 'generate', label: 'Generando agente IA...', duration: '1-2s' },
];

// Mostrar barra de progreso con pasos
<div className="space-y-2">
  {progressSteps.map((step, index) => (
    <div key={step.id} className={`flex items-center gap-2 ${
      currentStep >= index ? 'text-blue-600' : 'text-gray-400'
    }`}>
      {currentStep > index ? (
        <CheckIcon className="w-4 h-4 text-green-500" />
      ) : currentStep === index ? (
        <SpinnerIcon className="w-4 h-4 animate-spin" />
      ) : (
        <CircleIcon className="w-4 h-4" />
      )}
      <span>{step.label}</span>
    </div>
  ))}
</div>
```

**Tareas Fase 4:**
- [ ] 4.1 Crear endpoint SSE para progreso (opcional)
- [ ] 4.2 Agregar UI de pasos de progreso en SimulatorForm
- [ ] 4.3 Implementar estimacion de tiempo restante

---

## Tracks Paralelos

```
TRACK A (Core Performance):
  Fase 1 -> Fase 2 -> Fase 3
  [Paralelizar Firecrawl] -> [Paralelizar Web+PDF] -> [Optimizar Playwright]

TRACK B (UX - Independiente):
  Fase 4
  [Feedback de Progreso]
```

**Track A y Track B pueden ejecutarse en paralelo** ya que no tienen dependencias entre si.

---

## Estimacion de Mejoras

| Fase | Antes | Despues | Ahorro |
|------|-------|---------|--------|
| Fase 1 | 20-25s | 5-8s | 15-17s |
| Fase 2 | +3-5s si hay PDF | +0s (paralelo) | 3-5s |
| Fase 3 | +75s si fallback | +16s si fallback | 59s |
| **TOTAL** | **20-25s** | **5-8s** | **~15-17s** |

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|--------------|---------|------------|
| Rate limit de Firecrawl | Media | Alto | Mantener batch size en 5, monitorear errores 429 |
| Contenido incompleto con menos espera | Baja | Medio | Implementar retry si contenido < 500 chars |
| Errores en Promise.all | Baja | Alto | Usar Promise.allSettled para no fallar todo |

---

## Testing

### Tests de Performance
```bash
# Test antes de cambios (baseline)
time node test-full-scrape.mjs https://casasvikingas.com.ar

# Test despues de cada fase
time node test-full-scrape.mjs https://casasvikingas.com.ar
```

### Tests de Regresion
- [ ] Verificar que se extraen mismos modelos que antes
- [ ] Verificar que contactInfo sigue extrayendose
- [ ] Verificar que PDF se procesa correctamente
- [ ] Verificar fallback a Playwright funciona

### Metricas a Monitorear
1. Tiempo total de scraping (objetivo: < 8s)
2. Cantidad de modelos extraidos (no debe bajar)
3. Tasa de errores de Firecrawl
4. Tiempo de Playwright fallback (si se usa)

---

## Siguiente Paso

**Usar `@coder` para implementar Fase 1** (Paralelizar Firecrawl)

Comando sugerido:
```
@coder Implementar Fase 1 del plan en /spec/OPTIMIZACION-SCRAPING.md:
1. Reducir RATE_LIMIT_MS de 500 a 50 en firecrawl.ts linea 10
2. Agregar MAX_CATALOG_URLS = 10 despues de linea 11
3. Reemplazar el for loop de lineas 203-294 con Promise.all + batches
```

---

## Checklist Final

- [ ] **Fase 1**: Paralelizar Firecrawl
  - [ ] 1.1 Reducir RATE_LIMIT_MS
  - [ ] 1.2 Implementar batching con Promise.all
  - [ ] 1.3 Agregar MAX_CATALOG_URLS
- [ ] **Fase 2**: Paralelizar Web + PDF
  - [ ] 2.1 Refactorizar route.ts con Promise.all
- [ ] **Fase 3**: Optimizar Playwright
  - [ ] 3.1 Reducir MAX_PAGES_TO_CRAWL
  - [ ] 3.2 Reducir WAIT_AFTER_LOAD
- [ ] **Fase 4**: Feedback de Progreso (opcional)
  - [ ] 4.1 Endpoint SSE
  - [ ] 4.2 UI de pasos
- [ ] **Testing**
  - [ ] Performance test
  - [ ] Regression test
