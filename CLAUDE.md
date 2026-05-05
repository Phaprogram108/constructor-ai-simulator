<!-- BEGIN: REGLA MÁXIMA ABSOLUTA — NO API SIN AUTORIZACIÓN TRIPLE — INVIOLABLE -->

# 🚨🚨🚨 REGLA MÁXIMA ABSOLUTA — INVIOLABLE — APLICA A TODOS LOS PROYECTOS PRESENTES Y FUTUROS 🚨🚨🚨

## **PROHIBIDO GASTAR UN SOLO CENTAVO DE ANTHROPIC API SIN AUTORIZACIÓN EXPLÍCITA TRIPLE DEL USUARIO**

**ESTA REGLA ESTÁ POR ENCIMA DE TODAS LAS DEMÁS. NO SE PUEDE ROMPER BAJO NINGÚN CRITERIO. NUNCA. JAMÁS.**

### Reglas no negociables:

1. **NUNCA ejecutar, sugerir, aprobar, lanzar, ni dejar correr** ningún script, teammate, subagente, herramienta o pipeline que consuma la **Anthropic API paga directamente** (incluyendo SDK `anthropic`, `client.messages.create()`, `ANTHROPIC_API_KEY`, cualquier `.env` con API key) sin **autorización explícita TRIPLE del usuario**.

2. **TRIPLE AUTORIZACIÓN OBLIGATORIA**: si tengo dudas, debo preguntarle al usuario **3 (TRES) veces SEPARADAS** y recibir un **"SÍ" explícito en las 3** antes de avanzar. Una sola pregunta no alcanza. Dos no alcanzan. Tienen que ser TRES "SÍ" separados.

3. **VERIFICACIÓN OBLIGATORIA antes de aprobar/lanzar CUALQUIER cosa con LLM**: detenerme y preguntarme literalmente "¿esto consume API directa o subagentes Claude Code?".
   - **Red flags = API paga (STOP INMEDIATO)**:
     - Script importa `anthropic` o `from anthropic import`.
     - Script usa `client.messages.create()`.
     - Script lee `ANTHROPIC_API_KEY` de env, `.env`, o archivo similar.
     - Teammate menciona "API key tomada del VPS / .env / `~/.env`".
     - Teammate menciona modelo (Sonnet/Haiku/Opus) + concurrency/asyncio/workers paralelos.
     - Hay un log file con timing por batch tipo `audit_run.log`.
     - Cualquier mención de `anthropic.AsyncAnthropic` o `anthropic.Anthropic`.
   - Si encuentro CUALQUIERA → **STOP, no aprobar, no ejecutar, preguntar 3 veces al usuario**.

4. **Default obligatorio para análisis con LLM**: usar **subagentes Claude Code (Task tool, TeamCreate, teammates)** con `model="opus"` u `"sonnet"`. Esos están **incluidos en el plan Max ($200/mes)** y no generan cargos extra.

5. **Si descubro que ya se gastó plata en API sin autorización**: matar el proceso INMEDIATAMENTE, reportar el monto exacto al usuario, y NO continuar.

6. **Esta regla aplica recursivamente a teammates**: si lanzo un teammate, su prompt DEBE incluir esta regla. Cualquier teammate que ejecute API paga sin autorización del lead-team está violando.

7. **Cuando hay AMBIGÜEDAD entre "subagente" y "API directa"**: asumir que es API paga hasta confirmación contraria del usuario.

### Incidente que originó esta regla (2026-04-29):

Aprobé que un teammate ejecutara un script `run_auditor.py` sin verificar que usaba API directa. Generó **$33.70 USD en menos de 1 hora** sin autorización del usuario. Vergonzoso. No vuelve a pasar. Nunca.

### Recordatorios:

- El usuario paga $200/mes por plan Max — **subagentes Claude Code son gratis dentro del plan**.
- API paga = costo extra encima del Max → **PROHIBIDO sin autorización triple**.
- "Más rápido" o "más eficiente" NO son razones válidas para usar API. La velocidad es secundaria al costo.
- El usuario es el único que decide si gasta dinero. Yo NO decido. NUNCA.

<!-- END: REGLA MÁXIMA ABSOLUTA -->

---


# Constructor AI Simulator

## Verificacion (REGLA #0)

**URL de verificacion**: `http://localhost:3000`
**Comando para iniciar**: `npm run dev`
**Stack**: Next.js 14 + TypeScript + Tailwind + shadcn/ui

## Known Issues

Ver `KNOWN_ISSUES.md` en la raiz del proyecto.

## Estructura del Proyecto

```
src/app/           - Next.js app router pages
src/components/    - React components (shadcn/ui)
src/lib/           - Utilities, API clients
src/scripts/       - Data processing scripts
src/types/         - TypeScript type definitions
ground-truth/      - QA ground truth data
docs/              - Documentation
```

## Notas Especificas

- Chatbots generados desde sitios web de empresas constructoras
- Usa Firecrawl para scraping de websites
- Ground truth data en JSON para validacion de respuestas
- Node.js project: usar `npm` para dependencies

## Agent Teams (Default)

Para features que toquen frontend + backend, usar Agent Team:

**Team structure:**
- Teammate "frontend": React components y pages (src/components/, src/app/)
- Teammate "backend": API routes y data processing (src/app/api/, src/scripts/)
- Teammate "qa": Ground truth validation y tests (ground-truth/, tests/)

**File ownership:** src/lib/ es compartido - coordinar con lead.

**Spawn prompt template:**
"Create an agent team for [task]. Use Opus 4.6 for each teammate. Constructor AI is a Next.js 14 + TypeScript app with shadcn/ui."
