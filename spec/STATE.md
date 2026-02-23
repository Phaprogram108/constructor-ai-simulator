# Estado del Proyecto - Constructor AI Simulator

**Ultima actualizacion:** 2026-02-23 (sesion 5)

## App en Produccion
- **URL**: https://agenteiagratis.com (Vercel)
- **Repo**: https://github.com/Phaprogram108/constructor-ai-simulator
- **Branch**: main
- **Ultimo commit**: `722c8b8` - Fix Loom embed blocked by CSP: add frame-src for loom.com

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

### Sesion 4 (Feb 8)
- 3 fases pre-lanzamiento: URL validation, deep crawling keywords, re-search on-demand
- Testing: 38/40 empresas, 608 preguntas

### Sesion 5 (Feb 23) - SESION ACTUAL
Audit de seguridad, costos y plan de mejoras pre-publicidad.

## Sesion 5 - Trabajo Realizado

### Tarea 1: Test Comparativo de Modelos (COMPLETADA)
- Script: `src/scripts/model-comparison-test.ts` + `npm run test:models`
- Testeados: gpt-5-nano, gpt-5-mini, gpt-5.1 con 4 empresas x 20 preguntas = 240 calls
- **Resultado**: nano y mini devuelven respuestas VACIAS (0/80 y 1/80 con texto)
  - Consumen 600 output tokens pero `message.content` viene vacio
  - Posible causa: system prompt demasiado largo (~40K tokens) o formato de respuesta incompatible
- **gpt-5.1**: unico modelo que funciona (80/80), accuracy 4.5/5, sin alucinaciones
- **Decision**: mantener gpt-5.1 en produccion
- Resultados completos en `src/scripts/model-comparison-results.json`

### Tarea 2: Rate Limiting Semanal + Anti-Bot (COMPLETADA)
- `src/lib/rate-limiter.ts`: weekly chat limit 20 msgs/IP/semana, create daily 20→5
- Anti-bot: deteccion de velocidad (5+ msgs en <10s = ban), bloqueo de User-Agents bot
- Fingerprinting IP + User-Agent hash para rate limiting robusto
- `src/middleware.ts` (NUEVO): bloquea bots en todas las rutas API
- Frontend: banner amber + input deshabilitado cuando se alcanza limite semanal
- `src/app/api/chat/route.ts`: integra checkWeeklyChatLimit

### Tarea 3: SystemPrompt Server-Side (COMPLETADA - SEGURIDAD CRITICA)
- `src/app/api/simulator/create/route.ts`: NO envia systemPrompt al cliente (solo en dev)
- `src/app/api/chat/route.ts`: lee systemPrompt del session-manager, NO del request body
- Frontend: eliminado systemPrompt de props, state, localStorage, fetch body
- Cierra vulnerabilidad de proxy/jailbreak via API key

### Tarea 4: Investigacion Firecrawl Extract (COMPLETADA - RESEARCH)
- **Veredicto**: Firecrawl NO puede reemplazar Claude completamente
- Ahorro real: 15-30% (no 60-80% como se estimaba)
- Claude aporta inferencia/sintesis que Firecrawl no tiene
- **Recomendacion**: mantener Firecrawl-primary + Claude-fallback (actual)

### Tarea 5: Anti-Bot Nivel 1 (COMPLETADA)
- Implementada junto con Tarea 2 en rate-limiter.ts y middleware.ts

## TAREAS PENDIENTES

### PRIORIDAD ALTA

#### 1. Debuggear respuestas vacias de nano/mini
- gpt-5-nano y gpt-5-mini devuelven `message.content` vacio
- Investigar: tool_calls, finish_reason, content_filter, context window
- Si se soluciona, ahorro de 17x en costos OpenAI

#### 2. Deploy cambios de seguridad a Vercel
- Comitear y pushear todos los cambios de esta sesion
- Actualizar OPENAI_API_KEY en Vercel (ya revocada y re-creada)
- Verificar SLACK_WEBHOOK_URL en Vercel env vars

#### 3. Configurar limites OpenAI
- Hard limit: $200/mes en OpenAI Billing
- Soft limit: $100/mes para alerta temprana

### PRIORIDAD MEDIA

#### 4. Rate limiting persistente
- Actual: in-memory (se resetea con cold starts de Vercel)
- Futuro: Vercel KV o Upstash Redis

#### 5. Rate limit en /api/session/[id]
- Sin proteccion actualmente
- Cualquiera con session ID puede leer historial

#### 6. Mejorar nombres de productos en Wix scraping
- (Pendiente de sesion 4)

### PRIORIDAD BAJA

#### 7. Mejoras Producto (de sesion 4)
- WhatsApp no detectado en ~40% de empresas
- Pricing/warranty generan ~40% no-info
- Session creation timeout en 2/40 empresas

## Archivos Modificados (Sesion 5)

```
src/app/api/chat/route.ts              - Server-side systemPrompt + weekly rate limit
src/app/api/simulator/create/route.ts  - Removido systemPrompt de response (dev-only)
src/app/demo/[sessionId]/page.tsx      - Removido systemPrompt state
src/components/ChatInterface.tsx       - Removido systemPrompt + weekly limit banner
src/components/SimulatorForm.tsx       - Removido systemPrompt de localStorage
src/lib/rate-limiter.ts                - Weekly limit + anti-bot + fingerprinting
src/middleware.ts                      - NUEVO: bot blocking middleware
src/scripts/model-comparison-test.ts   - NUEVO: test comparativo de 3 modelos
src/scripts/model-comparison-results.json - NUEVO: resultados del test
package.json                           - Agregado script test:models
```

## Costos Actuales
- **OpenAI**: gpt-5.1, ~$0.018/pregunta, ~$1.44/80 preguntas
- **Firecrawl**: $100/mes plan, ~35-58 creditos por chatbot creado
- **Anthropic**: Claude Sonnet 4 para extraccion, ~$0.08/sitio (mantener)
