# Estado del Proyecto - Constructor AI Simulator

**Última actualización:** 2026-02-05 11:30 ART
**Commit actual:** ac938c0

## Progreso de Fases

| Fase | Estado | Notas |
|------|--------|-------|
| FASE 1: QA Baseline | ✅ Completada | Scripts creados, baseline ejecutado |
| FASE 2: Mejoras Scraping | ✅ Completada | WhatsApp validator, linktree explorer |
| FASE 3: Anti-Alucinación | ✅ Completada | Content search, response validator |
| FASE 4: Tipo Constructora | ✅ Completada | classifyConstructora() mejorado |
| FASE 5: Logging Mejorado | ✅ Completada | conversation-logger reescrito |
| FASE 6: QA Final | ✅ Completada | compare-results.ts creado |
| **Hotfix: Inmobiliarias** | ✅ Completada | Clasificación inmobiliaria + fix fallback |
| **Hotfix: Wix Support** | ✅ Completada | scrapeWixSite() con URLs directas |

## Estado Actual de Tests (5 Empresas)

| Empresa | Tipo | Modelos | Estado |
|---------|------|---------|--------|
| Atlas Housing | MODULAR | 6 | **PASS** |
| ViBert | MODULAR | 14 (con m²) | **PASS** ✅ ARREGLADO |
| Ecomod | MIXTA | 3 | **PASS** ✅ MEJORADO |
| Movilhauss | MODULAR | 6 | **PASS** |
| MakenHaus | **INMOBILIARIA** | N/A | **PASS** |

## Fixes Implementados Esta Sesión

### Fix 1: Clasificación Inmobiliaria (commit 410833e)
- Nuevo tipo `inmobiliaria` en types/index.ts
- 16 keywords en firecrawl.ts: desarrollos inmobiliarios, lotes en ejecución, unidades, emprendimientos, etc.
- Secciones específicas en prompt-generator.ts para inmobiliarias
- Flujo de calificación diferenciado

### Fix 2: Preservar Clasificación en Fallback (commit d2e04b5)
- **Bug**: Cuando Firecrawl extraía 0 modelos, `result = null` descartaba el `constructoraType`
- **Fix**: En scraper.ts, guardar `constructoraType` ANTES de descartar resultado y restaurarlo después

### Fix 3: Soporte Wix (commits 44f6945, 1e02a32, 325ea7d)
- **Problema**: Sitios Wix (como ViBert) cargan menú con JavaScript, mapUrl no encuentra URLs
- **Solución**: Nueva función `scrapeWixSite()` que:
  - Detecta sitios Wix con `isWixSite()`
  - Prueba URLs de catálogo directamente: `/casas`, `/modelos`, `/catalogo`
  - Hace peticiones en paralelo con Promise.all
  - Usa actions específicas para Wix
- **Resultado**: ViBert ahora extrae 14 modelos con m², dormitorios, baños

## Próximas Tareas (Opcionales)

1. **Precios** - Extraer precios cuando están disponibles
2. **Metros cuadrados individuales** - Algunos modelos no tienen m² (páginas individuales)
3. **Performance** - Optimizar tiempos de scraping

## Archivos Modificados en Esta Sesión

| Archivo | Cambio |
|---------|--------|
| `src/types/index.ts` | Agregado tipo `inmobiliaria` |
| `src/lib/firecrawl.ts` | Clasificación inmobiliaria con keywords, logs debug |
| `src/lib/prompt-generator.ts` | Secciones específicas para inmobiliarias |
| `src/lib/scraper.ts` | Fix para preservar clasificación en fallback |
| `src/lib/conversation-logger.ts` | Tipo inmobiliaria |
| `spec/test-results/ANALISIS.md` | Documentación de tests |

## Notas Técnicas Importantes

- Firecrawl tiene problemas con webs Elementor (errores 500 en actions)
- Webs Wix (ViBert) requieren Agent con screenshots
- La clasificación inmobiliaria se detecta con score >= 8
- El bug del fallback estaba en scraper.ts líneas 80-85

## Bloqueadores Resueltos

- ~~MakenHaus clasificado como modular~~ → Ahora es INMOBILIARIA
- ~~Clasificación se perdía en fallback~~ → Ahora se preserva
