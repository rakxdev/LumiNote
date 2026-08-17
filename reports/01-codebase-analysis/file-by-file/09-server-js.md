# FILE ANALYSIS — `server.js` (22 lines) + `tokenGenerator.js` (20 lines)

- **Role (intended):** local development server — static files + an AssemblyAI token route; paired with `tokenGenerator.js` (the token HTTP client) and `package.json`'s `serve` script.
- **Role (actual):** a v01-era leftover that no longer matches the deployed architecture, produces a broken local experience, and drags three npm dependencies behind it.

---

## `server.js` — FULL LISTING (annotated)

```js
const express = require("express");
const path = require("path");
const { generateTempToken } = require("./tokenGenerator");

const app = express();
const PORT = 8000;

app.use(express.static(path.join(__dirname, "public")));   // serves the SPA ✅

app.get("/token", async (req, res) => {                    // ← /token, NOT /api/token
  try {
    const token = await generateTempToken(600);
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate token" });
  }
});

app.listen(PORT, () => console.log(`Server is running at http://localhost:${PORT}`));
```

## FINDINGS

| ID | Finding | Detail |
|---|---|---|
| H-10 | **Route mismatch:** frontend calls `/api/token` (`public/index.js:101`) | Express exposes `/token` → 404 → `fetchToken()` returns null → recording impossible locally. Every other `/api/*` call (`/api/deepgram-key`, `/api/grammar`) 404s too — Deepgram "works" only via the leaked fallback key (C-01), grammar always fails. |
| — | **No functions parity:** the Pages Functions (the real backend) have no Node counterparts | The correct local tool is `wrangler pages dev public` which mounts `functions/` — nothing in README says so (H-10's doc half). |
| — | `dotenv` dependency exists for `tokenGenerator` but no `.env` loading in `server.js` path | Works only because `tokenGenerator.js` calls `require("dotenv").config()` itself. |
| — | HTTP (not HTTPS) local server | `getUserMedia` requires a secure context — localhost is exempt in Chrome/Firefox ✅, but **LAN testing from a phone fails** (no mic on `http://<lan-ip>:8000`). Standard fix: `app.listen` behind `node --env-file` + `mkcert`, or just use `wrangler pages dev` (which offers `--local` over http://localhost only as well — for phone testing, a tunnel like cloudflared is the norm). |
| — | No CORS headers on `/token` | Irrelevant same-origin… except the served frontend and this route *are* same-origin — fine. Moot given the 404 mismatch. |
| L-08 | Keeps `express`+`axios`+`dotenv` in production `dependencies` | Pure local-dev ballast in the deployed artifact's package manifest. |

## `tokenGenerator.js` — FULL LISTING (annotated)

```js
const axios = require('axios');
require("dotenv").config();

async function generateTempToken(expiresInSeconds) {
  const url = `https://streaming.assemblyai.com/v3/token?expires_in_seconds=${expiresInSeconds}`;
  try {
    const response = await axios.get(url, {
      headers: { Authorization: process.env.ASSEMBLYAI_API_KEY },
    });
    return response.data.token;
  } catch (error) {
    console.error("Error generating temp token:", error.response?.data || error.message);
    throw error;
  }
}
module.exports = { generateTempToken };
```

- Duplicates the Cloudflare Function's logic (`functions/api/token.js`) in a second runtime — **two implementations of the same provider call that can drift** (they already differ in error handling: this one throws with upstream body logged; the function returns JSON errors).
- Uses `axios` for a single GET — the whole `axios` dependency exists for this file; native `fetch` (Node ≥18) removes it.
- No `expiresInSeconds` validation (server.js passes 600; fine, but the function accepts any caller value including out-of-range → upstream 4xx).

---

## RECOMMENDATION (NOT APPLIED)

**Option A (recommended) — retire both files:** the Cloudflare Functions are the canonical backend; `wrangler pages dev public` is the local dev story (mounts functions, serves `public/`, reads `.dev.vars` for secrets). Delete `server.js`, `tokenGenerator.js`, and the `express`/`axios`/`dotenv` deps; add `"dev": "wrangler pages dev public"` script; document `.dev.vars` in README.

**Option B — fix for parity:** if a Node server is genuinely wanted (e.g., offline dev without wrangler), add the missing routes and modernize:

```js
app.get(['/api/token', '/token'], async (req, res) => {
  try {
    const r = await fetch(`https://streaming.assemblyai.com/v3/token?expires_in_seconds=600`,
      { headers: { Authorization: process.env.ASSEMBLYAI_API_KEY } });
    if (!r.ok) return res.status(502).json({ error: 'mint failed' });
    res.json(await r.json());
  } catch { res.status(500).json({ error: 'Failed to generate token' }); }
});
// + a minimal /api/grammar proxy + same-origin key refusal (no key endpoint locally)
```

Either way, `package.json` scripts gain `dev`, `lint`, and (per code-quality report) `format`.

---

*Analysis only — no source files modified. Master index: `reports/README.md`.*
