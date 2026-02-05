# Snapshot de Contexto

**Fecha:** 2026-02-05 11:45 UTC
**Proyecto:** /Users/joaquingonzalez/Documents/dev/constructor-ai-simulator
**Razon del snapshot:** Context refresh - sistema empeoró después de mejoras

## Resumen del Proyecto

Constructor AI Simulator es una app Next.js que genera agentes de ventas IA para constructoras de casas. El usuario ingresa una URL de constructora, el sistema scrapea la web con Firecrawl, y genera un chatbot que responde preguntas sobre modelos, precios, etc.

## Estado Actual

- **Todas las fases implementadas** (1-6) pero el sistema empeoró
- **Problema principal:** Firecrawl no extrae modelos correctamente
- **Ultimo fix:** Commit `dc07d96` - usar `extract` en páginas de catálogo
- **Pendiente:** Testear 5 empresas (Atlas, ViBert, Ecomod, Movilhauss, MakenHaus)

## El Problema en Detalle

El scraping extrae nombres de modelos pero NO extrae:
- Metros cuadrados (m²)
- Cantidad de dormitorios/baños
- Características técnicas (DVH, materiales)
- Precios (cuando están disponibles)

Además:
- Clasifica MAL el tipo de constructora (todo como "modular")
- No expande elementos colapsables donde están los detalles

## Empresas de Test y Qué Verificar

| Empresa | URL | Tipo Real | Verificar |
|---------|-----|-----------|-----------|
| Atlas Housing | atlashousing.com.ar | Modular | m² de modelos (están en expandibles con "+") |
| ViBert | vibert.com.ar | Modular | Modelos del catálogo (Casa Sara, etc.) |
| Ecomod | ecomod.com.ar | Modular | Que NO diga "a medida" - tiene catálogo |
| Movilhauss | movilhauss.com | Modular | DVH, características técnicas |
| MakenHaus | makenhaus.com.ar | Inmobiliaria | Que NO diga "modular" - vende proyectos/lotes |

## Decisiones Ya Tomadas (NO re-discutir)

1. **Usar Firecrawl** - Ya pagado $100/mes, tiene AI extraction
2. **No usar RAG con embeddings** - Empezar simple con keyword search
3. **Filesystem no funciona en Vercel** - Todos los fs.write envueltos en try/catch
4. **Nombre de empresa del dominio** - Si no extrae, usar fallback de URL

## Contexto Técnico Importante

### Firecrawl tiene 3 modos de extracción:
1. `formats: ['markdown']` - Solo texto raw (no estructurado)
2. `formats: ['markdown', 'extract']` con schema - AI extrae datos estructurados
3. Agent mode - Navega autónomamente (más costoso)

### El código actual:
- Homepage: usa `extract` con `catalogSchema` ✅
- Páginas de catálogo: AHORA usa `extract` (fix reciente) ⚠️ NO TESTEADO
- Páginas individuales: usa `extract` con `singleModelSchema` ✅

### Actions de Firecrawl:
Se agregaron actions para clickear expandibles pero pueden no funcionar para todos los sitios. Atlas usa un "+" que requiere selector específico.

## Archivos Clave

```
src/lib/firecrawl.ts       - Scraping con Firecrawl (línea 960 es donde procesa catálogo)
src/lib/scraper.ts         - Orquestador: Firecrawl -> Playwright -> fetch -> Vision
src/lib/prompt-generator.ts - Genera el system prompt del chatbot
src/scripts/qa-baseline.ts  - Script para testear 20 empresas
src/scripts/test-companies.json - Lista de empresas de test
```

## Para Continuar

1. Leer `spec/STATE.md` para ver el estado exacto
2. Testear las 5 empresas después del último deploy
3. Si sigue fallando, investigar:
   - ¿Qué URLs encuentra Firecrawl? (agregar logs)
   - ¿Qué devuelve `extract`? (agregar logs)
   - ¿Los actions están funcionando? (probar en Playwright local)

**Continuar desde:** Testear Atlas Housing y verificar si extrae m² de los modelos
