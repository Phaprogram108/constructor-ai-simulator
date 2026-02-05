# Estado de Sesion - 4 Feb 2026 (V4) - Sistema Completo

## Resumen del Proyecto

**Constructor AI Simulator** - Sistema que scrapea sitios web de empresas constructoras y crea un chatbot personalizado que responde preguntas sobre la empresa como si fuera un agente de ventas.

**URL Produccion**: https://agenteiagratis.com
**Deploy**: Vercel (auto-deploy desde GitHub)
**Costo Firecrawl**: $100/mes

---

## Arquitectura del Sistema

```
Usuario --> Next.js App --> /api/simulator/create --> Firecrawl + Claude --> Session
                      --> /api/chat --> Claude (con systemPrompt) --> Respuesta
```

### Componentes Principales

| Componente | Archivo | Descripcion |
|------------|---------|-------------|
| Scraper Principal | `src/lib/scraper.ts` | Orquesta scraping con Firecrawl/Playwright |
| Firecrawl Integration | `src/lib/firecrawl.ts` | Scraping con actions y parsing |
| Vision Scraper | `src/lib/vision-scraper.ts` | Screenshots + Claude Vision |
| Prompt Generator | `src/lib/prompt-generator.ts` | Genera systemPrompt para el bot |
| API Create | `src/app/api/simulator/create/route.ts` | Endpoint para crear sesion |
| API Chat | `src/app/api/chat/route.ts` | Endpoint para conversar |

---

## Mejoras Implementadas (4 Feb 2026)

### Plan A: Mejorar Scraping de URLs

**Archivo**: `src/lib/firecrawl.ts`

- URLs prioritarias ampliadas:
  - FAQ: `/faq`, `/preguntas-frecuentes`, `/preguntas`
  - Tipologias: `/tipologias`, `/especificaciones`, `/caracteristicas`
  - Cobertura: `/cobertura`, `/envios`, `/zonas`
  - Proceso: `/proceso`, `/como-trabajamos`, `/financiacion`
- `MAX_CATALOG_URLS` aumentado de 10 a 15
- Funcion `extractFAQContent()` para pares pregunta-respuesta
- Patrones regex mejorados para formatos como `W26 Suite | 26 m2`

### Plan B: Actions Universales (Firecrawl)

**Archivo**: `src/lib/firecrawl.ts`

30+ selectores universales para:
- Expandir FAQs y accordions (`[aria-expanded="false"]`, `[data-toggle]`)
- Scroll para lazy loading
- Click en WhatsApp para revelar numeros

```typescript
const UNIVERSAL_ACTIONS = [
  { type: 'wait', milliseconds: 2000 },
  { type: 'scroll', direction: 'down' },
  { type: 'click', selector: '[class*="faq"] [class*="question"]' },
  { type: 'click', selector: '[aria-expanded="false"]' },
  // ... 30+ selectores mas
];
```

### Plan C: rawText como Fallback Inteligente

**Archivo**: `src/lib/prompt-generator.ts`

- Limites aumentados: rawText 6K->12K, catalogRaw 8K->15K
- Bot busca en rawText ANTES de decir "no tengo info"
- Instrucciones de busqueda por keywords

---

## Fix Critico: Fallback "Empresa Constructora"

### Problema
Cuando el scraping fallaba, el sistema mostraba "Empresa Constructora" como nombre generico y el bot inventaba datos.

### Solucion (Commit 0c67dc3)

1. Constante `SCRAPING_FAILED_MARKER = '__SCRAPING_FAILED__'`
2. Reemplazo de todos los fallbacks "Empresa Constructora"
3. Endpoint devuelve HTTP 422 con mensaje claro:

```json
{
  "error": "No pudimos procesar este sitio web. El sistema no logro extraer la informacion de la empresa.",
  "code": "SCRAPING_FAILED"
}
```

**Archivos modificados**:
- `src/lib/scraper.ts` - Constante + fallbacks
- `src/lib/firecrawl.ts` - Import + fallback
- `src/app/api/simulator/create/route.ts` - Validacion HTTP 422

---

## Problemas Conocidos

| Problema | Estado | Notas |
|----------|--------|-------|
| WhatsApp extraction ~5% exito | Pendiente | Actions no funcionan en todos los sitios |
| Empresas tradicionales | Pendiente | Sistema optimizado para modulares |
| Chat error 400 | RESUELTO | Faltaba systemPrompt en requests |
| "Empresa Constructora" generico | RESUELTO | Ahora devuelve error claro |

---

## Scripts de Testing

```bash
# Test QA de 20 empresas
npx tsx scripts/test-20-empresas-qa.ts

# Test empresa especifica
node test-ecomod.mjs

# Test de parsing offline
node test-parsing.mjs

# Debug visual
python scripts/debug-scraper-visual.py
```

---

## Variables de Entorno

```env
ANTHROPIC_API_KEY=sk-ant-...
FIRECRAWL_API_KEY=fc-...
```

---

## Commits Recientes

| Hash | Descripcion |
|------|-------------|
| 0c67dc3 | fix: Return clear error instead of generic 'Empresa Constructora' |
| 70c84d8 | feat: Implement universal Firecrawl actions + rawText fallback |
| 2873552 | fix: Disable Firecrawl AI extract, use regex parsing |

---

## Proximos Pasos

1. **Mejorar extraccion WhatsApp** - Explorar API de Firecrawl mas a fondo
2. **Soporte empresas tradicionales** - No solo modulares
3. **Vision para tablas complejas** - Claude Vision ya esta integrado
4. **QA automatizado** - Script de 20 empresas en CI/CD

---

*Actualizado: 2026-02-04 22:00 UTC*
