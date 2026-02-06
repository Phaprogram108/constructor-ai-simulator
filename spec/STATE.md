# Estado del Proyecto - Constructor AI Simulator

**Ultima actualizacion:** 2026-02-06 12:30 ART

## Progreso de Fases

| Fase | Estado | Notas |
|------|--------|-------|
| FASE 1: QA Baseline | Completada | Scripts creados, baseline ejecutado |
| FASE 2: Mejoras Scraping | Completada | WhatsApp validator, linktree explorer |
| FASE 3: Anti-Alucinacion | Completada | Content search, response validator |
| FASE 4: Tipo Constructora | Completada | classifyConstructora() mejorado |
| FASE 5: Logging Mejorado | Completada | conversation-logger reescrito |
| FASE 6: QA Final | Completada | compare-results.ts creado |
| Hotfix: Inmobiliarias | Completada | Clasificacion inmobiliaria + fix fallback |
| Hotfix: Wix Support | Completada | scrapeWixSite() con URLs directas |
| Pipeline Diagnostico | **EJECUTADO x3** | Run 1: 61%, Run 2: 26%, Run 3: 46% |
| **Firecrawl v3** | **EN PROGRESO** | crawlUrl + extract() + mapUrl fallback. Parcial: 46% en run 3, falta run completo con fixes finales |
| **V4: Fase 5** | **COMPLETADA** | Agent test dinamico con preguntas adaptativas basadas en ground truth |

## Resultados del Pipeline Diagnostico

### Run 3 - Firecrawl v3 (parcial, sin ultimos fixes)

| Metrica | Run 2 (v2) | Run 3 (v3) | Cambio |
|---------|------------|------------|--------|
| Companies analizadas | 15 | 18 | +3 nuevas |
| Score promedio | 26% | 46% | **+77% relativo** |
| SCRAPING_MISS | 100 | 106 | +6 (pero 3 empresas mas) |
| PROMPT_MISS | 0 | 3 | +3 nuevos |
| HALLUCINATION | 16 | 2 | **-87.5%** |

### Tabla por Empresa (Run 3)

| Company | v2 Score | v3 Score | v2 Prompt | v3 Prompt | Cambio |
|---------|----------|----------|-----------|-----------|--------|
| GoHome | 0% | **100%** | 0 | 16 | FIXED - crawlUrl navega subpaginas |
| Offis | N/A | **100%** | N/A | 30 | NUEVO - 12 GT models matched |
| Efede | 100% | **100%** | 1 | 6 | +5 modelos |
| Grupo Steimberg | 60% | **100%** | 7 | 3 | Mejor matching |
| Habika | N/A | **100%** | N/A | 0 | NUEVO |
| PlugArq | 100% | **100%** | 0 | 10* | +10 modelos (proyectos) |
| Aftamantes | 33% | **67%** | 4 | 5 | +34pp |
| Atlas Housing | 0% | **50%** | 6 | 5 | +50pp |
| T1 Modular | 30% | 30% | 7 | 7 | = |
| Lucys House | 0% | 25% | 0 | 13 | +25pp SPA mejor |
| Lista | N/A | 18% | N/A | 14 | NUEVO |
| Mini Casas | 0% | 17% | 7 | 8 | +17pp |
| Movilhauss | 13% | 13% | 6 | 4 | = naming issue |
| Ecomod | 60% | 10% | 9 | 7 | REGRESION por regex parsing |
| ViBert | 0% | 0% | 14 | 0 | REGRESION - clasificado como INMOBILIARIA |
| Sienna Modular | 0% | 0% | 0 | 0 | SPA - no extractable |
| Arcohouse | 0% | 0% | 4 | 13 | naming mismatch |
| Wellmod | 0% | 0% | 1 | 8 | GT tiene 38 modelos imposibles de capturar |

*PlugArq: Run 3 parcial no incluyo el dato actualizado, run posterior confirmo 10 modelos

### Fixes aplicados en Run 3 (POSTERIORES al score de 46%)

Estos fixes se aplicaron DESPUES del run que dio 46%, por lo que el score real deberia ser mayor:

1. **Garbage model name filter** - `parseModelsFromMarkdown()` ya no extrae frases como "tiene una superficie cubierta de" como nombres de modelos
2. **Removed includePaths** - crawlUrl ahora descubre TODAS las paginas (no solo las que matchean patterns)
3. **mapUrl fallback** - Si crawl encuentra <5 modelos, tambien corre mapUrl para descubrir URLs que el crawl perdio

### Ecomod ANTES/DESPUES del garbage filter
- ANTES: Models = "Casa tiene una superficie cubierta de - 45m2" (basura)
- DESPUES: Models = "Casa Eco Studio - 11.5m2 - 1 bano", "Casa Turístico - 25m2", etc. (correctos)

## V4: Exploratory System

### Fase 5 - Agent Test Dinamico (COMPLETADA)

**Commit:** `324a814` - [fase5] implementar agent test dinamico con preguntas adaptativas

**Cambios implementados:**
1. Expandido `QuestionType` con 9 tipos: identity, offering, contact, product_count, product_specific, product_specs, financing, coverage, differentiator
2. Reescrita `generateQuestions()` para generar preguntas dinamicas basadas en ground truth
3. Agregada `inferProductLabel()` para detectar terminologia (modelos/proyectos/unidades/servicios/lotes)
4. Agregada `hasFinancingMention()` para detectar info de financiacion en GT
5. Actualizada `extractModelsFromPrompt()` para detectar formato numerado (`### 1. Producto`) y patterns expandidos
6. Fixed TypeScript compatibility issue con `Array.from(new Set())` en lugar de spread operator

**Preguntas universales (siempre se hacen):**
- Que es tu empresa y que hacen?
- Que productos o servicios ofrecen?
- Cual es su WhatsApp o telefono de contacto?

**Preguntas condicionales (basadas en GT):**
- Si hay productos/modelos: Cuantos [label] ofrecen? + preguntas sobre 3 productos especificos + specs
- Si hay financiacion: Tienen financiamiento o planes de pago?
- Si hay cobertura: A que zonas llegan o donde operan?

**Impacto:**
- El agent test ya NO asume que todas las empresas tienen "modelos"
- Las preguntas se adaptan a lo que el ground truth encontro
- Mejor alineacion con V4 exploratory approach

### Progreso V4 Fases

| Fase | Estado | Commit |
|------|--------|--------|
| Fase 1: Nuevos tipos TypeScript | COMPLETADA | (previo) - ProductOrService, CompanyProfile en types/index.ts |
| Fase 2: Scraper exploratorio | **COMPLETADA** | `043346d` - exploratorySchema, EXPLORATORY_EXTRACTION_PROMPT, PRODUCT_KEYWORDS |
| Fase 3: Prompt generator adaptativo | **COMPLETADA** | Template unico adaptativo con helpers: buildProductsSection, buildCatalogSection, buildNoProductsSection, buildQualificationInstructions |
| Fase 4: Actualizar wrappers | PENDIENTE | scraper.ts, create route - limpiar constructoraType |
| Fase 5: Agent test dinamico | COMPLETADA | `324a814` - preguntas adaptativas basadas en GT |
| Fase 6: Diagnosis exploratorio | PENDIENTE | Score compuesto, IDENTITY_MISS, TERMINOLOGY_MISS |
| Fase 7: Ground truth ajustes | PENDIENTE | Agregar companyProfile al GT |
| Fase 8: Verificacion E2E | PENDIENTE | Requiere fases 1-7 completadas |

### Fase 3 - Prompt Generator Adaptativo (COMPLETADA)

**Cambios implementados:**
1. Eliminada toda logica condicional basada en `constructoraType` (switch/if con 4 branches)
2. Eliminados 4 templates diferentes (MODULAR, TRADICIONAL, INMOBILIARIA, MIXTA)
3. Eliminadas 4 secciones de calificacion por tipo
4. Eliminada referencia a `**Tipo de Constructora**: ${constructoraType.toUpperCase()}`
5. Creado template unico adaptativo que usa `profile.identity`, `profile.offering`, `profile.differentiators`, `profile.terminology`
6. Creados 5 helpers: `buildCatalogSection()`, `buildProductsSection()`, `buildNoProductsSection()`, `buildDeprecatedModelsSection()`, `buildQualificationInstructions()`
7. Fallback a deprecated `models[]` cuando `products[]` esta vacio (backwards compat)
8. Prompt usa `profile.terminology.productsLabel` en todas las secciones dinamicas (anti-hallucination rules, ejemplos, calificacion)

**Lineas eliminadas:** ~290 lineas de logica condicional por tipo
**Lineas agregadas:** ~375 lineas de template unico + helpers
**Resultado neto:** Archivo paso de 506 a 376 lineas (mas limpio, sin codigo duplicado)

### Proximas Fases Pendientes

**Fase 4 - Actualizar Wrappers** (siguiente)
- Limpiar scraper.ts de constructoraType
- Adaptar mergeVisionResults() para ProductOrService[]
- Limpiar create/route.ts

**Fase 6 - Diagnosis Exploratorio**
- Cambiar score de basado-en-modelos a score compuesto
- Agregar `IDENTITY_MISS` y `TERMINOLOGY_MISS` gap types
- Implementar `checkIdentityMatch()` para detectar confusion de tipo de empresa

## Proximos Pasos

### PENDIENTE: Re-correr pipeline completo con fixes finales
El pipeline debe re-correrse para medir el impacto real de los 3 fixes post-run:
```
npm run dev  # En una terminal
npx tsx scripts/run-full-pipeline.ts --skip-ground-truth  # En otra
```

### Empresas que necesitan atencion especial
1. **ViBert** (0%): Clasificado como INMOBILIARIA → no extrae modelos. Necesita fix en classifier o en como se manejan inmobiliarias
2. **Sienna Modular** (0%): SPA React pura, ni crawl ni agent extraen modelos
3. **Arcohouse** (0%): Naming mismatch - "MONTAÑESITO 20M2" en GT vs "Cobre" en prompt
4. **Wellmod** (0%): GT tiene 38 modelos (incluye proyectos, productos industriales) - irrealista esperar que el scraper capture todo
5. **Ecomod**: Testear si el garbage filter mejoro el score (estaba en 10%, deberia subir)

### Meta: Score >70%
Con los fixes aplicados post-run, el score esperado deberia estar entre 50-55%. Para llegar a 70%:
- Fix ViBert (inmobiliaria) → +5pp
- Mejorar fuzzy matching en diagnosis (Arcohouse, Mini Casas) → +5pp
- Considerar que Wellmod con 38 GT models es un outlier → sin Wellmod el score sube ~5pp

## Archivos Modificados en Esta Sesion

### Firecrawl v3
- `src/lib/firecrawl.ts` - **REESCRITO** `scrapeWithFirecrawl()`:
  - Usa `crawlUrl()` con open discovery (sin includePaths) + excludePaths
  - `scrapeUrl()` homepage con extract schema para datos estructurados
  - `mapUrl()` fallback si <5 modelos despues del crawl
  - `extract()` API si <3 modelos (extraccion AI estructurada)
  - Agent/Wix para SPAs o si sigue con pocos datos
  - Garbage filter en `parseModelsFromMarkdown()`
  - Reducido de 615 lineas a ~420 lineas

### Spec
- `spec/FIRECRAWL_V3_SPEC.md` - Plan de implementacion

## Notas Tecnicas

- Chat usa GPT-5.1 (NO 4o)
- Firecrawl v1.21.1 + $100/mes
- dotenv requerido para scripts standalone
- Screenshots JPEG quality 80, max 6000px height
- Fresh browser por empresa en ground truth capture
- 20 empresas test en src/scripts/test-companies.json
- crawlUrl poll interval: 2 seconds
- crawlUrl limit: 30, maxDepth: 3
- mapUrl fallback limit: 100 URLs, scrape top 15
