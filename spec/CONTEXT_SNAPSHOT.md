# Context Snapshot — ExpoConstruir 2026 Event Mode

**Date:** 2026-05-06 (event opens today)
**Project path:** `/Users/joaquingonzalez/constructor-ai-simulator`
**Reason:** ExpoConstruir 2026 readiness pass shipped. 11 commits on top of the April launch are live.

## Project Summary

Next.js 14 + TypeScript landing page for the **PHA Program** that lets Argentine construction companies generate a custom AI sales agent ("Sofia") from their own website. Live at agenteiagratis.com since 2026-04-25.

Stack: Next.js 14 (App Router) + TS + Tailwind + shadcn/ui + Vercel + Upstash Redis + Vercel Blob + Anthropic + OpenAI + Firecrawl + WAHA (Whatsapp HTTP API on VPS) + Playwright.

## Current Status

🟢 **Production live and stable.** Latest `main` is `19fe2af`. The event-readiness work was 9 feature commits + 2 hotfixes shipped 2026-05-05 / 06.

## What Joaquín is doing today

Walking up to 30 ExpoConstruir stands with an iPad. For each stand:
1. Picks the sponsor from the **"Sponsors ExpoCon"** dropdown (alphabetic, 69 entries) — for 64 of them the agent is pre-cached in Redis with TTL 72h, so it loads instantly. The other 5 (EmBlue, Fanelli, Later-Cer, Ricardo Ospital, Servas Elevators) fall back to the 30-90s on-demand flow.
2. Visitor types their WhatsApp + clicks "Generar mi Agente IA".
3. The lead lands in Sheets + Upstash, and WAHA fires an auto-message from Joaquín's personal `+5492235407633` to the visitor.
4. Visitor chats with the agent. The header has a single CTA "Implementar este agente" → goes to the qualification form.
5. If they qualify, the qualification form embeds a Google Calendar appointment scheduler (in es-419) so they can book a 60-min call.

## Last actions in previous session (2026-05-05)

See `spec/STATE.md` "ExpoConstruir 2026 readiness" table for the full commit-by-commit log.

Headline summary:
- 23-country phone selector with Argentina default.
- Sponsor dropdown + pre-cache pipeline (`/api/simulator/preload`, `/api/sponsor-agent/[slug]`, sessions w/ TTL 72h, maxMessages 1000).
- Calendar embed in es-419 + frame-src CSP fix.
- Single CTA in chat (no more wa.me fallback banner).
- Rate-limit caps bumped (chat 20→500/week, create 5→200/day).
- WAHA auto-message wired with two AR mobile fixes (prepend `9`, strip leading `0`).

## Pre-cache state (as of 2026-05-05 23:50)

Ran `scripts/preload-sponsor-agents.mjs` against production. Result in `test-results/preload-summary.json`:

- 64 cached, 5 failed
- Sessions valid until 2026-05-08 22:00 (TTL 72h)
- Re-run the script to re-extend or to retry failures (it's idempotent, skips already-cached slugs via `GET /api/sponsor-agent/[slug]`)

## Decisions taken — DO NOT re-discuss

(All carried from earlier launches plus this session's decisions.)

1. **Service account approach for Sheets**, not Apps Script. SA email: `pha-scraper-bot@pha-scraper-481115.iam.gserviceaccount.com`.
2. **`valueInputOption=RAW`** for Sheets append — preserves `+` in WhatsApp numbers.
3. **`await dispatchToSheets()`** (not fire-and-forget) — Vercel kills un-awaited promises when the response returns.
4. **VSL hosted in Vercel Blob**, not Loom or YouTube.
5. **5-item cap on prompt lists** is a hard rule.
6. **`prettifyBrandName` runs on every scrape path**.
7. **`isScrapeEmpty` fails fast** with `SCRAPING_EMPTY`.
8. **Suspect title rejection** for SEO spam.
9. **Used `--no-ff` merge** for the event launch (commit `6304306`) so we have a single revertable commit.
10. **Bot reveal in Q8 is acceptable** — current "soy asesora virtual" wording is appropriate.
11. **WhatsApp number on qualification form is Joaquín personal** (`5492235407633`).
12. **Hero headline leads with the offer**.
13. **Sponsors ExpoCon dropdown is the default tab** of SimulatorForm. The other tab is "Ingresar a web" (manual URL).
14. **Agents pre-cached for sponsors have maxMessages=1000 and TTL 72h** — generous because each stand's visitor reuses the same session.
15. **Rate-limit caps bumped for the event window (5/6 → 5/8)** — revert post-event. See task #10.
16. **WAHA AR mobile normalization** lives in `src/lib/waha.ts` only. PhoneInput emits the dial code verbatim; the normalization to E.164 mobile (`549<area><local>` with no leading `0`) happens at send time.
17. **Anthropic Sonnet 4 in `scraper.ts` is what costs money on every agent generation**. Migrating to OpenAI gpt-5.1 is a post-event task (#10).

## Important env vars (set in Vercel Production + Preview)

- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `OPENAI_API_KEY` (Whisper + chat with gpt-5.1)
- `ANTHROPIC_API_KEY` (scraper extraction with Sonnet 4 — biggest cost)
- `FIRECRAWL_API_KEY`
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
- `BLOB_READ_WRITE_TOKEN`
- `LEADS_API_KEY = "pha@108"` (gates `GET /api/leads` and `POST /api/simulator/preload`)
- `WAHA_BASE_URL = http://72.62.106.169:3001`
- `WAHA_API_KEY = Joaquin1234`
- `WAHA_SESSION = default`
- `WAHA_ENABLED = true`

## Frozen / sensitive components

DON'T refactor without explicit ask:
- `src/lib/scraper.ts` — multi-fallback pipeline + Anthropic extraction. Migrating to OpenAI is task #10.
- `src/lib/prompt-generator.ts` — tuned via 4 E2E rounds.
- `src/lib/google-sheets.ts` — JWT auth flow works end-to-end.

## Important context for the next Claude

- Rate-limit middleware blocks `curl` UA on `/api/*`. Use a browser UA when curling endpoints.
- Leads Sheet: `1GVt0MqKgc5psukWdJLMFLdTlLFdOh5wFcaLGcqUElEE`, tab `leads AIAG`, columns `timestamp | whatsapp | website_url | type | lead_id`.
- Apps Script attempts previously failed with HTTP 405 — DO NOT propose Apps Script.
- `PresentationSlides.tsx` still has the old WhatsApp number — NOT rendered in production.
- The user is non-technical for system internals but very sharp on UX. Ships fast, expects honest reports, prefers concise replies.
- **REGLA MÁXIMA active in user's CLAUDE.md**: NEVER use Anthropic API paga directly without explicit triple authorization. Default = Claude Code subagents (Task tool / TeamCreate) that are included in the Max plan.
- Joaquín is on the iPad today. If he comes back through `claude.ai/code` from the browser, he's resuming this exact context.

## How to handle a stand-side issue today (2026-05-06 → 2026-05-08)

For one-line text/copy fixes, easiest path is **github.com → file → ✏️ → commit on main**. Vercel deploys in 1-2 min.

For anything more complex, use `claude.ai/code` from the iPad on the same repo. The plan Max covers it (no API charges).

If a sponsor agent breaks at the stand, the safe action is to switch the visitor to **"Ingresar a web"** tab and put the URL manually — that bypasses the cached session and forces a fresh on-demand generation.

If WAHA stops sending messages, check the VPS:
```
ssh root@72.62.106.169 "docker logs --tail 100 waha 2>&1 | grep -iE 'error|sendText'"
```
WAHA dashboard: http://72.62.106.169:3001/dashboard (admin / Docker@108).

## To continue

Read in this order:
1. This file (CONTEXT_SNAPSHOT.md).
2. `spec/STATE.md` for the current commit-level state and rollback paths.
3. `git log --oneline -15` for the chronology.
4. Open issues in TaskList (in-conversation).

Continue from: **event monitoring**. Hot fixes go straight to `main`. If anything destabilizes prod, run `git revert -m 1 6304306 && git push` to nuke the entire ExpoConstruir branch in one commit.
