# Constraints

Last reviewed: 2026-09-13 (v4.6.0 docs pass; floor deliberately lowered for the 4.6 feature batch — see the Measured table)

## Floor (always enforced, no setup required)

- No new suppression comments: `@ts-ignore`, `eslint-disable`, `# noqa`, `# type: ignore`, `nosemgrep`, `gitleaks:allow`
- No unimplemented stubs: `throw new Error("Not implemented")`, `TODO` standing where implementation belongs
  (Empty `catch` is allowed: teardown paths intentionally swallow cleanup errors — codified in `.eslintrc.cjs`.)
- No skipped or deleted tests without a reason in the commit message
- No secrets in source: API keys and tokens come from env vars, `wrangler` secrets, or `.dev.vars` (gitignored); placeholder values (`your_*`, `<...>`) in `*.example` files are fine
- This file does not get weakened to make a change pass. Tightening is silent; any loosening is loud.

## Enforced with numbers

| Dimension | Rule | Checked by | Runs at |
|-----------|------|-----------|---------|
| Lint | Zero errors | `eslint .` | every edit |
| Floor | Zero guard findings | `node scripts/floor-guard.mjs` | every edit, pre-commit |
| Tests | All pass (86 today) | `npm test` | task end |
| Secrets | No secret-shaped strings in the diff (values never printed) | `node scripts/floor-guard.mjs` | every edit |

## Measured, not yet ratcheted further

| Metric | Today | Direction |
|--------|-------|-----------|
| Project coverage (lines, node --test) | 92.0 | floor 91.5 — lowered from 91.8 for the 4.6 feature batch (seven features, mostly client glue and thin handlers); re-raise when /api/auth handlers get unit tests |
| Frontend app assets (public/, excl. vendor) | 144553 B | ceiling 144553 B — raise only with the reason named in the commit |

Both ratchets are checked by `node scripts/check-ratchets.mjs` at task end; the numbers above are the single source of truth the script parses.

## Placement

| Stage | Command | Budget |
|-------|---------|--------|
| Fast (after every edit) | `npm run check:fast` | < 5s |
| Task end | `npm run check:task` | < 90s |
| Review / full | `npm run check:full` (floor scanned against `origin/master`) | minutes |

## Deliberately not installed yet

- `gitleaks` / `osv-scanner` / `semgrep` (security: deps + deep code scan) — add when a third-party dependency beyond `otpauth`/dev tooling lands, or before any public collaboration. The floor guard's secret-pattern pass covers the diff in the meantime.
- `lighthouse` / `axe-core` (performance + accessibility budgets) — the production URL exists; add when the UI starts churning again. Run against `https://cloudflare-v04.luminote-v2.pages.dev`.
- CI — the project has none; `check:full` is the review-time gate until then.
