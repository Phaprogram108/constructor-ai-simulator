# Estado del Proyecto - Constructor AI Simulator

**Ultima actualizacion:** 2026-02-05 11:45 UTC

## Progreso de Fases

| Fase | Estado | Notas |
|------|--------|-------|
| FASE 1: QA Baseline | ✅ Completada | Scripts creados, baseline ejecutado |
| FASE 2: Mejoras Scraping | ✅ Completada | WhatsApp validator, linktree explorer |
| FASE 3: Anti-Alucinacion | ✅ Completada | Content search, response validator |
| FASE 4: Tipo Constructora | ✅ Completada | classifyConstructora() |
| FASE 5: Logging Mejorado | ✅ Completada | conversation-logger reescrito |
| FASE 6: QA Final | ✅ Completada | compare-results.ts creado |

## PROBLEMA ACTUAL (CRITICO)

El sistema **empeoró** después de implementar las 6 fases. El scraping no extrae modelos correctamente.

### Sintomas:
- ViBert: dice "no tenemos modelos" cuando SÍ los tiene
- Ecomod: dice "diseñamos a medida" cuando tiene catálogo definido
- Movilhauss: no extrae m² ni características (DVH) que están en la web
- MakenHaus: clasificado como "modular" cuando es inmobiliaria tradicional

### Ultimo Fix Aplicado (pendiente de testear):
Commit `dc07d96`:
- Agregado `extract` con `catalogSchema` en páginas de catálogo
- Agregadas actions para expandir cards de modelos (.fa-plus, etc.)
- Procesar modelos del extract antes de regex fallback

## Proxima Tarea

**TESTEAR las 5 empresas después del último deploy:**
1. Atlas Housing - verificar que extrae m² de modelos
2. ViBert - verificar que encuentra los modelos del catálogo
3. Ecomod - verificar que NO dice "a medida" sino que lista modelos
4. Movilhauss - verificar que extrae DVH y características
5. MakenHaus - verificar que NO dice "modular" (es inmobiliaria)

### Como testear:
```bash
# Crear sesión y ver qué modelos extrae
curl -s -X POST "https://constructor-ai-simulator.vercel.app/api/simulator/create" \
  -H "Content-Type: application/json" \
  -d '{"websiteUrl":"https://atlashousing.com.ar"}' | jq '.systemPrompt' | head -50
```

## Bloqueadores

1. **Sesiones no persisten en Vercel** - El chat devuelve "Sesión inválida" porque serverless no mantiene estado entre requests. Necesita storage externo (Redis/DB).

2. **Expandibles de modelos** - Atlas tiene los detalles en elementos expandibles (hay que hacer click en "+" para ver m²). Se agregaron actions pero no se verificó si funcionan.

## Archivos Clave Modificados

- `src/lib/firecrawl.ts` - Scraping principal (1300+ líneas)
- `src/lib/scraper.ts` - Orquestador de fallbacks
- `src/lib/whatsapp-validator.ts` - Validación de WhatsApp (NUEVO)
- `src/lib/linktree-explorer.ts` - Explorador de linktrees (NUEVO)
- `src/lib/conversation-logger.ts` - Logger JSON (REESCRITO)
- `src/lib/prompt-generator.ts` - Generador de prompts
