# Análisis de Tests - 5 Empresas

## Resumen de Resultados (v1 - commit dc07d96)

| Empresa | Tipo Esperado | Tipo Obtenido | Modelos Extraídos | PASS/FAIL |
|---------|---------------|---------------|-------------------|-----------|
| Atlas Housing | Modular | MODULAR | Katerra, Upsala, Fitz Roy, Blackberry, Hexa, Montana (6) | **PASS** |
| ViBert | Modular | MODULAR | "No se encontraron modelos estructurados" | **FAIL** |
| Ecomod | Modular | MODULAR | "No se encontraron modelos estructurados" | **FAIL** |
| Movilhauss | Modular | MODULAR | inquba, inquba +, inquba duo, freestyle, inquba/work (5) | **PASS** |
| MakenHaus | Inmobiliaria/Tradicional | MODULAR | "No se encontraron modelos estructurados" | **FAIL** |

## Fix #1 (commit 410833e) - Clasificación Inmobiliaria

Se agregó clasificación `inmobiliaria` con keywords:
- desarrollos inmobiliarios
- proyectos inmobiliarios residenciales
- lotes/unidades en ejecución
- emprendimientos
- barrios cerrados/privados
- departamentos
- fideicomiso, preventa, etc.

**Problema encontrado**: La clasificación funcionaba pero se perdía al hacer fallback.

## Fix #2 (commit d2e04b5) - Preservar Clasificación en Fallback

**Bug**: Cuando Firecrawl extraía 0 modelos, se hacía `result = null` y se perdía el `constructoraType`.

**Fix**: Guardar `constructoraType` de Firecrawl ANTES de descartar el resultado, y restaurarlo al resultado final.

## Resultados Actualizados (v3 - commit d2e04b5)

| Empresa | Tipo Esperado | Tipo Obtenido | Modelos Extraídos | PASS/FAIL |
|---------|---------------|---------------|-------------------|-----------|
| Atlas Housing | Modular | MODULAR | 6 modelos | **PASS** |
| ViBert | Modular | MODULAR | Sin modelos (web Wix) | **FAIL** |
| Ecomod | Modular | MODULAR | Sin modelos | **FAIL** |
| Movilhauss | Modular | MODULAR | 5 modelos | **PASS** |
| MakenHaus | Inmobiliaria | **INMOBILIARIA** | N/A (es inmobiliaria) | **PASS** |

## Problemas Pendientes

### ViBert - Web Wix
- La web está construida con Wix que usa JavaScript pesado
- Firecrawl no logra extraer modelos del catálogo
- **Solución propuesta**: Usar Firecrawl Agent con screenshots para webs Wix

### Ecomod - Navegación a catálogo
- El contenido de modelos está en /modelos pero Firecrawl no navega ahí
- La web muestra "VER MODELOS" como link
- **Solución propuesta**: Mejorar detección de URLs de catálogo

### Metros cuadrados faltantes
- Atlas Housing y Movilhauss extraen nombres pero no m²
- La info está en páginas individuales de cada modelo
- **Solución propuesta**: Scrapear páginas individuales de modelos

## Commits del Fix

1. `410833e` - feat: agregar clasificación inmobiliaria para desarrolladoras
2. `74812e0` - chore: agregar logs v2 para debug clasificación
3. `d2e04b5` - fix: preservar clasificación Firecrawl al hacer fallback a Playwright

## Test Commands

```bash
# Test individual
curl -s -X POST "https://constructor-ai-simulator.vercel.app/api/simulator/create" \
  -H "Content-Type: application/json" \
  -d '{"websiteUrl":"https://[EMPRESA]"}' | jq '.'
```
