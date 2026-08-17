# MAINTAINABILITY & TOOLING — LumiNote v02

- **Audit date:** 2026-08-16 · Read-only analysis.

---

## 1. TOOLING INVENTORY — WHAT EXISTS vs WHAT RUNS

| Tool | Present? | Configured? | Actually executed anywhere? |
|---|---|---|---|
| ESLint 8 | dependency | `.eslintrc.js` ✅ | ❌ no `lint` script, no CI |
| Prettier 3 | dependency | ❌ no `.prettierrc` | ❌ |
| Yarn 4 | `yarnPath` + `.yarnrc.yml` | ✅ | ⚠️ but npm lockfile coexists (L-09) |
| Wrangler | via npx (docs) | `wrangler.toml` ✅ | manual deploys only |
| Tests | ❌ none | ❌ | ❌ |
| CI (GitHub Actions) | ❌ | ❌ | ❌ |
| Secret scanning | ❌ | ❌ | ❌ (S-01 consequence) |
| Commit hooks | ❌ | ❌ | ❌ |

**Net effect:** two of five dev-tool dependencies exist but never run; the codebase's actual quality gate is "it deployed once." The `.eslintrc.js` module-aware override block (functions/ as ESM) shows real intent — it just was never wired to a command.

---

## 2. RECOMMENDED MINIMAL TOOLCHAIN (proposal, ~1 hour to adopt)

```jsonc
// package.json scripts (proposed)
{
  "scripts": {
    "dev": "wrangler pages dev public",
    "lint": "eslint public functions server.js tokenGenerator.js",
    "format": "prettier --write .",
    "deploy": "wrangler pages deploy public --project-name=luminote-v2 --branch=cloudflare-v02"
  }
}
```

```yaml
# .github/workflows/ci.yml (proposed)
name: ci
on: { push: { branches: [cloudflare-v02, master] }, pull_request: {} }
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: corepack enable
      - run: yarn install --immutable
      - run: yarn lint
      - run: npx gitleaks detect --no-git --verbose   # secret scan (S-01 prevention)
```

Plus `.prettierrc` (`{ "semi": true, "singleQuote": false }` — matches majority style) and pre-commit via husky or a plain git hook running lint-staged.

---

## 3. REPOSITORY HYGIENE

| Issue | ID | Fix |
|---|---|---|
| Dual lockfiles (npm + yarn) | L-09 | delete `package-lock.json`, document `yarn` in README |
| `svg_icons/` unused assets | L-13 | move to `design/icons-src/` or prune |
| `.wrangler/tmp` stale on disk | L-14 | `git clean -dX .wrangler` locally (cosmetic) |
| Dead `server.js`/`tokenGenerator.js` | H-10 | retire or fix (file analysis §9 recommendation A) |
| Docs drift (missing files in trees, phantom icons.html) | M-11 | regenerate trees; add `reports/` |
| No `.editorconfig` | — | add (10 lines, ends whitespace debates) |
| No CONTRIBUTING/SECURITY.md | — | add; SECURITY.md should note the rotation incident process (S-01 §5) |

---

## 4. DEPLOYMENT & OPERATIONS MATURITY

- **No CI/CD**: manual wrangler deploys (documented). Preview deployments unused (direct-upload flow). Risk: untested deploys, no rollback muscle memory — first rollback will be improvised during an incident.
- **No observability**: client has zero telemetry (an unhandled WS death is invisible to the operator); functions log to `console` (retrievable via `wrangler pages deployment tail` but nothing persists or alerts).
- **No environment strategy**: single production. Even a `staging` branch deploy target would let grammar-rule experiments (C-06 work) be validated safely.
- **Version pinning**: anime.js pinned exact ✅ (3.2.1); wrangler invoked as `npx wrangler` — unpinned major (v3→v4 migrations have broken `pages deploy` flags historically; pin it).

---

## 5. MAINTAINABILITY VERDICT

| Question | Answer |
|---|---|
| Can a new contributor run it locally in 10 min? | ❌ (H-10: broken local path; secrets doc incomplete: `.env.example` lacks DEEPGRAM_API_KEY) |
| Can a contributor lint/format without debate? | ❌ (tools present, unwired) |
| Is a regression in the switch path detectable before prod? | ❌ (no tests — see testing-gap report) |
| Is a leaked secret detectable? | ❌ (no scanning — proven by S-01) |
| Is rollback < 5 min? | ⚠️ possible (`wrangler pages deployment rollback`) but undocumented |
| Bus factor | 1 (single author, MIT, clean README — onboarding materials matter more than usual) |

**Theme:** the project has *individual* discipline (readable code, good docs, secrets in env) but no *institutional* discipline (nothing runs automatically). The gap between the two is exactly where C-01-class issues survive.

---

*Analysis only. Master index: `reports/README.md`.*
