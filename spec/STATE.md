# Estado del Proyecto - Constructor AI Simulator

**Ultima actualizacion:** 2026-02-08 (sesion 4)

## App en Produccion
- **URL**: https://agenteiagratis.com (Vercel)
- **Repo**: https://github.com/Phaprogram108/constructor-ai-simulator
- **Branch**: main
- **Ultimo commit**: `e686fe9` - [fase1+2] Add deep crawling keywords and pre-launch spec docs
- **Lanzamiento oficial**: Feb 9 (MANANA)

## Resumen de Sesiones

### Sesion 1 (Feb 6 temprano)
- UX/UI fixes: links clickeables, fullscreen slides, Loom mas grande, typo, mobile text
- Lint fixes para Vercel build
- Testing Fase 2: 20 nuevas empresas, 7 nuevos tipos de preguntas
- Analisis de 408 conversaciones PHA para messaging

### Sesion 2 (Feb 6 tarde)
- Reemplazado iframe de Canva por slides nativas React (8 slides -> 7 slides)
- Fotos del equipo extraidas del PDF e integradas
- Flechas visibles en mobile, Video CTA scrollea a Loom
- WhatsApp links cambiados a api.whatsapp.com (Business)
- Paso 2 "Agrega tu Catalogo" ahora dice "(Opcional)"

### Sesion 3 (Feb 8 temprano)
- /fresh para handoff

### Sesion 4 (Feb 8) - SESION ACTUAL
3 mejoras pre-lanzamiento implementadas y deployadas:

#### Fase 1: Validacion HTTP de URLs (COMPLETADA)
- `validateUrlReachable()` en `create/route.ts` con HEAD->GET fallback, timeout 10s
- URLs invalidas (DNS fail, 4xx, 5xx, timeout) rechazadas ANTES del scraping
- Mensajes de error claros en espanol
- Testeado: `lucyhousearg.com` (sin "s") correctamente rechazada

#### Fase 2: Deep Crawling Keywords (COMPLETADA)
- 10 nuevos PRODUCT_KEYWORDS: entrega, entregas, equipamiento, equipamientos, plano, planos, detalle, detalles, ficha, fichas
- 5 nuevos Wix CATALOG_PATHS: /entregas, /equipamientos, /tipologias, /nuestras-casas, /nuestros-modelos
- Resultado: Lucy's House ahora captura precios/m2 de 3 tiers, specs completas, modelos con detalles

#### Fase 3: Re-busqueda On-Demand (COMPLETADA)
- Nuevo endpoint `/api/chat/research/route.ts` - Firecrawl mapUrl + keyword scoring + scrapeUrl top 3
- Deteccion automatica de "no tengo info" en respuestas GPT (regex patterns)
- Segundo call a GPT con contexto adicional del sitio web
- Frontend: indicador "Buscando informacion adicional..." despues de 6s (ChatInterface.tsx)
- websiteUrl propagado: create response -> localStorage -> chat body -> research endpoint
- Degradacion graceful: si falla, mantiene respuesta original
- Latencia: 12-15s cuando re-busca, 3s cuando ya tiene info

#### Testing con Lucy's House (https://www.lucyshousearg.com/)
- URL invalida: PASS - rechazada correctamente
- Full Premium pricing: PASS - USD 1.550/m2 + IVA + specs detallados (re-search triggered)
- Entregas inmediatas: PASS - sabe que existen, menciona tiers
- Modulo 32m2: PASS - dice que personalizan, da precios por tier
- Detalles tecnicos: PASS - encontro modulo 32m2 Confort a USD 41.280 + specs completos (re-search triggered)

## Commits Recientes
```
e686fe9 - [fase1+2] Add deep crawling keywords and pre-launch spec docs
f28acb2 - [fase3] Add on-demand re-search when AI lacks specific product info
76fb72d - Add team photos, clarify catalog step, update slide descriptions
313f314 - Improve slides UX: mobile arrows, scroll-to-video, remove redundant slide, WA Business
907f27d - Replace Canva iframe with native responsive slides
```

## Testing Completado
- **Fase 1 testing**: 19/20 empresas (Arqtainer timeout) - 228 preguntas, 11% no-info
- **Fase 2 testing**: 19/20 empresas (FullHouse timeout) - 380 preguntas, 24.7% no-info
- **Total**: 38/40 empresas, 608 preguntas testeadas
- **Lucy's House test**: 5/5 tests passed (URL validation, pricing, entregas, modelos, detalles)

## TAREAS PENDIENTES

### PRIORIDAD ALTA

#### 1. Test de Regression Post-Deploy
- Probar 3-5 empresas que ya funcionaban bien para verificar que no se rompio nada
- Sugeridas: ViBert, Makenhaus, EcoMod, Steel Frame Constructora
- Verificar que progress steps del frontend siguen mostrando correctamente

#### 2. Cold Outreach Message
- **Drafts**: Ver HANDOFF.md para 2 versiones (profesional y agresiva con social proof)
- **Estado**: Drafts listos, pendiente refinamiento con usuario

### PRIORIDAD MEDIA

#### 3. Mejorar nombres de productos en Wix scraping
- Lucy's House: productos se nombran "Proyecto 1", "Detalle 1" (son alt-text de imagenes)
- El agente funciona bien por el rawText pero los nombres estructurados son basura
- Posible solucion: filtrar nombres que sean "Proyecto N" o "Detalle N" del garbage filter

#### 4. Garbage Filter v2
- Empresas con falsos positivos: Casa Real, Gauros, La Casa Mia, Tecnohouse, Nova, Contenedores Argentina
- Filtros faltantes: Sucursales, CTAs, ciudades, navigation UI

#### 5. Analisis profundo de Sales Transcripts
- 9 llamadas .docx en PHA Notes/sales-transcripts/
- 8 notas Notion en PHA Notes/notion-exports/

### PRIORIDAD BAJA

#### 6. Mejoras Producto
- Compartir links de catalogos (ej: PlugArq)
- WhatsApp no detectado en ~40% de empresas
- Pricing/warranty generan ~40% no-info
- Session creation timeout en 2/40 empresas

## Archivos Clave

```
src/components/PresentationSlides.tsx   - 7 slides nativas responsive
src/components/Message.tsx              - Chat rendering (links, markdown, mobile)
src/components/ChatInterface.tsx        - Chat UI + isSearching indicator (MODIFICADO)
src/components/SimulatorForm.tsx        - Form + websiteUrl en localStorage (MODIFICADO)
src/app/page.tsx                        - Landing page (slides, video, form)
src/app/api/chat/route.ts              - Chat API + re-search logic (MODIFICADO)
src/app/api/chat/research/route.ts     - Re-busqueda on-demand endpoint (NUEVO)
src/app/api/simulator/create/route.ts  - Create session + URL validation (MODIFICADO)
src/lib/firecrawl.ts                   - Scraper + nuevos keywords/paths (MODIFICADO)
src/types/index.ts                     - SessionInfo + websiteUrl (MODIFICADO)
scripts/agent-test.ts                  - Test con 18+ tipos de preguntas
src/scripts/test-companies.json        - 40 empresas (fase1 + fase2)
spec/DECISIONS.md                      - Decisiones pre-lanzamiento (NUEVO)
spec/PLAN.md                           - Plan de implementacion 3 fases (NUEVO)
HANDOFF.md                             - Cold outreach drafts
```

## Firecrawl
- Plan Standard ($99/mes), 100K credits, 50 concurrent requests
- Re-search consume ~3-5 credits extra por query (mapUrl + scrapeUrl x3)
- Solo se activa cuando GPT dice "no tengo info" (~24% de queries en testing)
