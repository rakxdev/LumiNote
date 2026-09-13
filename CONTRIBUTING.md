# Contributing to LumiNote

Thanks for wanting to contribute. LumiNote is a personal-first project, but
the door is open — the rules below keep it small, fast, and honest.

## Ground rules

1. **Read `CONSTRAINTS.md` before writing code.** It defines the project's
   quality bar (the floor and measured ratchets). Never weaken it to make a
   change pass; loosening a ratchet requires the reason in the commit
   message.
2. **English everywhere** — code, comments, commits, and docs.
3. **Vanilla only.** No frameworks, no build step. New runtime dependencies
   need a strong justification first.
4. **No secrets in source.** Keys come from environment variables,
   `wrangler` secrets, or `.dev.vars` (gitignored).

## Setup

```bash
npm install                     # Node 22 recommended
cp .dev.vars.example .dev.vars  # then fill in your keys
npm run dev                     # Pages app + Functions on localhost
npm run dev:sync                # separate terminal: the relay Worker
npx wrangler d1 execute luminote-db --local --file db/schema.sql   # once
```

## Making changes

- One **logical change per commit** — a complete modification, even when it
  touches many files. A correction of that change gets its own commit.
- Commit messages describe the actual change in English. No "update",
  "fix stuff", or vague one-liners.
- After every edit run `npm run check:fast` (< 5s). Before handing work
  back run `npm run check:task` (< 90s). For review-scale scans:
  `npm run check:full`.
- If verification fails: fix from reasoning first, verify; try a second
  independent approach, verify; only then research (official docs and
  repositories first), apply, and verify again.

## Design & behavior

- The visual world is defined in `DESIGN.md`; stay inside it. New UI
  follows the incumbent patterns (see `/changelog` and `/credits` for the
  standalone-page style).
- Accessibility is not optional: keyboard navigation, labels, contrast.
- Architecture decisions that will outlive the change get an ADR in
  `docs/decisions/`.

## Pull requests

- Branch from `cloudflare-v04`, keep the diff scoped to one logical change.
- The suite must pass (`npm test`) and lint must be clean.
- Deployment is maintainer-only (`npm run deploy:sync`, then
  `npm run deploy`, in that order) and is always followed by live
  verification of the deployed app.
- Never force-push shared branches; never push anyone else's work.

## License

By contributing you agree your contributions are licensed under the MIT
License alongside the rest of the project.
