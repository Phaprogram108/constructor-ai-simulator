# Snapshot de Contexto

**Fecha:** 2026-02-05 23:00 ART
**Proyecto:** /Users/joaquingonzalez/Documents/dev/constructor-ai-simulator
**Razon del snapshot:** Context saturado. Firecrawl v3 implementado, score subio de 26% a 46%. Fixes adicionales aplicados pero no medidos aun.

## Resumen del Proyecto

Constructor AI Simulator es una app Next.js 14 que genera agentes de ventas IA para constructoras argentinas. El usuario ingresa una URL, el sistema scrapea con Firecrawl/Playwright, clasifica el tipo de empresa (modular/tradicional/mixta/inmobiliaria), genera un system prompt, y crea un chatbot con GPT-5.1.

## Estado Actual

- **Firecrawl v3 implementado** en `src/lib/firecrawl.ts`
- Score subio de 26% (v2) a 46% (v3 primer run)
- Hallucinations bajaron de 16 a 2 (-87.5%)
- 3 fixes adicionales aplicados DESPUES del run de 46% (aun no medidos)
- **Proximo paso: Re-correr pipeline para medir impacto de fixes finales**

## Lo Que Se Hizo en Esta Sesion

### 1. Reescritura de scrapeWithFirecrawl() - Firecrawl v3
La funcion principal fue reescrita (615 → ~420 lineas):

**Flujo viejo (v2):**
mapUrl → filtrar URLs por keywords → scrapeUrl cada una → Agent fallback

**Flujo nuevo (v3):**
1. `crawlUrl()` sin includePaths (open discovery, limit 30, maxDepth 3)
2. `scrapeUrl()` homepage con extract schema
3. `mapUrl()` fallback si <5 modelos (descubre URLs que crawl perdio)
4. `extract()` API si <3 modelos (extraccion AI)
5. Agent/Wix para SPAs o pocos datos

### 2. Garbage model name filter
`parseModelsFromMarkdown()` ahora filtra nombres basura:
- Excluye frases comunes ("tiene", "superficie", "muestra", etc.)
- Max 6 palabras, min 2 chars
- Debe empezar con mayuscula o numero

### 3. Primer run del pipeline v3
Score: 46% (vs 26% baseline). Grandes mejoras:
- GoHome: 0% → 100% (crawlUrl navega subpaginas)
- Offis: no testeado → 100% (30 prompt models)
- PlugArq: 0 models → 10 models (proyectos encontrados)
- Aftamantes: 33% → 67%
- Atlas Housing: 0% → 50%
- Hallucinations: 16 → 2

### 4. Fixes post-run (NO medidos aun)
- Removed `includePaths` del crawlUrl (open discovery)
- Garbage filter en parseModelsFromMarkdown
- mapUrl fallback si <5 modelos

## Decisiones Ya Tomadas (NO re-discutir)

1-13. (igual que antes - ver listado completo en sesion anterior)
14. crawlUrl reemplaza mapUrl+scrapeUrl como metodo principal
15. Open discovery (sin includePaths) - excludePaths basta para filtrar basura
16. mapUrl como fallback, no como paso principal
17. extract() API para <3 modelos (extraccion AI estructurada)
18. Garbage filter: max 6 words, must start uppercase/number, exclude common phrases
19. ViBert clasificado como INMOBILIARIA es correcto - los "modelos" son proyectos inmobiliarios

## Archivos Clave Modificados en Esta Sesion

- `src/lib/firecrawl.ts` - REESCRITO: scrapeWithFirecrawl() con crawlUrl + extract() + mapUrl fallback + garbage filter
- `spec/FIRECRAWL_V3_SPEC.md` - NUEVO: plan de implementacion
- `spec/STATE.md` - Actualizado con resultados v3

## Contexto Tecnico Importante

### Flujo del Sistema
```
URL -> firecrawl.ts (crawlUrl + extract + mapUrl fallback + Agent) -> prompt-generator.ts -> session
     -> chat con GPT-5.1 + response-validator.ts
```

### Firecrawl v3 - Endpoints Usados
| Endpoint | Paso | Para Que |
|----------|------|----------|
| /crawl | Step 1 | Descubrir Y scrapear paginas (limit 30, maxDepth 3) |
| /scrape | Step 2 | Homepage con extract schema (datos estructurados) |
| /map | Step 2.5 | Fallback: descubrir URLs que crawl perdio (si <5 modelos) |
| /extract | Step 3 | Extraccion AI estructurada (si <3 modelos) |
| /agent | Step 4 | SPAs y sitios complejos (Wix, etc.) |

### Resultados del Diagnostico (Run 3 - v3)
| Metrica | v2 | v3 | Cambio |
|---------|-----|-----|--------|
| Score Promedio | 26% | 46% | +77% |
| Companies | 15 | 18 | +3 |
| SCRAPING_MISS | 100 | 106 | = (3 mas empresas) |
| HALLUCINATION | 16 | 2 | -87.5% |

### Empresas Problematicas (para atencion futura)
| Empresa | Score | Problema |
|---------|-------|----------|
| ViBert | 0% | Clasificada INMOBILIARIA - modelos son proyectos |
| Sienna Modular | 0% | SPA React pura |
| Arcohouse | 0% | Naming mismatch GT vs prompt |
| Wellmod | 0% | GT tiene 38 modelos (industrial + residencial) |
| Ecomod | 10%→? | Garbage filter aplicado post-run, deberia mejorar |

## Para Continuar

Leer en este orden:
1. Este archivo
2. `spec/STATE.md`
3. `ground-truth/REPORT.md` - diagnostico actual (del run sin fixes finales)

**Continuar desde:** Re-correr pipeline completo para medir impacto de fixes finales:
```bash
npm run dev  # Terminal 1
npx tsx scripts/run-full-pipeline.ts --skip-ground-truth  # Terminal 2
```

Despues del run:
1. Comparar scores con run anterior (esperado ~50-55%)
2. Si <70%, investigar empresas problematicas individualmente
3. Considerar mejorar fuzzy matching en `scripts/diagnosis.ts` (Arcohouse, Mini Casas tienen naming mismatch)
4. Considerar si Wellmod (38 GT models) es un outlier que deberia excluirse del promedio

**Meta:** Score promedio >70%
