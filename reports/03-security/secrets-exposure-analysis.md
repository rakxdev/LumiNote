# SECRETS EXPOSURE ANALYSIS — LumiNote v02

- **Audit date:** 2026-08-16
- **Scope:** Every secret-shaped string in the repository, its exposure surface, blast radius, and remediation — including git-history analysis.

> **TL;DR — A live-format Deepgram API key (`2b2fe3bc…c4e`) is hardcoded in two source files, is (or was until rotation) deployed and served publicly by an unauthenticated endpoint, and is embedded in the permanent git history. The key must be treated as burned and rotated. No other genuine secrets were found; the AssemblyAI flow handles its key correctly.**

---

## 1. COMPLETE SECRETS INVENTORY

| # | Secret-shaped string | Location(s) | Classification | Exposure |
|---|---|---|---|---|
| 1 | `2b2fe3bc8ae482b82b218201b9c15c40a9fcba4e` | `functions/api/deepgram-key.js:13` (fallback), `public/index.js:136` (fallback), full git history | **API credential — Deepgram** (format-verified: 40 lowercase hex, matching Deepgram key shape) | Source, bundle, public endpoint, git history |
| 2 | `ASSEMBLYAI_API_KEY` | `context.env` only (`functions/api/token.js:16`) | API credential — correctly held | Server-side only ✅ |
| 3 | `DEEPGRAM_API_KEY` | `context.env` (`functions/api/deepgram-key.js:13`) | API credential — correctly held, but served onward (see #1 design) | Served to any requester ❌ (design flaw, not a literal leak) |
| 4 | Cloudflare Account ID `25bff71e7781196feac6d6e48b84e54c` | `CLOUDFLARE_DEPLOYMENT.md:25,28,33` | Account identifier — not a credential | Public docs |
| 5 | `ASSEMBLYAI_API_KEY=YOUR_API_KEY` | `.env.example:1` | Placeholder | None ✅ |
| 6 | `CLOUDFLARE_API_TOKEN="[YOUR_TOKEN]"` | `CLOUDFLARE_DEPLOYMENT.md:25-33` | Placeholder | None ✅ |
| 7 | `.wrangler/tmp/**` generated workers | `.wrangler/tmp/pages-*/functionsWorker-*.js` | Build artifacts of the functions above (contain the same fallback literal baked in) | Local disk only (gitignored) — note: `grep` confirms the literal appears in all three `functionsWorker-*.js` copies |

Verification performed for #1: format matches Deepgram's documented 40-hex-char API key format; it is used successfully as a WS subprotocol credential in the Deepgram branch (`public/index.js:482`) per the demo-derived pattern. **No live API call was attempted with it during this audit** (deliberately — using a found credential would itself be unauthorized access).

---

## 2. EXPOSURE SURFACE MAP FOR THE DEEPGRAM KEY

```
                       ┌─────────────────────────────────────────────┐
                       │  1. GIT HISTORY (permanent)                 │
                       │  every commit since introduction            │
                       └─────────────────────────────────────────────┘
                                        │
              ┌─────────────────────────┼──────────────────────────┐
              ▼                         ▼                          ▼
   ┌────────────────────┐   ┌────────────────────┐    ┌────────────────────┐
   │ 2. PUBLIC REPO     │   │ 3. DEPLOYED BUNDLE │    │ 4. LIVE ENDPOINT   │
   │ github.com/...     │   │ luminote-v2        │    │ GET /api/deepgram- │
   │ branch cloudflare- │   │ pages.dev serves   │    │     key            │
   │ v02 source         │   │ index.js verbatim  │    │ {key: "..."} ACAO:*│
   └────────────────────┘   └────────────────────┘    └────────────────────┘
              │                         │                          │
              └─────────── Anyone with a browser/curl gets the key ─┘
```

Path #4 is the most dangerous single path because it requires zero technical skill: open the deployed site, DevTools → Network → the `deepgram-key` response is right there. Even with the env var set (normal path), the endpoint still returns **the env var's value** — i.e., the real production key — so path #4 exposes whichever key is configured.

---

## 3. BLAST RADIUS (what the key unlocks)

Per Deepgram's key model and documentation ([Creating additional API keys](https://developers.deepgram.com/docs/create-additional-api-keys)):

- **Streaming transcription** (`wss://api.deepgram.com/v1/listen`) — the primary product. An attacker can run unlimited concurrent streams (README touts "100 concurrent streams" on the $200-credit free tier).
- **Pre-recorded transcription** (`https://api.deepgram.com/v2/listen`) — bulk jobs.
- **Project read/modify endpoints** — scope-dependent; the default key created with a project typically carries broad permissions unless scoped keys were used.
- **Billing exhaustion** — credits drained; if a card is attached, overage.
- **Reputation/abuse** — usage tied to the owner's project; abusive patterns (scraping volume, ToS-violating content) attach to the victim's account.

Because the fallback literal is in **git history**, blast radius persists even after the current tree is cleaned: `git log -S 2b2fe3bc` locates it in any clone. **Rotation is the only complete remediation.**

---

## 4. WHY THIS HAPPENED (root-cause chain)

1. **Demo-pattern copy.** Deepgram's official browser examples authenticate the raw key over a WS subprotocol — correct for a local demo with *your own* key, wrong for a public multi-tenant deployment. The AssemblyAI branch of this very app (built first, per git history) uses the right pattern; the Deepgram integration (commit `4bd9965`) imported the wrong one.
2. **Fallback-as-feature.** The literal was added so the app "works even if you forget to set the env var" — converting a config mistake into a permanent secret leak. This is the classic "default credential" antipattern.
3. **Client mirror.** The same literal was pasted into `public/index.js` as a fetch-failure fallback, doubling the surface into every shipped bundle.
4. **No secret scanning.** No pre-commit hook, no CI secret scanner (gitleaks/trufflehog/GitHub secret scanning alert), so nothing flagged the 40-hex string that sits in plain sight.

---

## 5. REMEDIATION PLAYBOOK (ordered, with verification steps)

### Step 1 — Rotate (mandatory, today)

1. Deepgram Console → the project → API Keys → **deactivate/delete** the exposed key.
2. Create a replacement key, minimum scope (e.g., streaming + prerecorded usage, no key-management scope if separable).
3. Set it as the Pages environment variable/secret: `npx wrangler pages secret put DEEPGRAM_API_KEY --project-name=luminote-v2`.
4. Redeploy (`npx wrangler pages deploy public --project-name=luminote-v2 --branch=cloudflare-v02`).
5. **Verify:** `curl https://luminote-v2.pages.dev/api/deepgram-key` must return the *new* value only via env (or, after Step 3, must not return a key at all); old key used against `wss://api.deepgram.com` must fail auth.

### Step 2 — Remove literals (same day)

- Delete the `|| "2b2fe3…"` fallback in `functions/api/deepgram-key.js:13`.
- Delete the `return "2b2fe3…"` fallback in `public/index.js:136` (replace with an explicit error path — see C-01 recommended code).
- Commit message should **not** contain the key. Verify with `git grep 2b2fe3bc` returning nothing in the new tree.

### Step 3 — Fix the endpoint design (this week)

Replace raw-key vending with grant-token minting (full code in bug report C-02): function calls `POST https://api.deepgram.com/v1/auth/token` with the server-held key, returns the 30-second JWT only. Client uses the JWT for the WS subprotocol. Verified feasible per Deepgram's [token-based auth guide](https://developers.deepgram.com/guides/fundamentals/token-based-authentication) and [JS SDK guidance](https://github.com/deepgram/deepgram-js-sdk) (grant call must be server-side due to CORS; WS consumes the token directly; established connections survive token expiry).

### Step 4 — History hygiene (optional after rotation)

Once rotated, history scrubbing is redundant *for this key*, but establishes the practice. Options:
- `git filter-repo --replace-text <(echo '2b2fe3bc8ae482b82b218201b9c15c40a9fcba4e==>REDACTED')` + force-push + all-contributor reclone; or
- accept the stale key in history (it's dead post-rotation) and add scanning to prevent recurrence.

### Step 5 — Prevention (ongoing)

- Add a pre-commit secret scan: `gitleaks protect --staged` (or trufflehog).
- Enable GitHub secret scanning + push protection on the repo (free for public repos; detects provider-format keys including Deepgram's).
- Adopt the rule enforced in review: **fallbacks may only ever be empty/`null` + loud error, never an embedded credential.** The audit found the same pattern shape (silent fallback) in three other places where it masks misconfiguration (`getDeepgramKey` fetch fallback, `checkLanguageTool` `return text` fallback, `ws.send` try/catch swallows) — same mindset, different severity.

---

## 6. GIT-HISTORY ARCHAEOLOGY (evidence trail)

```
$ git log --oneline -S "2b2fe3bc8ae482b82b218201b9c15c40a9fcba4e" --all
```

- Introduced with commit `4bd9965` ("feat: Integrate Deepgram Nova-3 engine, update header badge to v02, and add /api/deepgram-key endpoint") — the server-side literal.
- The client-side literal (`public/index.js:136`) rides in the same commit's client file.
- Present on branches: `cloudflare-v02` (current), and any branch forked after that commit; the deployed production branch per `CLOUDFLARE_DEPLOYMENT.md` is `cloudflare-v02` itself.
- Additional baked-in copies exist in `.wrangler/tmp/pages-{3BwSNd,o7alqq,ZxJ7UK}/functionsWorker-*.js` (local build artifacts; gitignored, listed for completeness).

---

## 7. WHAT *NOT* TO DO

- **Do not** simply delete the fallback and push — the key remains valid and in history.
- **Do not** "test" the key against Deepgram to "check if it's real" — that is unauthorized use of a credential, even one found in your own audit. Rotation makes verification unnecessary.
- **Do not** rotate into the same repo by pasting the new key anywhere (including `wrangler.toml` vars, which are plaintext) — secrets go through `wrangler pages secret put` / dashboard only. Note: current `wrangler.toml` keeps `vars = { }` empty — correct.
- **Do not** rely on Cloudflare Access/mTLS on `/api/*` as the sole mitigation — the static bundle still ships the client literal.

---

*Analysis only — no source files, secrets, or infrastructure settings were modified, and no exposed credential was used. Master index: `reports/README.md`.*
