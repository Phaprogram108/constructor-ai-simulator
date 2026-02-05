# Snapshot de Contexto

**Fecha:** 2026-02-05 11:30 ART
**Proyecto:** /Users/joaquingonzalez/Documents/dev/constructor-ai-simulator
**Razón del snapshot:** Context refresh después de implementar soporte Wix

## Resumen del Proyecto

Constructor AI Simulator es una app Next.js que genera agentes de ventas IA para constructoras de casas. El usuario ingresa una URL de constructora, el sistema scrapea la web con Firecrawl, clasifica el tipo de empresa, y genera un chatbot personalizado.

## Estado Actual

- **Tests completados:** 5 empresas testeadas
- **5 PASS:** Atlas Housing, ViBert, Ecomod, Movilhauss, MakenHaus
- **Fixes aplicados:** Clasificación inmobiliarias + Soporte Wix
- **Commit actual:** ac938c0

## Resultados de Tests

| Empresa | Tipo Obtenido | Modelos | Estado |
|---------|---------------|---------|--------|
| Atlas Housing | MODULAR | 6 | **PASS** |
| ViBert | MODULAR | 14 (con m²) | **PASS** ✅ |
| Ecomod | MIXTA | 3 | **PASS** ✅ |
| Movilhauss | MODULAR | 6 | **PASS** |
| MakenHaus | **INMOBILIARIA** | N/A | **PASS** |

## Lo Que Se Arregló Esta Sesión

### 1. Clasificación Inmobiliaria
- Nuevo tipo `inmobiliaria` en el sistema
- 16 keywords: "desarrollos inmobiliarios", "lotes en ejecución", "unidades", "emprendimientos", etc.
- MakenHaus ahora se detecta correctamente como inmobiliaria

### 2. Bug del Fallback
- **Problema:** Cuando Firecrawl extraía 0 modelos, se hacía `result = null` y se perdía el `constructoraType`
- **Solución:** Guardar `constructoraType` ANTES de descartar resultado y restaurarlo después

### 3. Soporte para Sitios Wix (ViBert)
- **Problema:** Sitios Wix cargan menú con JavaScript, `mapUrl` no encuentra URLs
- **Solución:** Nueva función `scrapeWixSite()`:
  - Detecta Wix con `isWixSite()` (15 indicadores)
  - Prueba URLs directamente: `/casas`, `/modelos`, `/catalogo`
  - Peticiones en paralelo con `Promise.all`
  - Actions específicas para Wix
- **Resultado:** ViBert extrae 14 modelos con m², dormitorios, baños

## Decisiones Ya Tomadas (NO re-discutir)

1. **Usar Firecrawl** - Ya pagado, tiene AI extraction
2. **Tipo inmobiliaria** - Separado de tradicional (distintos keywords y flujo)
3. **Preservar clasificación** - Firecrawl tiene la mejor lógica de clasificación

## Contexto Técnico Importante

### Flujo de Clasificación
```
firecrawl.ts:classifyConstructora() → genera constructoraType
    ↓
scraper.ts → si 0 modelos, va a Playwright pero PRESERVA constructoraType
    ↓
prompt-generator.ts → usa constructoraType para generar secciones específicas
```

### Keywords de Inmobiliaria (score >= 8 para clasificar)
- desarrollos inmobiliarios (5 pts)
- proyectos inmobiliarios residenciales (5 pts)
- lotes/unidades en ejecución (4 pts c/u)
- emprendimientos, barrios cerrados (3-4 pts)

### El Bug que se Arregló
En `scraper.ts` líneas 80-85:
```javascript
// ANTES (bug)
if (result.models.length === 0) {
  result = null;  // ← PERDÍA constructoraType
}

// AHORA (fix)
firecrawlClassification = result.constructoraType;  // ← GUARDA
if (result.models.length === 0) {
  result = null;
}
// ... luego restaura firecrawlClassification al resultado final
```

## Archivos Clave Modificados

| Archivo | Qué cambió |
|---------|-----------|
| `src/types/index.ts:42` | Agregado `inmobiliaria` al union type |
| `src/lib/firecrawl.ts:624-665` | Keywords y lógica de inmobiliaria |
| `src/lib/prompt-generator.ts:77-110` | Sección para inmobiliarias |
| `src/lib/scraper.ts:71-115` | Preservar clasificación en fallback |

## Próximas Tareas (Opcionales)

1. **Precios** - Extraer precios cuando están disponibles en las páginas
2. **Más empresas** - Testear con más constructoras para validar robustez
3. **Performance** - Optimizar tiempos de scraping

## Para Continuar

Leer en este orden:
1. `/spec/STATE.md` - Estado actual detallado
2. `/spec/test-results/ANALISIS.md` - Análisis completo de tests
3. Este archivo

**Estado:** Todos los tests pasan (5/5). El sistema está funcionando correctamente.
