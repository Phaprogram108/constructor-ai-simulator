# Plan de Scraping Mejorado para Constructor AI Simulator

**Fecha:** 2026-02-03
**Autor:** Claude (Spec Planner)
**Empresa de prueba:** vibert.com.ar

---

## 1. Diagnostico del Problema Actual

### 1.1 Problemas Identificados

1. **Sitios Wix/React no renderizan contenido**: vibert.com.ar es un sitio Wix que carga todo via JavaScript. El fetch basico obtiene solo el loader de Wix ("Wix Thunderbolt renderer"), no el contenido real.

2. **Playwright insuficiente para SPAs complejas**: Aunque el scraper actual usa Playwright, no:
   - Espera eventos de red (todas las requests AJAX)
   - Hace scroll para cargar contenido lazy
   - Interactua con elementos (tabs, modales, sliders)

3. **Single-page sin links internos**: vibert.com.ar probablemente tiene todo en una sola pagina con secciones via scroll/tabs, no links tradicionales.

4. **Extraccion no estructurada**: Claude recibe texto plano y tiene que adivinar estructura. No hay schema definido.

### 1.2 Evidencia del Problema

```
WebFetch de vibert.com.ar devolvio:
- Phone: +54 9 3425 081468 (unico dato extraido)
- Modelos: "No detailed information available"
- El contenido real NO se cargo porque es JavaScript
```

---

## 2. Analisis de Herramientas Investigadas

### 2.1 Firecrawl (mendableai/firecrawl)

| Aspecto | Evaluacion |
|---------|------------|
| **JS/SPA** | Excelente - maneja sitios dinamicos, anti-bot |
| **LLM Integration** | Nativo - Extract con schemas, LangChain ready |
| **TypeScript** | SDK oficial para Node.js |
| **Hosting** | API hosteada + self-host (limitado) |
| **Costo** | Free: 500 paginas. Hobby: $16/mes (3000 pag). Standard: $83/mes (100k pag) |

**Pros:**
- Solucion todo-en-uno
- Extract estructurado con AI built-in
- Maneja Cloudflare, Wix, React automaticamente
- SDK TypeScript listo para usar

**Contras:**
- Costo mensual para uso intensivo
- Dependencia de servicio externo
- Self-host no esta production-ready

**Veredicto:** MEJOR OPCION para nuestro caso

---

### 2.2 Crawlee (apify/crawlee)

| Aspecto | Evaluacion |
|---------|------------|
| **JS/SPA** | Excelente - Playwright/Puppeteer nativo |
| **LLM Integration** | Manual - hay que integrarlo |
| **TypeScript** | Nativo, escrito en TypeScript |
| **Hosting** | Self-host o Apify Cloud |
| **Costo** | Gratis (Apache 2.0) |

**Pros:**
- Gratis y open source
- Control total sobre el scraping
- Muy maduro (21.5k stars)
- Proxy rotation, retry automatico

**Contras:**
- Hay que implementar la extraccion con LLM manualmente
- Mas codigo para escribir
- Requiere mas mantenimiento

**Veredicto:** Segunda mejor opcion - mas trabajo pero gratis

---

### 2.3 Scrapling (D4Vinci/Scrapling)

| Aspecto | Evaluacion |
|---------|------------|
| **JS/SPA** | Bueno - DynamicFetcher con Playwright |
| **Anti-bot** | Excelente - bypass Cloudflare, fingerprint spoofing |
| **TypeScript** | NO - Python only |
| **Costo** | Gratis (BSD-3) |

**Veredicto:** No aplica - requeriria microservicio Python separado

---

### 2.4 Scrapy (scrapy/scrapy)

| Aspecto | Evaluacion |
|---------|------------|
| **JS/SPA** | No nativo - requiere Splash o Playwright plugin |
| **TypeScript** | NO - Python only |
| **Costo** | Gratis |

**Veredicto:** No aplica - mismo problema que Scrapling

---

### 2.5 Deep Research (dzhng/deep-research)

| Aspecto | Evaluacion |
|---------|------------|
| **Proposito** | Investigacion iterativa, no scraping puntual |
| **Usa Firecrawl** | Si, internamente |

**Veredicto:** Overkill para nuestro caso - es para research, no extraccion

---

### 2.6 WebMagic (code4craft/webmagic)

| Aspecto | Evaluacion |
|---------|------------|
| **JS/SPA** | Requiere Selenium module separado |
| **TypeScript** | NO - Java only |

**Veredicto:** No aplica - ecosistema Java

---

### 2.7 Crawlee Python (apify/crawlee-python)

| Aspecto | Evaluacion |
|---------|------------|
| **JS/SPA** | Excelente - PlaywrightCrawler |
| **TypeScript** | NO - Python only |

**Veredicto:** Buena alternativa si migraramos a Python, pero no para Next.js

---

## 3. Matriz de Comparacion Final

| Herramienta | JS/SPA | LLM | TypeScript | Gratis | Recomendada |
|-------------|--------|-----|------------|--------|-------------|
| **Firecrawl** | 5/5 | 5/5 | 5/5 | 2/5 | **SI** |
| **Crawlee** | 5/5 | 2/5 | 5/5 | 5/5 | Segunda opcion |
| Scrapling | 4/5 | 2/5 | 0/5 | 5/5 | No |
| Scrapy | 2/5 | 1/5 | 0/5 | 5/5 | No |
| Deep Research | 4/5 | 5/5 | 3/5 | 5/5 | Overkill |
| WebMagic | 2/5 | 0/5 | 0/5 | 5/5 | No |

---

## 4. Recomendacion Final

### 4.1 Solucion Recomendada: Firecrawl API

**Por que Firecrawl:**

1. **Resuelve el problema exacto**: Sitios Wix/React que no renderizan con fetch/Playwright simple
2. **Extraccion estructurada nativa**: Define un schema y obtenes JSON limpio
3. **Integracion trivial**: 10 lineas de codigo en TypeScript
4. **Costo razonable**: 500 paginas gratis para probar, luego $16/mes para 3000 paginas

### 4.2 Costo-Beneficio

```
Escenario: 50 constructoras, scraping inicial + refresh mensual
- Scraping inicial: 50 empresas x 5 paginas = 250 creditos
- Refresh mensual: 250 creditos
- Total mensual: ~500 creditos

Plan Free (500 creditos) = $0 para MVP
Plan Hobby ($16/mes, 3000 creditos) = suficiente para 600 empresas/mes
```

### 4.3 Alternativa Hibrida (Menor Costo)

Si el costo es problema:

1. **Usar Firecrawl solo para sitios problematicos** (Wix, React SPAs)
2. **Mantener Playwright para sitios simples** (WordPress, HTML estatico)
3. **Detectar tipo de sitio** antes de scrapear

---

## 5. Plan de Implementacion

### Fase 1: Integracion Basica de Firecrawl (2-3 horas)

**Archivos a modificar:**
- `/src/lib/scraper.ts` - Agregar Firecrawl como metodo principal
- `package.json` - Agregar dependencia `@mendable/firecrawl-js`
- `.env.local` - Agregar `FIRECRAWL_API_KEY`

**Tareas:**
1. [ ] Obtener API key de Firecrawl (firecrawl.dev)
2. [ ] Instalar SDK: `npm install @mendable/firecrawl-js`
3. [ ] Crear funcion `scrapeWithFirecrawl()` con schema estructurado
4. [ ] Actualizar `scrapeWebsite()` para usar Firecrawl primero

**Schema sugerido para extraccion:**
```typescript
const constructoraSchema = {
  type: "object",
  properties: {
    companyName: { type: "string" },
    description: { type: "string" },
    models: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          squareMeters: { type: "number" },
          bedrooms: { type: "number" },
          bathrooms: { type: "number" },
          price: { type: "string" },
          features: { type: "array", items: { type: "string" } }
        }
      }
    },
    services: { type: "array", items: { type: "string" } },
    contactInfo: {
      type: "object",
      properties: {
        phone: { type: "string" },
        whatsapp: { type: "string" },
        email: { type: "string" },
        address: { type: "string" }
      }
    },
    locations: { type: "array", items: { type: "string" } },
    constructionMethod: { type: "string" },
    financing: { type: "boolean" }
  }
};
```

---

### Fase 2: Test con vibert.com.ar (1 hora)

**Tareas:**
1. [ ] Ejecutar scraping de vibert.com.ar con Firecrawl
2. [ ] Comparar output vs scraper actual
3. [ ] Validar que extrae modelos con m2, precios, etc.
4. [ ] Ajustar schema si es necesario

**Criterio de exito:**
- Extraer al menos 3 modelos de casa con especificaciones
- Obtener precios o rangos de precios
- Informacion de contacto completa

---

### Fase 3: Fallback Inteligente (1-2 horas)

**Archivos a modificar:**
- `/src/lib/scraper.ts`

**Logica:**
```typescript
async function scrapeWebsite(url: string): Promise<ScrapedContent> {
  // 1. Intentar con Firecrawl (mejor para SPAs)
  try {
    const result = await scrapeWithFirecrawl(url);
    if (result.models.length > 0) return result;
  } catch (e) {
    console.log('[Scraper] Firecrawl failed, trying Playwright');
  }

  // 2. Fallback a Playwright mejorado
  try {
    return await deepScrapeWithPlaywright(url);
  } catch (e) {
    console.log('[Scraper] Playwright failed, using basic fetch');
  }

  // 3. Ultimo recurso: fetch basico
  return await basicFetchScrape(url);
}
```

---

### Fase 4: Mejoras en Playwright (Opcional, 2-3 horas)

Si queremos reducir dependencia de Firecrawl:

**Mejoras a implementar:**
1. [ ] Esperar `networkidle` en lugar de `domcontentloaded`
2. [ ] Auto-scroll para cargar contenido lazy
3. [ ] Detectar y clickear tabs/secciones
4. [ ] Extraer datos de sliders/carousels

**Codigo de scroll automatico:**
```typescript
async function autoScrollPage(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}
```

---

## 6. Modelo de LLM para Extraccion

### Comparacion de Modelos

| Modelo | Costo/1M tokens | Velocidad | Calidad | Recomendado |
|--------|-----------------|-----------|---------|-------------|
| Claude Sonnet 4 | $3 input, $15 output | Rapido | Excelente | **SI** |
| Claude Haiku 3.5 | $0.25 input, $1.25 output | Muy rapido | Buena | Para alto volumen |
| GPT-4o-mini | $0.15 input, $0.60 output | Muy rapido | Buena | Alternativa barata |
| Gemini Flash | $0.075 input, $0.30 output | Muy rapido | Aceptable | Mas barato |

### Recomendacion

**Para el scraper:**
- **Firecrawl ya incluye LLM** en su Extract - no necesitas llamar a otro modelo
- Si usas Playwright + extraccion manual: **Claude Haiku 3.5** (barato y suficiente)

**Para el agente de chat:**
- Mantener **Claude Sonnet 4** (ya configurado en el proyecto)

---

## 7. Manejo de Sitios Single-Page (vibert.com.ar)

### Estrategia Especifica

Los sitios como vibert.com.ar tienen todo en una pagina con:
- Navegacion por scroll
- Tabs/acordeones para mostrar modelos
- Sliders/carousels de imagenes

**Solucion con Firecrawl:**
```typescript
// Firecrawl maneja esto automaticamente con su opcion de scraping
const result = await firecrawl.scrape(url, {
  formats: ['markdown', 'extract'],
  extract: {
    schema: constructoraSchema
  },
  waitFor: 5000, // Esperar JS
  actions: [
    { type: 'scroll', direction: 'down', amount: 'full' }
  ]
});
```

**Solucion con Playwright (manual):**
```typescript
// 1. Scroll completo
await autoScrollPage(page);

// 2. Clickear todos los tabs visibles
const tabs = await page.$$('[role="tab"], .tab, [data-tab]');
for (const tab of tabs) {
  await tab.click();
  await page.waitForTimeout(1000);
}

// 3. Expandir acordeones
const accordions = await page.$$('[data-accordion], .accordion-header');
for (const acc of accordions) {
  await acc.click();
  await page.waitForTimeout(500);
}

// 4. Ahora extraer contenido
const content = await extractPageContent(page);
```

---

## 8. Estimacion de Mejora Esperada

### Metricas Actuales (Estimadas)

| Metrica | Valor Actual |
|---------|--------------|
| Tasa de extraccion exitosa | ~30% |
| Modelos extraidos por sitio | 0-1 |
| Precios extraidos | ~10% |
| Tiempo de respuesta | 5-10 seg |

### Metricas Esperadas con Firecrawl

| Metrica | Valor Esperado |
|---------|----------------|
| Tasa de extraccion exitosa | ~85% |
| Modelos extraidos por sitio | 3-8 |
| Precios extraidos | ~60% |
| Tiempo de respuesta | 8-15 seg |

### ROI

```
Mejora en conversion de demos: +50% (agente responde con datos reales)
Costo: $16/mes (Plan Hobby)
ROI: Si 1 demo convertido = $X, el costo se paga con 1 conversion extra
```

---

## 9. Checklist de Implementacion

### Pre-requisitos
- [ ] Cuenta en firecrawl.dev
- [ ] API key obtenida
- [ ] Creditos disponibles (free tier: 500)

### Fase 1 - Integracion
- [ ] `npm install @mendable/firecrawl-js`
- [ ] Crear `/src/lib/firecrawl.ts`
- [ ] Definir schema de extraccion
- [ ] Agregar FIRECRAWL_API_KEY a .env

### Fase 2 - Testing
- [ ] Test con vibert.com.ar
- [ ] Comparar resultados
- [ ] Documentar mejoras

### Fase 3 - Produccion
- [ ] Integrar en scraper principal
- [ ] Configurar fallbacks
- [ ] Monitorear uso de creditos

---

## 10. Codigo de Referencia

### Implementacion Completa de Firecrawl

```typescript
// /src/lib/firecrawl.ts
import Firecrawl from '@mendable/firecrawl-js';
import { ScrapedContent } from '@/types';

const firecrawl = new Firecrawl({
  apiKey: process.env.FIRECRAWL_API_KEY!
});

const constructoraSchema = {
  type: "object",
  properties: {
    companyName: { type: "string", description: "Nombre comercial de la empresa" },
    description: { type: "string", description: "Descripcion de la empresa" },
    models: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nombre del modelo (ej: Aurora, Duna)" },
          squareMeters: { type: "number", description: "Metros cuadrados" },
          bedrooms: { type: "number", description: "Cantidad de dormitorios" },
          bathrooms: { type: "number", description: "Cantidad de banos" },
          price: { type: "string", description: "Precio o rango de precios" },
          features: { type: "array", items: { type: "string" } }
        }
      },
      description: "Lista de modelos de casas/viviendas"
    },
    services: {
      type: "array",
      items: { type: "string" },
      description: "Servicios ofrecidos (llave en mano, financiacion, etc)"
    },
    contactInfo: {
      type: "object",
      properties: {
        phone: { type: "string" },
        whatsapp: { type: "string" },
        email: { type: "string" },
        address: { type: "string" }
      }
    },
    locations: {
      type: "array",
      items: { type: "string" },
      description: "Zonas donde operan"
    },
    constructionMethod: {
      type: "string",
      description: "Metodo constructivo (steel frame, tradicional, etc)"
    },
    financing: { type: "boolean", description: "Ofrece financiacion" }
  },
  required: ["companyName"]
};

export async function scrapeWithFirecrawl(url: string): Promise<ScrapedContent> {
  console.log('[Firecrawl] Starting scrape for:', url);

  const result = await firecrawl.scrapeUrl(url, {
    formats: ['markdown', 'extract'],
    extract: {
      schema: constructoraSchema
    }
  });

  if (!result.success) {
    throw new Error(`Firecrawl failed: ${result.error}`);
  }

  const extracted = result.extract || {};

  // Convertir al formato ScrapedContent
  return {
    title: extracted.companyName || 'Empresa Constructora',
    description: extracted.description || '',
    services: extracted.services || [],
    models: (extracted.models || []).map((m: any) =>
      `${m.name} - ${m.squareMeters}m2 - ${m.bedrooms} dorm - ${m.bathrooms} bano - ${m.price || 'Consultar'}`
    ),
    contactInfo: formatContactInfo(extracted.contactInfo),
    rawText: result.markdown || '',
    // Datos adicionales
    locations: extracted.locations,
    constructionMethod: extracted.constructionMethod,
    financing: extracted.financing,
    // Datos estructurados originales
    structuredData: extracted
  };
}

function formatContactInfo(contact: any): string {
  if (!contact) return '';
  const parts = [];
  if (contact.phone) parts.push(`Tel: ${contact.phone}`);
  if (contact.whatsapp) parts.push(`WhatsApp: ${contact.whatsapp}`);
  if (contact.email) parts.push(`Email: ${contact.email}`);
  if (contact.address) parts.push(`Direccion: ${contact.address}`);
  return parts.join(' | ');
}
```

---

## 11. Siguientes Pasos

1. **Inmediato**: Obtener API key de Firecrawl y probar con vibert.com.ar
2. **Esta semana**: Implementar Fase 1 y 2
3. **Proxima semana**: Implementar fallbacks y probar con mas empresas
4. **Continuo**: Monitorear uso de creditos y ajustar estrategia

---

## Apendice: Links Utiles

- Firecrawl Docs: https://docs.firecrawl.dev
- Firecrawl SDK Node: https://docs.firecrawl.dev/sdks/node
- Crawlee Docs: https://crawlee.dev
- Proyecto actual: `/Users/joaquingonzalez/Documents/dev/constructor-ai-simulator`
