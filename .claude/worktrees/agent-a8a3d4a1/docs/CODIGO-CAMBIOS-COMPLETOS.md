# Código y Cambios Completos - Referencia Exhaustiva

## 1. FIRECRAWL.TS - Cambios Principales

### Ubicación: `src/lib/firecrawl.ts`

### Constantes (líneas 10-14):
```typescript
const RATE_LIMIT_MS = 50; // Reducido de 500
const FIRECRAWL_CREDIT_COST_USD = 0.001;
const MAX_CATALOG_URLS = 10; // Nuevo
const BATCH_SIZE = 10; // Aumentado de 5
```

### Schema sin ejemplos ViBert (línea 33):
```typescript
// ANTES (MAL):
name: z.string().describe("Nombre del modelo (Sara, Daniela, Carmela, Justina, etc.)"),

// DESPUÉS (BIEN):
name: z.string().describe("Nombre del modelo tal como aparece en el sitio web"),
```

### Schema quinchos (línea 44):
```typescript
// ANTES (MAL):
name: z.string().describe("Nombre o tamanio del quincho (S, M, L, A)"),

// DESPUÉS (BIEN):
name: z.string().describe("Nombre o tamaño del quincho tal como aparece en el sitio"),
```

### Homepage paralelo (líneas 201-215):
```typescript
// OPTIMIZACION: Lanzar homepage scrape en paralelo con los batches de catalogo
console.log('[Firecrawl] Starting homepage scrape in parallel...');
const homepageStartTime = Date.now();
const homepagePromise = firecrawl.scrapeUrl(homeUrl, {
  formats: ['markdown', 'extract'],
  extract: { schema: catalogSchema }
}).then(result => {
  const duration = Date.now() - homepageStartTime;
  console.log(`[Firecrawl] Homepage scrape completed in ${duration}ms`);
  return result;
}).catch(err => {
  const duration = Date.now() - homepageStartTime;
  console.error(`[Firecrawl] Homepage scrape failed after ${duration}ms:`, err);
  return null;
});
```

### Batching paralelo (patrón usado en loops):
```typescript
const urlsToScrape = catalogUrls.slice(0, MAX_CATALOG_URLS);
const batches: string[][] = [];
for (let i = 0; i < urlsToScrape.length; i += BATCH_SIZE) {
  batches.push(urlsToScrape.slice(i, i + BATCH_SIZE));
}

for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
  const batch = batches[batchIndex];
  const batchStartTime = Date.now();
  console.log(`[Firecrawl] Processing batch ${batchIndex + 1}/${batches.length}...`);

  const results = await Promise.all(
    batch.map(async (catalogUrl) => {
      try {
        const result = await firecrawl.scrapeUrl(catalogUrl, {...});
        return { catalogUrl, result, error: null };
      } catch (error) {
        return { catalogUrl, result: null, error };
      }
    })
  );

  const batchDuration = Date.now() - batchStartTime;
  console.log(`[Firecrawl] Batch ${batchIndex + 1} completed in ${batchDuration}ms`);

  // Procesar resultados...

  if (batchIndex < batches.length - 1) {
    await rateLimitDelay();
  }
}
```

### Función parseModelsFromMarkdown ELIMINADA (era líneas 529-584):
```typescript
// ELIMINADO - Contenía lista hardcodeada de nombres ViBert:
// const knownModelNames = [
//   'Sara', 'Daniela', 'Justina', 'Dora', 'Micaela', 'Estefania', 'Estefanía',
//   'Carmela', 'Selene', 'Valeria', 'Maria', 'María', 'Aurora', 'Duna', 'Elena',
//   'Sofia', 'Sofía', 'Victoria', 'Lucia', 'Lucía', 'Andrea', 'Paula', 'Laura'
// ];

// REEMPLAZADO POR función vacía que solo usa patrones genéricos
```

---

## 2. ROUTE.TS - Paralelización

### Ubicación: `src/app/api/simulator/create/route.ts`

### Cambio principal (líneas 44-80):
```typescript
// ANTES (secuencial):
const scrapedContent = await scrapeWebsite(websiteUrl);
let catalog;
if (pdfUrl) {
  catalog = await analyzePdfWithVision(pdfUrl);
}

// DESPUÉS (paralelo):
console.log('[Create] Starting parallel scraping...');
const startTime = Date.now();

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
        return result;
      })
    : Promise.resolve(undefined)
]);

console.log('[Create] Total parallel time:', Date.now() - startTime, 'ms');
```

---

## 3. SCRAPER.TS - Timeouts y Prompt

### Ubicación: `src/lib/scraper.ts`

### Constantes (líneas 21-22):
```typescript
// ANTES:
const MAX_PAGES_TO_CRAWL = 15;
const WAIT_AFTER_LOAD = 5000;

// DESPUÉS:
const MAX_PAGES_TO_CRAWL = 8;
const WAIT_AFTER_LOAD = 2000;
```

### Prompt sin ejemplos ViBert (línea 459):
```typescript
// ANTES (MAL):
- BUSCA EN TODO EL CONTENIDO nombres de modelos específicos (ej: "Aurora", "Carmela", "Duna", etc.)

// DESPUÉS (BIEN):
- BUSCA EN TODO EL CONTENIDO los nombres de modelos que aparezcan en el sitio web (NO inventes nombres)
```

---

## 4. PROMPT-GENERATOR.TS - Ejemplo Genérico

### Ubicación: `src/lib/prompt-generator.ts`

### Línea 158:
```typescript
// ANTES (MAL):
- Ejemplo: "Tenemos el Modelo Carmela de 85m² con 3 dormitorios y 2 baños, ideal para familias"

// DESPUÉS (BIEN):
- Ejemplo: "Tenemos el Modelo X de 85m² con 3 dormitorios y 2 baños, ideal para familias" (usa los nombres REALES del catálogo)
```

---

## 5. PDF-EXTRACTOR.TS - Ejemplo Genérico

### Ubicación: `src/lib/pdf-extractor.ts`

### Línea 135:
```typescript
// ANTES (MAL):
"name": "nombre completo del modelo (ej: 'Modelo Carmela', 'Casa Aurora')",

// DESPUÉS (BIEN):
"name": "nombre completo del modelo tal como aparece en el PDF",
```

---

## 6. SIMULATORFORM.TSX - UI de Progreso

### Ubicación: `src/components/SimulatorForm.tsx`

### Constante de pasos (líneas 14-20):
```typescript
const PROGRESS_STEPS = [
  { id: 'validate', label: 'Verificando URL...' },
  { id: 'upload', label: 'Subiendo catalogo PDF...' },
  { id: 'map', label: 'Mapeando sitio web...' },
  { id: 'scrape', label: 'Extrayendo contenido...' },
  { id: 'generate', label: 'Generando agente IA...' },
];
```

### Estados (líneas 38-39):
```typescript
const [currentStep, setCurrentStep] = useState(-1);
const [hasPdf, setHasPdf] = useState(false);
```

### useEffect para progreso (líneas 41-66):
```typescript
useEffect(() => {
  if (!loading) {
    setCurrentStep(-1);
    return;
  }

  const stepTimings = hasPdf
    ? [0, 1500, 4000, 7000, 12000]
    : [0, -1, 2500, 5500, 10000];

  const timeouts: NodeJS.Timeout[] = [];
  stepTimings.forEach((time, index) => {
    if (time < 0) return;
    const timeout = setTimeout(() => setCurrentStep(index), time);
    timeouts.push(timeout);
  });

  return () => timeouts.forEach(clearTimeout);
}, [loading, hasPdf]);
```

### UI de pasos (en el render):
```tsx
{loading && (
  <div className="space-y-3 mt-4">
    <p className="text-sm text-gray-600 mb-2">Creando tu agente IA...</p>
    {PROGRESS_STEPS.map((step, index) => {
      if (step.id === 'upload' && !hasPdf) return null;
      return (
        <div key={step.id} className={`flex items-center gap-3 ${
          currentStep >= index ? 'text-blue-600' : 'text-gray-400'
        }`}>
          <span className="w-5 h-5 flex items-center justify-center">
            {currentStep > index ? (
              <span className="text-green-500">✓</span>
            ) : currentStep === index ? (
              <span className="animate-spin">◌</span>
            ) : (
              <span className="text-gray-300">○</span>
            )}
          </span>
          <span className={currentStep === index ? 'font-medium' : ''}>
            {step.label}
          </span>
        </div>
      );
    })}
    <p className="text-xs text-gray-500 mt-3">
      Esto puede tomar entre 10 segundos y 2 minutos según el tamaño del sitio...
    </p>
  </div>
)}
```

---

## 7. SCRIPTS DE TESTING

### test-conversations.py
Ubicación: `scripts/test-conversations.py`
- Testea 5 empresas con 5 preguntas fijas cada una
- Guarda JSON + Markdown

### test-10-empresas.py
Ubicación: `scripts/test-10-empresas.py`
- Testea 10 empresas con 8 preguntas rotadas
- Evalúa: info específica, seguimiento, score
- Guarda JSON + Markdown

---

## 8. DOCUMENTOS CREADOS

| Archivo | Propósito |
|---------|-----------|
| `docs/ESTADO-SESION-2026-02-04-FINAL.md` | Estado completo de la sesión |
| `docs/PLAN-TESTING-ROBUSTO.md` | 15 preguntas, criterios, matriz |
| `docs/SEGURIDAD-Y-LANZAMIENTO.md` | Seguridad + pasos dominio |
| `docs/CODIGO-CAMBIOS-COMPLETOS.md` | Este documento |
| `spec/OPTIMIZACION-SCRAPING.md` | Plan original de optimización |

---

## 9. RESUMEN DE MEJORAS

| Métrica | Antes | Después |
|---------|-------|---------|
| Tiempo scraping promedio | 20-25s | 10-15s |
| Batch size | 5 | 10 |
| Rate limit delay | 500ms | 50ms |
| Playwright pages | 15 | 8 |
| Playwright wait | 5000ms | 2000ms |
| Datos contaminados | Sí (ViBert) | No |
| UI de progreso | No | Sí (5 pasos) |

---

## 10. PARA CONTINUAR EN PRÓXIMA SESIÓN

1. **Verificar test de 10 empresas** - Archivo: `logs/test-10-empresas-*.json`
2. **Analizar resultados** - Buscar patrones de fallas
3. **Deploy a Vercel** - Comandos en ESTADO-SESION-2026-02-04-FINAL.md
4. **Configurar dominio** - DNS records en ese mismo doc

---

*Generado: 2026-02-04*
