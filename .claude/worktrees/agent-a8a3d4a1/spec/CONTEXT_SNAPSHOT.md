# Snapshot de Contexto

**Fecha:** 2026-02-08
**Proyecto:** /Users/joaquingonzalez/Documents/dev/constructor-ai-simulator
**Razon del snapshot:** Context refresh despues de implementar 3 mejoras pre-lanzamiento

## Resumen del Proyecto

Constructor AI Simulator es una app Next.js 14 que genera agentes de ventas IA para constructoras argentinas. El usuario ingresa una URL, el sistema scrapea con Firecrawl, genera un system prompt, y crea un chatbot con GPT-5.1. Lanzamiento oficial manana Feb 9.

**URL produccion:** https://agenteiagratis.com (Vercel)

## Lo Que Se Hizo en Esta Sesion (Feb 8)

### 1. Validacion HTTP de URLs (Fase 1)
- Agregado `validateUrlReachable()` en `src/app/api/simulator/create/route.ts`
- HEAD -> GET fallback con timeout 10s, DNS error detection
- Gate ANTES del scraping: si URL no responde, error 422 inmediato
- Mensajes claros: "No pudimos encontrar el sitio web. Verifica que la URL sea correcta."

### 2. Deep Crawling Keywords (Fase 2)
- `src/lib/firecrawl.ts`: +10 PRODUCT_KEYWORDS (entrega, entregas, equipamiento, equipamientos, plano, planos, detalle, detalles, ficha, fichas)
- `src/lib/firecrawl.ts`: +5 Wix CATALOG_PATHS (/entregas, /equipamientos, /tipologias, /nuestras-casas, /nuestros-modelos)
- Resultado: Lucy's House ahora captura 3 tiers de equipamiento con precios y specs completas

### 3. Re-busqueda On-Demand (Fase 3)
- NUEVO `src/app/api/chat/research/route.ts`: Firecrawl mapUrl + keyword scoring + scrapeUrl top 3 URLs
- MODIFICADO `src/app/api/chat/route.ts`: Deteccion de "no tengo info" via regex, segundo GPT call con contexto adicional
- MODIFICADO `src/components/ChatInterface.tsx`: isSearching state, indicador "Buscando informacion adicional..." despues de 6s
- MODIFICADO `src/components/SimulatorForm.tsx`: websiteUrl guardado en localStorage
- MODIFICADO `src/types/index.ts`: websiteUrl agregado a SessionInfo
- MODIFICADO `src/app/api/simulator/create/route.ts`: websiteUrl incluido en respuesta JSON

### 4. Testing Local con Lucy's House
- URL invalida: PASS
- Full Premium pricing: PASS (re-search, 15s)
- Entregas inmediatas: PASS (3s)
- Modulo 32m2: PASS (3.7s)
- Detalles tecnicos 35.70m2: PASS (re-search, 12.5s)

### 5. Deploy a Vercel
- Commit `e686fe9` pusheado y deployado exitosamente
- Build success confirmado via GitHub deployments API

## Decisiones Ya Tomadas (NO re-discutir)

1. Chat usa GPT-5.1 (no 4o)
2. Slides nativas React reemplazan Canva iframe
3. 7 slides (no 8) - "Caso Real" eliminada como redundante
4. Video CTA scrollea a seccion Loom en la misma pagina
5. WhatsApp usa api.whatsapp.com para compatibilidad Business
6. Fotos del equipo desde PDF, no placeholders
7. Cold outreach: tono profesional, con social proof concreto
8. Firecrawl concurrency warning es informativo, no requiere upgrade
9. Re-search on-demand: latencia 10-15s aceptable con feedback visual
10. Playwright solo para testing, NO para produccion
11. URL validation: server-side HEAD->GET con timeout 10s

## Contexto Tecnico Importante

### Re-search Flow (Fase 3)
```
Usuario pregunta -> GPT responde "no tengo info" ->
Backend detecta regex pattern -> Llama /api/chat/research ->
mapUrl(websiteUrl, limit:50) -> Filtra URLs por keywords del query ->
Scrapea top 3 URLs -> Segundo call GPT con contexto nuevo ->
Retorna respuesta mejorada + { researched: true }
```

### NO_INFO_PATTERNS (en chat/route.ts)
```
/no tengo (?:esa )?informaci[oó]n/i
/no (?:tengo|cuento con).*(?:cargad|disponible|espec[ií]fic)/i
/contact[aá](?:nos|me) por whatsapp.*(?:detalle|info)/i
/no puedo (?:acceder|verificar)/i
```

### Lucy's House es Wix SPA
- Contenido JS-rendered, HTML crudo solo tiene GA tag
- Firecrawl puede renderizar JS (waitFor:2000 en scrapeOptions)
- URLs: /entregas/modulo-*, /equipamientos/*, /modelos?modelo=*
- 3 tiers: Comfort (USD 1.290/m2), Deluxe (USD 1.390/m2), Full Premium (USD 1.550/m2)

### Productos mal nombrados en Wix
- El scraper extrae alt-text de imagenes como nombres de producto ("Proyecto 1", "Detalle 1")
- No son nombres reales de modelos pero el rawText tiene la info correcta
- El agente funciona bien porque busca en rawText, pero los nombres estructurados son basura

## Archivos Modificados en Esta Sesion

| Archivo | Cambio |
|---------|--------|
| src/app/api/simulator/create/route.ts | +validateUrlReachable() + websiteUrl en response |
| src/app/api/chat/route.ts | +NO_INFO_PATTERNS + re-search logic + websiteUrl in body |
| src/app/api/chat/research/route.ts | NUEVO - Research endpoint completo |
| src/lib/firecrawl.ts | +10 PRODUCT_KEYWORDS + 5 CATALOG_PATHS |
| src/components/ChatInterface.tsx | +isSearching state + searching indicator UI |
| src/components/SimulatorForm.tsx | +websiteUrl en localStorage |
| src/types/index.ts | +websiteUrl en SessionInfo |
| spec/DECISIONS.md | NUEVO - Decisiones pre-lanzamiento |
| spec/PLAN.md | NUEVO - Plan 3 fases |

## Para Continuar

Leer en este orden:
1. `spec/DECISIONS.md` - Decisiones ya tomadas
2. `spec/PLAN.md` - Plan de las 3 fases (todas completadas)
3. `spec/STATE.md` - Estado completo con tareas pendientes
4. Este archivo

**Continuar desde:**
1. **Test de regression** - Probar 3-5 empresas en produccion para verificar que no se rompio nada
2. **Cold outreach message** - Refinar drafts en HANDOFF.md
3. **Mejorar nombres de productos Wix** - Filtrar "Proyecto N" y "Detalle N" del garbage filter

## Dev Server
```bash
cd /Users/joaquingonzalez/Documents/dev/constructor-ai-simulator
npm run dev  # localhost:3000
```

## Test Commands
```bash
npm run agent-test -- --company "ViBert"     # Test 1 empresa
npm run agent-test -- --fase2                 # Test 20 empresas fase2
npm run agent-test                            # Test todas
```
