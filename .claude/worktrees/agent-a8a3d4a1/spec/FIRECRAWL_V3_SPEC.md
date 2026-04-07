# Firecrawl v3 - Spec de Mejoras

## Problema
Score promedio: 26%. El 86% de gaps son SCRAPING_MISS. La causa raiz es que usamos `mapUrl()` + `scrapeUrl()` individual, que no navega subpaginas.

## Solucion

### Cambio 1: Reemplazar mapUrl + scrapeUrl loop con crawlUrl (MAYOR IMPACTO)

**Archivo:** `src/lib/firecrawl.ts` - funcion `scrapeWithFirecrawl()`

**Flujo actual (lineas 1103-1717):**
1. `mapUrl(url, { limit: 100 })` → descubre URLs
2. Filtra URLs por keywords
3. `scrapeUrl()` homepage en paralelo
4. `scrapeUrl()` cada catalog URL con extract schema (batches de 10)
5. `scrapeUrl()` model URLs individuales si faltan modelos
6. Agent como fallback

**Flujo nuevo:**
1. `crawlUrl(url, params)` → descubre Y scrapea todo en un paso (retorna markdown de cada pagina)
2. `scrapeUrl()` homepage con extract schema (para datos estructurados de empresa)
3. Parsear markdown de todas las paginas crawleadas → extraer modelos
4. Si hay <3 modelos, usar `extract()` para extraccion AI estructurada
5. Agent para SPAs o si sigue con pocos datos

**Parametros del crawlUrl:**
```typescript
const crawlResult = await getFirecrawl().crawlUrl(url, {
  includePaths: [
    // Catalogo/modelos
    '/casas*', '/casa-*', '/modelos*', '/modelo-*',
    '/catalogo*', '/productos*', '/producto-*',
    '/viviendas*', '/vivienda-*',
    '/portfolio*', '/proyectos*', '/proyecto-*',
    '/quinchos*', '/quincho-*',
    '/refugio*', '/cabana*', '/cabin*',
    '/tipologia*', '/linea-*', '/lineas*',
    '/modular*', '/modulares*',
    // Info importante
    '/faq*', '/preguntas*',
    '/contacto*', '/contact*',
    '/nosotros*', '/about*', '/empresa*',
    '/proceso*', '/como-trabajamos*',
    '/servicios*',
    '/cobertura*', '/envios*',
    '/financiacion*', '/financiamiento*',
    '/especificaciones*', '/caracteristicas*',
  ],
  excludePaths: [
    '/wp-json*', '/cdn-cgi*', '/api/*',
    '/wp-content/uploads*', '/assets/images*',
    '/admin*', '/login*', '/cart*', '/checkout*',
    '/blog*', '/noticias*', '/prensa*',
  ],
  limit: 25,
  maxDepth: 3,
  scrapeOptions: {
    formats: ['markdown'],
    onlyMainContent: true,
    waitFor: 2000,
  }
}, 2); // poll interval 2 seconds
```

**Procesamiento del resultado:**
```typescript
if (crawlResult.success) {
  for (const doc of crawlResult.data) {
    // doc.markdown tiene el contenido
    // doc.url tiene la URL
    allMarkdown.push(`\n--- URL: ${doc.url} ---\n${doc.markdown}`);

    // Parsear modelos de cada pagina
    const models = parseModelsFromMarkdown(doc.markdown);
    allModels = mergeModels(allModels, models);

    // Extraer contacto, WhatsApp, etc.
    extractContactFromMarkdown(doc.markdown, contactInfo);
  }
}
```

### Cambio 2: Agregar extract() para extraccion estructurada

Despues del crawl, si tenemos <3 modelos, usar extract() para extraccion AI:

```typescript
const extractResult = await getFirecrawl().extract(
  [url + '/*'],
  {
    prompt: 'Extract ALL house/home models from this construction company website. Include name, square meters, bedrooms, bathrooms, and price for each.',
    schema: catalogSchema,
  }
);
```

### Cambio 3: Deteccion temprana de SPAs

Despues del crawl, si:
- crawl retorna <3 paginas, o
- total markdown < 5000 chars

→ Ir directo a agent sin esperar fallback.

## Estructura del codigo nuevo

La funcion `scrapeWithFirecrawl()` queda asi:

```
1. crawlUrl() con includePaths [NUEVO - reemplaza mapUrl + scrapeUrl loop]
2. scrapeUrl() homepage con extract schema [MANTENER - para datos estructurados]
3. Procesar todas las paginas del crawl [NUEVO - loop sobre crawlResult.data]
4. Si <3 modelos → extract() [NUEVO]
5. Si SPA detectada → agent directo [MEJORADO]
6. Agent fallback si sigue con pocos datos [MANTENER]
7. Clasificar y retornar [MANTENER]
```

## Lo que NO cambia
- Schemas (catalogSchema, singleModelSchema) - mantener
- parseModelsFromMarkdown() - mantener
- mergeModels(), deduplicateModels() - mantener
- extractWhatsAppImproved() - mantener
- extractSocialLinks() - mantener
- scrapeWithAgent(), scrapeWixSite() - mantener
- formatModelString(), formatContactInfo() - mantener
- classifyConstructora() - mantener
- UNIVERSAL_ACTIONS - ya no se usa en scrapeUrl (crawl no las soporta), pero mantener para Wix fallback
- AGENT_EXTRACTION_PROMPT, WIX_AGENT_PROMPT - mantener

## Estimacion de costos
- crawlUrl con limit:25 = ~25 credits ($0.025)
- homepage scrapeUrl = 1 credit ($0.001)
- extract() = ~5 credits ($0.005)
- Total: ~31 credits por empresa (~$0.031)
- Vs actual: mapUrl(1) + scrapeUrl(15) = ~16 credits ($0.016)
- Aumento: ~2x en costos, pero el beneficio es 3-4x mas modelos capturados
