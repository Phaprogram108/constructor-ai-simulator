# STATE — constructor-ai-simulator

**Last updated:** 2026-05-06
**Last action:** ExpoConstruir 2026 readiness pass. WAHA AR-mobile normalization fixed. 64/69 sponsor agents pre-cached in Redis (TTL 72h). Production live and verified.
**Production URL:** https://agenteiagratis.com
**Draft URL:** https://draft.agenteiagratis.com (still tracks `rediseno-abril-2026`, NOT in sync with main)

## Status

🟢 **Production live and stable.** Latest `main` is `19fe2af`. Event-readiness work shipped 2026-05-05 across 9 commits.

## ExpoConstruir 2026 readiness (2026-05-05 → 2026-05-08)

Joaquín visits up to 30 sponsor stands per day from a single IP (his iPad). The site is set up for that traffic pattern.

| Commit | Feature |
|---|---|
| `0ba477c` | Country code selector on the simulator WhatsApp input (23 Americas countries) |
| `61f75ea` | Google Calendar appointment scheduler embedded in qualification form (+ frame-src CSP fix) |
| `e05fb5e` | Sponsor dropdown with 69 ExpoConstruir entries |
| `b67cae3` | WAHA auto-message wired into `/api/leads` (sender = Joaquín's personal +5492235407633) |
| `14fda9b` | Single CTA "Implementar este agente" in demo chat header (removed duplicate banner) |
| `119830e` | Weekly chat rate-limit bumped 20 → 500 for stand traffic |
| `e7dd0f0` | Per-minute and daily rate-limit caps bumped (create 5→200/day, chat 300→1000/day) |
| `5fa67fc` | Calendar iframe forced to `hl=es-419` so the picker renders in Spanish |
| `e4145cf` | Pre-cache pipeline: `/api/simulator/preload`, `/api/sponsor-agent/[slug]`, sessions with TTL 72h |
| `7b5a9d6` | WAHA AR mobile fix: prepend `9` after country code 54 |
| `19fe2af` | WAHA AR fix v2: also strip leading `0` from local-format numbers |

## Pre-cache state (2026-05-05 22:00–23:50)

`scripts/preload-sponsor-agents.mjs` ran against production for the 69 sponsors of `src/data/sponsors-expoconstruir.json`. Result in `test-results/preload-summary.json`:

- **64 cached** (63 OK + 1 SKIP — Demasled was cached during smoke test)
- **5 failed** and will fall back to the on-demand 30-90s flow when chosen in stand:
  - `EmBlue` — fetch failed (site unresponsive)
  - `Fanelli` — `SCRAPING_EMPTY`
  - `Later-Cer` — `SCRAPING_FAILED`
  - `Ricardo Ospital` — `SCRAPING_EMPTY`
  - `Servas Elevators` — `SCRAPING_EMPTY`

Sessions live until 2026-05-08 22:00. To extend, re-run the script (idempotent — it skips already-cached sponsors via `GET /api/sponsor-agent/[slug]`).

## WAHA setup (active in production)

- Container: `waha` on VPS `72.62.106.169:3001` (`devlikeapro/waha`, NOWEB engine).
- Dashboard: `http://72.62.106.169:3001/dashboard` (Basic Auth `admin` / `Docker@108`).
- API key: `Joaquin1234` (header `X-Api-Key`).
- Session: `default` (bound to `+5492235407633`).
- Env vars in Vercel Production: `WAHA_BASE_URL`, `WAHA_API_KEY`, `WAHA_SESSION`, `WAHA_ENABLED=true`.
- Auto-message fires only on `/api/leads` with `type=simulator`, with 24h Upstash rate-limit per number.

## QA artifacts in repo

- `data/sponsors-expoconstruir.md` — research doc for the 69 sponsors (categorized).
- `test-results/expoconstruir-2026/` — agent test conversations (11 sponsors × 5 questions, 10 OK + 1 REVISAR — Brimax had 1 chat error from a network blip, the agent itself was fine).
- `test-results/preload-summary.json` — pre-cache run output.

## Open / next (post-event)

Track for **post 2026-05-08**:
- Revert rate-limit caps to original values (`chat: 300/day`, `create: 5/day`, etc.) to keep abuse posture tight.
- Migrate `src/lib/scraper.ts` from Anthropic Sonnet 4 to OpenAI gpt-5.1 — same model the chat already uses, ~50% cheaper for the structured extraction step. Frozen file, do as a controlled refactor with feature flag.
- Re-categorize sponsors in `data/sponsors-expoconstruir.md`: Demasled responds as LED retail, not as a contractor. Worth re-checking the 11 in `category="approved"` after seeing the test TXTs.

## Branch state

- `main` → at `19fe2af`, serves `agenteiagratis.com`.
- `rediseno-abril-2026` → at `1c442b6`, **not in sync with main** (main is way ahead).
- `expoconstruir-2026` → merged into main on 2026-05-05 (commit `6304306`); branch can be deleted post-event.

## Rollback paths

If something breaks at the event:
- Last known-good: `cd8590e` (the post-launch state from 2026-04-27).
- Revert one feature: `git revert <sha> && git push` from the table above. Each commit is single-purpose for this exact reason.
- Full event rollback (nuclear): `git revert -m 1 6304306 && git push` (reverts the whole expoconstruir-2026 merge in one commit).

## Resuming from iPad

Open `claude.ai/code` (browser, plan Max — no API charges) and paste this STATE.md as context. The repo is at `https://github.com/Phaprogram108/constructor-ai-simulator`. Vercel auto-deploys on push to `main`.
