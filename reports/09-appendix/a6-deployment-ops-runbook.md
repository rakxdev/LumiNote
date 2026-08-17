# APPENDIX F — Deployment & Operations Runbook

- Purpose: consolidate every operational fact about the LumiNote deployment (from docs + repo + audit findings) into one runbook, including incident procedures the repo currently lacks. Read-only — commands are templates for the maintainer.

---

## F.1 CURRENT DEPLOYMENT FACTSHEET

| Item | Value | Source |
|---|---|---|
| Platform | Cloudflare Pages | `CLOUDFLARE_DEPLOYMENT.md` |
| Project name | `luminote-v2` | wrangler.toml:2 |
| Production branch | `cloudflare-v02` | docs + git |
| Live URL | `https://luminote-v2.pages.dev` | docs |
| Static dir | `public/` | wrangler.toml:11 |
| Functions | `functions/api/{token,deepgram-key,grammar}.js` | file tree |
| Local dev | currently broken path (`yarn serve`) | H-10; correct: `wrangler pages dev public` |
| Secrets | `ASSEMBLYAI_API_KEY`, `DEEPGRAM_API_KEY` (dashboard/`secret put`) | docs |
| Deploy method | direct upload via wrangler CLI (per docs); git-integration evidence: none (no Actions) | docs + repo |
| Rollback | not documented; available via CLI (`wrangler pages deployment list/rollback`) | gap |

## F.2 STANDARD OPERATIONS

```bash
# Deploy (documented)
npx wrangler pages deploy public --project-name=luminote-v2 --branch=cloudflare-v02

# Secrets (documented — replace [TOKEN], account id per your account)
npx wrangler pages secret put ASSEMBLYAI_API_KEY --project-name=luminote-v2
npx wrangler pages secret put DEEPGRAM_API_KEY --project-name=luminote-v2

# Local dev (recommended replacement for yarn serve)
printf 'ASSEMBLYAI_API_KEY=...\nDEEPGRAM_API_KEY=...\n' > .dev.vars   # gitignored!
npx wrangler pages dev public --compatibility-date=2024-01-01

# Logs
npx wrangler pages deployment tail --project-name=luminote-v2

# Rollback (undocumented today — now on record)
npx wrangler pages deployment list --project-name=luminote-v2
npx wrangler pages deployment rollback <ID> --project-name=luminote-v2
```

## F.3 FIRST-RUN / ONBOARDING CHECKLIST (new environment)

1. [ ] Clone branch `cloudflare-v02`; `yarn install` (single lockfile decision first — L-09)
2. [ ] Create `.dev.vars` with both keys (never commit)
3. [ ] `npx wrangler pages dev public` → verify mic records with both providers and grammar works
4. [ ] `wrangler pages secret put` both keys for prod
5. [ ] Deploy; smoke: `/api/token` ok, `/api/grammar` ok, record → transcript → copy → export

## F.4 INCIDENT RUNBOOKS

### I-1 The exposed-key incident (ongoing consequence of S-01)

Trigger: any suspicion that the Deepgram key (history-embedded) is used without authorization — e.g., usage spike in the Deepgram console, or simply "the audit says rotate".

1. Deepgram Console → API Keys → delete the legacy key.
2. Create a scoped replacement; `wrangler pages secret put DEEPGRAM_API_KEY`.
3. Delete hardcoded literals (`git grep 2b2fe3bc` must return nothing).
4. Deploy. Verify `curl <url>/api/deepgram-key` (must NOT return a raw key after C-02 fix).
5. Enable GitHub secret scanning + push protection; add gitleaks pre-commit.
6. Post-mortem note in SECURITY.md (one paragraph; no key value in text).

### I-2 Grammar endpoint degradation ("Fix Grammar" suddenly fake-success)

Symptoms: users report corrections doing nothing; `deployment tail` shows 429 from `api.languagetool.org`.

1. Triage: is it shared-IP throttle (multiple users) or our own traffic? Check tail for 429 statuses.
2. Mitigation: temporary feature-flag off client-side grammar button OR accept degraded-but-honest messaging (degraded contract from H-09 fix).
3. Fix: implement chunking + cache (F-02/F-05) or self-host LanguageTool (R-09).
4. If urgent: WAF rate rule to cap our own per-IP calls (hardening §4).

### I-3 Recording session dies mid-speech (H-04/C-04 family)

Symptoms: transcript stops growing; mic pill may stay lit.

1. This is expected behavior until the fix lands: provider max-session-duration or auth expiry closes the WS; `onclose` only resets UI.
2. User workaround: click Stop, then Start (restarts a session; text preserved).
3. Permanent fix: H-04/C-04 bundling (handle Termination/error frames + teardown + reconnect affordance).

### I-4 Cloudflare Pages quota/coverage

Symptoms: functions start 5xxing; `deployment tail` shows limits.

1. Count daily invocations; if abnormally high, look for token-churn clients (C-07) or abusers hitting open endpoints (S-07/S-10).
2. Fix loop: mint-on-demand + WAF rate rules; consider KV-based counters (F-02).

### I-5 Security/release cadence (proposal)

- Every deploy after Phase-1: run lint + tier-1 tests + gitleaks (CI yaml in maintainability report §2).
- Tag releases (`v0.2.x`); keep `CHANGELOG.md` starting with the audit's fixed-findings list.

## F.5 MONITORING PROPOSAL (minimal viable)

| Signal | Mechanism | Alert |
|---|---|---|
| Function error rate | `wrangler tail` sampling / Workers analytics dashboard | none (manual) |
| Token mint rate | count 2xx `/api/token` in analytics | spike = churn/abuse |
| Grammar 429 rate | status in function logs | manual |
| Client-side fatal telemetry | **absent today**; proposal: tiny beacon `POST /api/beacon` (capture WS close codes, addModule failures, bufferedAmount peaks) | future |
| Uptime | Cloudflare dashboard + periodic `curl -I /` cron | future |

---

*Appendix to the LumiNote audit. Commands are templates; nothing was executed. Master index: `reports/README.md`.*