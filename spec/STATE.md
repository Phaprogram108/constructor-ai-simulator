# Estado del Proyecto - Constructor AI Simulator

**Ultima actualizacion:** 2026-02-08 (sesion 3)

## App en Produccion
- **URL**: https://agenteiagratis.com (Vercel)
- **Repo**: https://github.com/Phaprogram108/constructor-ai-simulator
- **Branch**: main
- **Ultimo commit**: `76fb72d` - Add team photos, clarify catalog step, update slide descriptions

## Resumen de Sesiones

### Sesion 1 (Feb 6 temprano)
- UX/UI fixes: links clickeables, fullscreen slides, Loom mas grande, typo, mobile text
- Lint fixes para Vercel build
- Testing Fase 2: 20 nuevas empresas, 7 nuevos tipos de preguntas
- Analisis de 408 conversaciones PHA para messaging

### Sesion 2 (Feb 6 tarde) - ESTA SESION ANTERIOR
- Reemplazado iframe de Canva por slides nativas React (8 slides → 7 slides)
- Fotos del equipo extraidas del PDF e integradas
- Flechas visibles en mobile
- Video CTA scrollea a seccion Loom en vez de link externo
- WhatsApp links cambiados a api.whatsapp.com (Business)
- Paso 2 "Agrega tu Catalogo" ahora dice "(Opcional)"
- Slide 3 punto 2: agregado "llamadas/visitas al showroom o unidad"

### Sesion 3 (Feb 8) - SESION ACTUAL
- /fresh para handoff
- Fase 3 implementada: Re-busqueda on-demand en chat
  - Nuevo endpoint `/api/chat/research` (Firecrawl mapUrl + scrapeUrl)
  - Deteccion automatica de "no tengo info" en respuestas GPT
  - Segundo call a GPT con contexto adicional del sitio web
  - UI: indicador "Buscando informacion adicional..." despues de 6s
  - websiteUrl propagado: create -> localStorage -> chat request -> research

## Commits Recientes
```
76fb72d - Add team photos, clarify catalog step, update slide descriptions
313f314 - Improve slides UX: mobile arrows, scroll-to-video, remove redundant slide, WA Business
907f27d - Replace Canva iframe with native responsive slides
2bb7ba1 - Add 20 new companies (fase2) and 7 new question types
```

## Testing Completado
- **Fase 1**: 19/20 empresas (Arqtainer timeout) - 228 preguntas, 11% no-info
- **Fase 2**: 19/20 empresas (FullHouse timeout) - 380 preguntas, 24.7% no-info
- **Total**: 38/40 empresas, 608 preguntas testeadas

## TAREAS PENDIENTES

### PRIORIDAD ALTA

#### 1. Cold Outreach Message
- **Objetivo**: Mensaje profesional para constructoras invitandolas a probar agenteiagratis.com
- **Drafts**: Ver HANDOFF.md para 2 versiones (profesional y agresiva con social proof)
- **Basado en**: Analisis de 408 conversaciones PHA
- **Estado**: Drafts listos, pendiente refinamiento con usuario

#### 2. Analisis profundo de Sales Transcripts
- 9 llamadas .docx en `/Users/joaquingonzalez/Documents/PHA Notes/sales-transcripts/`
- 8 notas Notion en `/Users/joaquingonzalez/Documents/PHA Notes/notion-exports/`
- No leidos aun - pueden informar mejor el messaging y la presentacion

### PRIORIDAD MEDIA

#### 3. Garbage Filter v2
Empresas con falsos positivos en modelos detectados:
- Casa Real Viviendas, Gauros Viviendas, La Casa Mia, Viviendas Tecnohouse, Nova Viviendas, Contenedores Argentina
- Filtros a agregar en `firecrawl.ts validateProductName()`: Sucursales, CTAs, ciudades, navigation UI

### PRIORIDAD BAJA

#### 4. Mejoras Producto
- Compartir links de catalogos (ej: PlugArq)
- WhatsApp no detectado en ~40% de empresas
- Pricing/warranty generan ~40% no-info
- Session creation timeout en 2/40 empresas

## Archivos Clave

```
src/components/PresentationSlides.tsx - 7 slides nativas responsive (NUEVO)
src/components/Message.tsx            - Chat rendering (links, markdown, mobile)
src/components/ChatInterface.tsx      - Chat UI completa + searching indicator
src/components/SimulatorForm.tsx      - Form de generacion
src/app/page.tsx                      - Landing page (slides, video, form)
src/app/api/chat/research/route.ts   - Re-busqueda on-demand (Firecrawl) (NUEVO)
src/lib/firecrawl.ts                  - Scraper con garbage filter (~1200 lineas)
scripts/agent-test.ts                 - Test con 18+ tipos de preguntas
src/scripts/test-companies.json       - 40 empresas (fase1 + fase2)
public/team/                          - 4 fotos del equipo (joaquin, brenda, diego, antonela)
HANDOFF.md                            - Cold outreach drafts + archivos referencia messaging
```

## Firecrawl
- Plan Standard ($99/mes), 100K credits, 50 concurrent requests
- 4,477 pages scrapeadas en ultimos 7 dias (testing)
- Concurrency warning: no es problema en produccion, solo testing paralelo
- mapUrl fallback lanza hasta 15 scrapes en paralelo (Promise.all)
