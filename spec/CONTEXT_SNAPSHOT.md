# Snapshot de Contexto

**Fecha:** 2026-02-23
**Proyecto:** /Users/joaquingonzalez/Documents/dev/constructor-ai-simulator
**Razon del snapshot:** Context refresh despues de audit de seguridad + costos

## Resumen del Proyecto

Constructor AI Simulator - webapp Next.js 14 que genera chatbots de ventas IA para constructoras argentinas. Usuario ingresa URL, sistema scrapea con Firecrawl, genera system prompt, crea chatbot con GPT-5.1. Produccion en https://agenteiagratis.com (Vercel).

## Estado Actual
- Sesion 5 completada: audit de seguridad, rate limiting, test de modelos
- Todos los cambios compilan OK pero NO estan commiteados ni deployados
- API key de OpenAI ya fue rotada por el usuario

## Cambios Sin Commitear (Sesion 5)

### Seguridad critica: systemPrompt server-side
- `src/app/api/chat/route.ts` - Lee systemPrompt del session-manager, no del request body. Agrega weekly rate limit check.
- `src/app/api/simulator/create/route.ts` - Removido systemPrompt de response (solo devuelve en dev mode para test scripts)
- `src/app/demo/[sessionId]/page.tsx` - Removido systemPrompt state/props
- `src/components/ChatInterface.tsx` - Removido systemPrompt de props/fetch + agregado banner weekly limit + input deshabilitado
- `src/components/SimulatorForm.tsx` - Removido systemPrompt de localStorage

### Rate limiting + anti-bot
- `src/lib/rate-limiter.ts` - Weekly chat limit (20/semana/IP), create daily (20->5), bot detection (UA), speed abuse (5+ msgs <10s = ban), IP+UA fingerprinting
- `src/middleware.ts` (NUEVO) - Bloquea bots (curl, wget, python-requests) en todas las rutas API

### Test de modelos
- `src/scripts/model-comparison-test.ts` (NUEVO) - Compara gpt-5-nano vs gpt-5-mini vs gpt-5.1
- `src/scripts/model-comparison-results.json` (NUEVO) - Resultados completos
- `package.json` - Agregado "test:models" script

### Fix menor
- `src/scripts/dynamic-test.ts` - eslint-disable para variable no usada

## Resultado del Test de Modelos

| Modelo | Respuestas con texto | Costo (80 preguntas) | Latencia avg |
|--------|---------------------|---------------------|-------------|
| gpt-5-nano | 0/80 (VACIO) | $0.08 | 7.8s |
| gpt-5-mini | 1/80 (VACIO) | $0.33 | 10.4s |
| gpt-5.1 | 80/80 (OK) | $1.44 | 6.9s |

nano/mini consumen 600 output tokens pero message.content viene vacio. Causas posibles: system prompt demasiado largo (~40K tokens), respuesta en tool_calls en vez de content, o content_filter.

## Decisiones Ya Tomadas (NO re-discutir)

1. **Mantener gpt-5.1** - unico modelo que funciona (nano/mini devuelven vacio)
2. **Rate limit: 20 msgs/IP/semana** - elegido por el usuario
3. **Create limit: 5/dia** - reducido de 20
4. **systemPrompt server-side** - nunca sale del server (excepto NODE_ENV=development)
5. **NO reemplazar Anthropic con Firecrawl Extract** - ahorro solo 15-30%, Claude aporta inferencia/sintesis
6. **Anti-bot nivel 1** - speed detection + UA blocking + fingerprinting
7. **API key OpenAI rotada** - la vieja fue expuesta, usuario creo nueva en proyecto "Agente IA Gratis"
8. **Slides nativas React** - reemplazan Canva iframe (sesion 2)
9. **Re-search on-demand** - latencia 10-15s aceptable (sesion 4)

## Contexto Tecnico Importante

- Rate limiting es in-memory (Vercel serverless) - cold starts resetean todo. Futuro: Upstash Redis
- gpt-5-nano y gpt-5-mini solo soportan temperature=1 (no 0.7)
- El test script necesita `npm run dev` para crear sesiones (scraping real)
- Build Next.js compila OK con todos los cambios
- middleware.ts detectado correctamente (26.4 kB)

## Para Continuar

Leer en este orden:
1. `spec/STATE.md` - estado completo con tareas pendientes
2. Este archivo
3. `CLAUDE.md` en raiz

**Continuar desde:**
1. **Commit + deploy** de todos los cambios de seguridad a Vercel
2. **Debuggear nano/mini** - investigar por que devuelven vacio (finish_reason, tool_calls, context window)
3. **Configurar limites OpenAI** - hard $200/mes, soft $100/mes

## Dev Server
```bash
cd /Users/joaquingonzalez/Documents/dev/constructor-ai-simulator
npm run dev          # localhost:3000
npm run test:models  # test comparativo (requiere dev server)
```
