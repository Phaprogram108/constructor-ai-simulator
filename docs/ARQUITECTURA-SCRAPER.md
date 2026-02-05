# Arquitectura del Scraper - Constructor AI

## Flujo de Scraping

```
URL de entrada
      |
      v
[1. Firecrawl Map] --> Lista de URLs del sitio
      |
      v
[2. Priorizar URLs] --> /casas, /catalogo, /faq primero
      |
      v
[3. Scrape con Actions] --> Expandir FAQs, scroll, clicks
      |
      v
[4. Parse Markdown] --> Regex para modelos, contacto
      |
      v
[5. Fallback: Vision] --> Si < 3 modelos, usar screenshots
      |
      v
[6. Generar Prompt] --> systemPrompt para Claude
```

## Componentes

### 1. Firecrawl Map (`/v1/map`)

Obtiene todas las URLs del sitio:
```typescript
const mapResult = await firecrawl.map(url);
// Retorna: ['/', '/casas', '/contacto', '/faq', ...]
```

### 2. Priorizacion de URLs

```typescript
const HIGH_PRIORITY_PATHS = [
  '/casas', '/catalogo', '/modelos', '/viviendas',
  '/faq', '/preguntas-frecuentes',
  '/tipologias', '/especificaciones',
  '/cobertura', '/envios', '/zonas',
  '/proceso', '/como-trabajamos', '/financiacion'
];
```

Se scrapen hasta `MAX_CATALOG_URLS = 15` URLs priorizadas.

### 3. Scrape con Actions Universales

```typescript
const UNIVERSAL_ACTIONS = [
  // Esperar carga
  { type: 'wait', milliseconds: 2000 },

  // Scroll para lazy loading
  { type: 'scroll', direction: 'down' },

  // Expandir FAQs
  { type: 'click', selector: '[aria-expanded="false"]' },
  { type: 'click', selector: '[class*="accordion"]' },
  { type: 'click', selector: 'details summary' },

  // Click WhatsApp
  { type: 'click', selector: '[href*="whatsapp"]' },
];
```

### 4. Parsing de Markdown

Patrones regex para extraer:

**Modelos de casas:**
```typescript
// Formato: "Casa Sara - 2 personas 65.55 m2"
/(?:casa|modelo|vivienda)\s+(\w+).*?(\d+(?:[.,]\d+)?)\s*m[²2]/gi

// Formato Wellmod: "W26 Suite | 26 m2"
/([A-Z]\d+\s*\w*)\s*[|\-]\s*(\d+)\s*m2/gi
```

**Contacto:**
```typescript
// WhatsApp
/(?:wa\.me|whatsapp)\/(\d+)/gi

// Telefono
/(?:tel|phone).*?(\+?\d[\d\s\-]{8,})/gi
```

**FAQs:**
```typescript
function extractFAQContent(markdown: string): FAQ[] {
  // Busca patrones de pregunta-respuesta
  const patterns = [
    /\*\*(.+?)\?\*\*\s*\n+(.+?)(?=\n\n|\*\*|$)/g,
    /#+\s*(.+?\?)\s*\n+(.+?)(?=\n#|$)/g
  ];
}
```

### 5. Fallback: Vision Scraper

Cuando el scraping normal falla (< 3 modelos):

```typescript
async function scrapeWithVision(url: string) {
  // 1. Screenshot con Playwright
  const screenshot = await captureFullPage(url);

  // 2. Enviar a Claude Vision
  const extracted = await analyzeScreenshotWithClaude(screenshot, {
    prompt: 'Extrae modelos, precios, especificaciones...'
  });

  return extracted;
}
```

Condiciones para usar Vision:
- URL contiene `/modelo/`, `/ficha/`, `/detalle/`
- Pagina tiene imagenes de planos
- Scraping normal extrae < 3 modelos

### 6. Generacion de Prompt

```typescript
function generateSystemPromptWithCatalog({ scrapedContent, catalog }) {
  return `
Sos Sofia, asesora de ${scrapedContent.title}.

## MODELOS DISPONIBLES
${scrapedContent.models.join('\n')}

## INFORMACION DE CONTACTO
${scrapedContent.contactInfo}

## CONTENIDO DEL SITIO (buscar aqui si no hay info estructurada)
${scrapedContent.rawText.slice(0, 12000)}

## INSTRUCCIONES
- PRIMERO busca en secciones estructuradas
- SI NO ENCONTRAS, busca en CONTENIDO DEL SITIO
- SOLO si no encontras nada, di "no tengo esa info"
`;
}
```

## Manejo de Errores

### Scraping Fallido

Si no se puede extraer el nombre de la empresa:

```typescript
// scraper.ts
export const SCRAPING_FAILED_MARKER = '__SCRAPING_FAILED__';

// En lugar de:
title: companyName || 'Empresa Constructora'

// Ahora:
title: companyName || SCRAPING_FAILED_MARKER

// route.ts detecta y devuelve error 422:
if (scrapedContent.title === SCRAPING_FAILED_MARKER) {
  return NextResponse.json({
    error: 'No pudimos procesar este sitio web...',
    code: 'SCRAPING_FAILED'
  }, { status: 422 });
}
```

## Metricas

| Metrica | Valor |
|---------|-------|
| Tiempo scraping promedio | 50-120s |
| URLs scrapeadas por empresa | 10-15 |
| Tasa exito WhatsApp | ~5% |
| Tasa exito modelos | ~70% |
| Costo Firecrawl | $100/mes |

## Archivos Clave

| Archivo | Lineas | Responsabilidad |
|---------|--------|-----------------|
| `src/lib/firecrawl.ts` | ~1000 | Scraping principal |
| `src/lib/scraper.ts` | ~800 | Orquestador |
| `src/lib/vision-scraper.ts` | ~200 | Fallback Vision |
| `src/lib/prompt-generator.ts` | ~400 | Genera systemPrompt |

---

*Ultima actualizacion: 2026-02-04*
