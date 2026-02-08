# Plan de Implementacion: Mejoras Pre-Lanzamiento (Feb 9)

## Resumen

Tres mejoras para el lanzamiento: (1) validacion HTTP real de URLs antes de crear sesion, (2) crawling profundo para captar sub-paginas de modelos en sitios Wix como Lucy's House, y (3) re-busqueda on-demand cuando el agente no tiene info de un modelo especifico. Cada fase es independientemente deployable y no rompe funcionalidad existente.

---

## Fase 1: Validacion HTTP de URLs [RIESGO: BAJO]

**Dependencias**: Ninguna
**Estimacion**: 30 minutos
**Principio**: Additive - agrega un check antes de la logica existente, no modifica nada

### Problema
La validacion actual en `create/route.ts` (linea 37) solo hace `new URL(websiteUrl)` que valida formato.
Si el usuario escribe `lucyhousearg.com` (sin la "s"), pasa la validacion de formato, el scraper falla silenciosamente, y `extractNameFromUrl()` en `scraper.ts` (linea 25) genera un nombre de empresa falso del dominio. El usuario termina chateando con un agente sin datos reales.

El frontend (`SimulatorForm.tsx` lineas 88-113) ya tiene un `validateUrl()` con `fetch HEAD` pero usa `mode: 'no-cors'` que NO puede verificar status codes. Ademas, el backend no valida nada.

### Solucion
Agregar validacion HTTP server-side en `create/route.ts` ANTES de llamar a `scrapeWebsite()`.

### Archivos a modificar

**`src/app/api/simulator/create/route.ts`**
- Agregar funcion `validateUrlReachable(url: string)` que haga `fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) })`
- Si HEAD falla, intentar GET con timeout de 10s
- Si ambos fallan (DNS error, timeout, 4xx, 5xx) -> retornar error 422 con mensaje claro
- Insertar esta validacion DESPUES de `new URL()` (linea 37-43) y ANTES de `scrapeWebsite()` (linea 51)
- Mensajes de error especificos:
  - DNS fail: "No pudimos encontrar el sitio web. Verifica que la URL sea correcta."
  - Timeout: "El sitio web no responde. Verifica que este funcionando."
  - 4xx/5xx: "El sitio web devolvio un error (STATUS). Verifica la URL."

### Tareas
1. [ ] Agregar funcion `validateUrlReachable()` en `create/route.ts`
2. [ ] Insertar llamada a `validateUrlReachable()` entre la validacion de formato y el scraping
3. [ ] Testear con URLs invalidas: dominio inexistente, dominio con typo, URL que da 404

### Codigo de referencia
```typescript
async function validateUrlReachable(url: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // Intentar HEAD primero (mas rapido)
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AgentIABot/1.0)',
        },
      });
    } catch {
      // Algunos servidores rechazan HEAD, intentar GET
      response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AgentIABot/1.0)',
        },
      });
    }

    clearTimeout(timeoutId);

    if (response.status >= 400) {
      return {
        ok: false,
        error: `El sitio web devolvio un error (${response.status}). Verifica que la URL sea correcta.`
      };
    }

    return { ok: true };
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        return { ok: false, error: 'El sitio web no responde. Verifica que este funcionando.' };
      }
      if (err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
        return { ok: false, error: 'No pudimos encontrar el sitio web. Verifica que la URL sea correcta.' };
      }
    }
    return { ok: false, error: 'No pudimos acceder al sitio web. Verifica la URL e intenta de nuevo.' };
  }
}
```

### Riesgo
- **Bajo**: Es un gate ANTES de la logica existente. Si la URL es valida, el flujo continua igual que antes.
- **Edge case**: Sitios que bloquean bots podrian ser rechazados falsamente. Mitigacion: User-Agent generico, fallback HEAD->GET, timeout generoso (10s).

---

## Fase 2: Deep Crawling para Wix (Keywords + Catalog Paths) [RIESGO: BAJO]

**Dependencias**: Ninguna (independiente de Fase 1)
**Estimacion**: 20 minutos
**Principio**: Additive - agrega keywords y paths al array existente, no modifica logica

### Problema
Lucy's House tiene sub-paginas con info critica en paths como:
- `/entregas/modulo-19-20` (modelos de entrega inmediata con specs)
- `/equipamientos/full-premium` (tiers de equipamiento con precios/m2)
- `/tipologias` (listado de tipologias)

Estos paths no estan en `PRODUCT_KEYWORDS` (lineas 690-704) ni en `CATALOG_PATHS` del Wix scraper (lineas 433-440).

### Solucion
Agregar keywords y paths faltantes a los arrays existentes.

### Archivos a modificar

**`src/lib/firecrawl.ts`**

1. **PRODUCT_KEYWORDS** (linea 690-704): Agregar al array existente:
   - `'entrega'`, `'entregas'` - Lucy's House usa `/entregas/modulo-*`
   - `'equipamiento'`, `'equipamientos'` - Lucy's House usa `/equipamientos/*`
   - `'tipologia'` ya esta, pero agregar `'plano'`, `'planos'`
   - `'detalle'`, `'detalles'` - muchos sitios ponen detalles de modelo en `/detalle/nombre`
   - `'ficha'`, `'fichas'` - algunos sitios usan fichas tecnicas

2. **CATALOG_PATHS en scrapeWixSite()** (lineas 433-440): Agregar al array existente:
   - `'/entregas'`
   - `'/equipamientos'`
   - `'/tipologias'`
   - `'/nuestras-casas'`
   - `'/nuestros-modelos'`

3. **GARBAGE_NAMES** (lineas 707-787): Verificar que `'entregas'` como single word esta en GARBAGE_NAMES (ya esta en linea 782-783) para evitar que se use como nombre de producto, pero la URL path `/entregas` SI debe ser seguida como catalogo.

### Tareas
1. [ ] Agregar keywords a `PRODUCT_KEYWORDS` array
2. [ ] Agregar paths a `CATALOG_PATHS` en `scrapeWixSite()`
3. [ ] Verificar que `GARBAGE_NAMES` no conflictua con los nuevos keywords (los garbage names filtran nombres de productos, no URLs - son sistemas separados)

### Codigo de referencia
```typescript
// PRODUCT_KEYWORDS - agregar al final del array existente (linea ~704)
  'entrega', 'entregas',
  'equipamiento', 'equipamientos',
  'plano', 'planos',
  'detalle', 'detalles',
  'ficha', 'fichas',

// CATALOG_PATHS - agregar al array en scrapeWixSite() (linea ~440)
  '/entregas',
  '/equipamientos',
  '/tipologias',
  '/nuestras-casas',
  '/nuestros-modelos',
```

### Riesgo
- **Bajo**: Solo agrega items a arrays existentes. El peor caso es que se scrapeen paginas extra que no tienen productos (se procesan y descartan sin impacto).
- **Costo Firecrawl**: Maximo ~5 scrapes adicionales en Wix path. A $0.001/credit, es $0.005 extra.

---

## Fase 3: Re-busqueda On-Demand en Chat [RIESGO: MEDIO]

**Dependencias**: Ninguna (puede hacerse en paralelo con Fase 1 y 2)
**Estimacion**: 2-3 horas
**Principio**: Additive - nuevo endpoint API + modificaciones al frontend, sin tocar logica existente del chat

### Problema
Cuando el agente no tiene info sobre un modelo especifico (ej: "contame sobre el modulo de 32m2"), responde "No tengo esa informacion cargada, contactanos por WhatsApp". El usuario pierde interes.

### Solucion
Crear un sistema de re-busqueda que:
1. Detecta cuando GPT no tiene suficiente info (analisis post-respuesta)
2. Hace un scrape targeted de una URL especifica del sitio de la empresa
3. Reformula la respuesta con la nueva info

### Archivos a crear/modificar

**NUEVO: `src/app/api/chat/research/route.ts`** - Endpoint de re-busqueda
- Recibe: `{ websiteUrl, query, sessionId }`
- Usa `mapUrl` de Firecrawl para encontrar URLs relevantes al query
- Scrapea las top 3 URLs que matchean
- Retorna el contenido extraido como contexto adicional

**`src/app/api/chat/route.ts`** - Modificar flujo de chat
- DESPUES de obtener la respuesta de GPT, analizar si contiene frases de "no tengo info"
- Patrones a detectar: "no tengo esa informacion", "no tengo.*cargad", "contactanos por whatsapp para.*detalles", "no cuento con.*info"
- Si detecta, y el request incluye `websiteUrl`, triggear re-busqueda automatica
- Hacer segundo call a GPT con el contexto adicional
- Retornar la respuesta mejorada + flag `{ researched: true }`

**`src/components/ChatInterface.tsx`** - UI de "buscando"
- Enviar `websiteUrl` en el body del chat request (ya tiene acceso via session)
- Si la respuesta tarda >5s, mostrar mensaje "Buscando informacion adicional..." en vez del typing indicator normal
- Si response tiene `researched: true`, no hacer nada especial (la respuesta ya viene completa)

### Diseno detallado

#### Endpoint `/api/chat/research/route.ts`

```typescript
// Input
interface ResearchRequest {
  websiteUrl: string;    // URL base de la empresa
  query: string;         // Lo que pregunto el usuario
}

// Output
interface ResearchResult {
  found: boolean;
  content: string;       // Markdown del contenido encontrado
  sourceUrls: string[];  // URLs de donde se extrajo
}
```

Logica:
1. `mapUrl(websiteUrl, { limit: 50 })` para obtener mapa del sitio
2. Filtrar URLs que contengan keywords del query (ej: si pregunta por "modulo 32", buscar URLs con "32" o "modulo")
3. Scrapear las top 3 URLs matcheantes con `scrapeUrl(url, { formats: ['markdown'] })`
4. Combinar el markdown
5. Retornar

#### Deteccion de "no info" en `/api/chat/route.ts`

```typescript
const NO_INFO_PATTERNS = [
  /no tengo (?:esa )?informaci[oó]n/i,
  /no (?:tengo|cuento con).*(?:cargad|disponible|espec[ií]fic)/i,
  /contact(?:a|á)(?:nos|me) por whatsapp.*(?:detalle|info)/i,
  /no puedo (?:acceder|verificar)/i,
];

function responseNeedsResearch(response: string): boolean {
  return NO_INFO_PATTERNS.some(p => p.test(response));
}
```

#### Flujo completo

```
Usuario pregunta: "Cuanto sale el equipamiento Full Premium?"
  |
  v
GPT responde: "No tengo los precios especificos del Full Premium cargados..."
  |
  v
Backend detecta "no tengo" pattern
  |
  v
Backend llama a /api/chat/research con { websiteUrl, query: "Full Premium" }
  |
  v
Research encuentra /equipamientos/full-premium -> scrapea
  |
  v
Backend hace segundo call a GPT:
  system: [prompt original]
  user: [pregunta original]
  assistant: [respuesta original - para contexto]
  user: "INFORMACION ADICIONAL ENCONTRADA: [contenido del scrape].
         Ahora responde la pregunta original con esta nueva informacion."
  |
  v
GPT responde con datos reales
  |
  v
Backend retorna respuesta mejorada + { researched: true }
```

### Tareas
1. [ ] Crear `src/app/api/chat/research/route.ts` con funcion de busqueda targeted
2. [ ] Agregar `responseNeedsResearch()` en `src/app/api/chat/route.ts`
3. [ ] Implementar flujo de re-busqueda + segundo call a GPT en chat route
4. [ ] Pasar `websiteUrl` desde el frontend al backend en ChatInterface
5. [ ] Agregar estado de "buscando" extendido en ChatInterface cuando la respuesta tarda
6. [ ] Testear con Lucy's House: preguntar por "Full Premium" y verificar que re-busca

### Detalle por archivo

#### `src/app/api/chat/research/route.ts` (NUEVO)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import Firecrawl from '@mendable/firecrawl-js';

let firecrawlInstance: Firecrawl | null = null;

function getFirecrawl(): Firecrawl {
  if (!firecrawlInstance) {
    firecrawlInstance = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY! });
  }
  return firecrawlInstance;
}

export async function POST(request: NextRequest) {
  try {
    const { websiteUrl, query } = await request.json();

    if (!websiteUrl || !query) {
      return NextResponse.json({ found: false, content: '', sourceUrls: [] });
    }

    // 1. Map the site
    const mapResult = await getFirecrawl().mapUrl(websiteUrl, { limit: 50 });
    if (!mapResult.success || !mapResult.links) {
      return NextResponse.json({ found: false, content: '', sourceUrls: [] });
    }

    // 2. Extract keywords from query
    const queryWords = query.toLowerCase()
      .split(/\s+/)
      .filter((w: string) => w.length > 2)
      .filter((w: string) => !['que', 'como', 'cual', 'cuanto', 'tiene', 'tienen', 'hay', 'son', 'del', 'las', 'los', 'una', 'con', 'por', 'para'].includes(w));

    // 3. Score URLs by keyword relevance
    const scoredUrls = mapResult.links
      .map(url => {
        const path = new URL(url).pathname.toLowerCase();
        const score = queryWords.reduce((s: number, word: string) => {
          return s + (path.includes(word) ? 1 : 0);
        }, 0);
        return { url, score };
      })
      .filter(u => u.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (scoredUrls.length === 0) {
      return NextResponse.json({ found: false, content: '', sourceUrls: [] });
    }

    // 4. Scrape top URLs
    const scrapeResults = await Promise.all(
      scoredUrls.map(async ({ url }) => {
        try {
          const result = await getFirecrawl().scrapeUrl(url, {
            formats: ['markdown'],
            onlyMainContent: true,
            timeout: 15000,
          });
          return result.success ? { url, markdown: result.markdown } : null;
        } catch {
          return null;
        }
      })
    );

    const validResults = scrapeResults.filter(Boolean);

    if (validResults.length === 0) {
      return NextResponse.json({ found: false, content: '', sourceUrls: [] });
    }

    const content = validResults
      .map(r => `--- ${r!.url} ---\n${r!.markdown?.slice(0, 5000)}`)
      .join('\n\n');

    return NextResponse.json({
      found: true,
      content: content.slice(0, 12000),
      sourceUrls: validResults.map(r => r!.url),
    });
  } catch (error) {
    console.error('[Research] Error:', error);
    return NextResponse.json({ found: false, content: '', sourceUrls: [] });
  }
}
```

#### Cambios en `src/app/api/chat/route.ts`

Agregar DESPUES de obtener `assistantContent` (linea 81):

```typescript
// Check if response indicates lack of info and we can research
let finalContent = assistantContent;
let researched = false;

if (responseNeedsResearch(assistantContent) && body.websiteUrl) {
  console.log('[Chat] Response needs research, triggering on-demand search...');

  try {
    const researchResponse = await fetch(
      `${request.nextUrl.origin}/api/chat/research`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websiteUrl: body.websiteUrl,
          query: message,
        }),
      }
    );

    const research = await researchResponse.json();

    if (research.found && research.content) {
      // Second GPT call with additional context
      const researchMessages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...(conversationHistory || []).map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
        { role: 'user', content: message },
        { role: 'assistant', content: assistantContent },
        {
          role: 'user',
          content: `INFORMACION ADICIONAL ENCONTRADA EN EL SITIO WEB:\n\n${research.content}\n\nCon esta nueva informacion, responde la pregunta original del cliente de forma completa. Si la informacion responde a lo que pregunto, dala. Si no es relevante, mantene tu respuesta anterior.`
        },
      ];

      const researchCompletion = await getOpenAI().chat.completions.create({
        model: 'gpt-5.1',
        messages: researchMessages,
        max_completion_tokens: 600,
        temperature: 0.7,
      });

      const researchContent = researchCompletion.choices[0]?.message?.content;
      if (researchContent) {
        finalContent = researchContent;
        researched = true;
        console.log('[Chat] Research improved response');
      }
    }
  } catch (researchError) {
    console.error('[Chat] Research failed:', researchError);
    // Continue with original response
  }
}
```

#### Cambios en `src/components/ChatInterface.tsx`

1. Almacenar `websiteUrl` en el componente (ya viene del session storage)
2. Enviarlo en el body del chat request
3. Timer para mostrar "Buscando informacion..." despues de 5s

```typescript
// En sendMessage(), agregar websiteUrl al body:
body: JSON.stringify({
  sessionId,
  message: userMessage,
  systemPrompt,
  websiteUrl: initialSession.websiteUrl, // NUEVO
  companyName: initialSession.companyName,
  conversationHistory: messages.map(m => ({
    role: m.role,
    content: m.content,
  })),
}),

// Timer para "buscando":
// Antes del fetch, iniciar un timer
const searchingTimer = setTimeout(() => {
  // Cambiar el typing indicator a "Buscando informacion adicional..."
  setSearchingMode(true);
}, 6000);

// En finally:
clearTimeout(searchingTimer);
setSearchingMode(false);
```

#### Cambios en tipos

**`src/types/index.ts`** - Agregar `websiteUrl` a `SessionInfo`:
```typescript
export interface SessionInfo {
  id: string;
  companyName: string;
  websiteUrl?: string;  // NUEVO - para re-busqueda on-demand
  messagesRemaining: number;
  expiresAt: Date;
}
```

**`src/app/api/simulator/create/route.ts`** - Incluir `websiteUrl` en la respuesta:
```typescript
return NextResponse.json({
  sessionId: session.id,
  companyName: scrapedContent.title,
  websiteUrl, // NUEVO
  welcomeMessage,
  messagesRemaining: session.maxMessages,
  systemPrompt,
});
```

**`src/components/SimulatorForm.tsx`** - Guardar `websiteUrl` en session storage:
```typescript
session: {
  id: data.sessionId,
  companyName: data.companyName || 'Constructora',
  websiteUrl: data.websiteUrl || url, // NUEVO
  messagesRemaining: data.messagesRemaining || 50,
  expiresAt: new Date(Date.now() + 30 * 60 * 1000),
},
```

### Riesgo
- **Medio**: Agrega un segundo call a GPT y a Firecrawl condicionalmente. Si falla, mantiene la respuesta original (degradacion graceful).
- **Costo**: ~3-5 Firecrawl credits extra ($0.005) + 1 GPT call extra ($0.003) = ~$0.008 por re-busqueda. Solo se triggerea cuando el agente no tiene info.
- **Latencia**: ~10-15s adicionales. Aceptable segun DECISIONS.md.
- **Edge case**: Si la re-busqueda tampoco encuentra info, se mantiene la respuesta original sin impacto.

---

## Tracks Paralelos

```
Track A: Fase 1 (URL Validation) -----> Deploy
Track B: Fase 2 (Deep Crawl Keywords) -> Deploy
Track C: Fase 3 (On-demand Research) --> Deploy

Todos son independientes y pueden implementarse en paralelo.
Orden recomendado de deploy: Fase 1 > Fase 2 > Fase 3
(de menor a mayor riesgo)
```

## Riesgos Globales

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|-------------|---------|------------|
| URL validation rechaza sitios validos | Baja | Medio | User-Agent generico, HEAD->GET fallback, timeout 10s |
| Nuevos keywords scrapean paginas inutiles | Muy baja | Bajo | No impacta funcionalidad, solo usa credits extra |
| Re-busqueda agrega latencia excesiva | Media | Bajo | Solo se activa cuando detecta "no info", timeout de 15s |
| Re-busqueda encuentra info incorrecta | Baja | Medio | GPT evalua relevancia, instruccion de mantener respuesta si no es relevante |
| Segundo GPT call falla | Baja | Bajo | Catch silencioso, retorna respuesta original |

## Testing

### Test Case Principal: Lucy's House (https://www.lucyshousearg.com/)

**Fase 1 - URL Validation:**
- [ ] `lucyhousearg.com` (sin "s") -> debe mostrar error "no pudimos encontrar el sitio"
- [ ] `lucyshousearg.com` (sin https) -> debe auto-agregar https y funcionar
- [ ] `https://www.lucyshousearg.com/` -> debe funcionar normalmente
- [ ] `https://sitio-inexistente-12345.com` -> debe mostrar error DNS

**Fase 2 - Deep Crawling:**
- [ ] Crear sesion con Lucy's House -> verificar que scrapea `/entregas/*`
- [ ] Verificar en logs que `/equipamientos/*` fue scrapeado
- [ ] El agente debe conocer precios por m2 de los 3 tiers de equipamiento
- [ ] El agente debe conocer modelos de entrega inmediata (19.20, 28.56, etc.)

**Fase 3 - Re-busqueda:**
- [ ] Preguntar "Cuanto sale el equipamiento Full Premium?" -> debe re-buscar y dar precio
- [ ] Preguntar sobre un modelo especifico no en el scrape inicial -> debe re-buscar
- [ ] La re-busqueda no debe activarse si el agente YA tiene la info
- [ ] Verificar que la latencia no exceda 15s

### Regression Testing:
- [ ] Probar con 3 empresas que ya funcionan bien (ej: ViBert, Makenhaus, EcoMod)
- [ ] Verificar que no se rompio nada en el flujo existente
- [ ] Verificar que los progress steps del frontend siguen mostrando correctamente

## Orden de Implementacion Recomendado

1. **Fase 2** (5 min) - Es literalmente agregar strings a arrays. Cero riesgo.
2. **Fase 1** (30 min) - Gate de validacion simple. Riesgo bajo.
3. **Fase 3** (2-3 hrs) - Feature nueva con multiples archivos. Riesgo medio.

## Siguiente Paso

Usar `@coder` para implementar las fases en el orden recomendado (2 -> 1 -> 3).
