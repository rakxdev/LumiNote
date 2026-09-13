# Agent instructions

Read `CONSTRAINTS.md` before writing code. Do not weaken it to make a change pass.

## Process contract (applies to every task)

1. **Make changes completely and correctly**, then verify the result — the goal is a working project, not edited files.
2. **Always verify:** apply the change, run the appropriate tests/checks/builds, confirm existing functionality is unbroken, and check for errors, warnings, or regressions. Verify the actual result; never assume.
3. **Handle failures systematically:** identify the cause → first fix from your own reasoning → verify → if still failing, a second independent fix → verify → if still failing, stop repeating and do targeted web research (official docs, repositories, release notes, maintainer docs first) → apply → verify again. Repeat the cycle until resolved or a clearly documented blocker remains.
4. **Versioning:** one Git commit per *logical change* (a complete modification, even across many files); a correction of that change gets its own commit. Messages describe the actual change — never vague ("update", "fix stuff"). Loosening a CONSTRAINTS.md ratchet requires the reason in the commit message.
5. **Never push** unless the user explicitly instructs a push. All work stays local otherwise.
6. **Deployment order:** Change → Verify → Fix if needed → Verify again → Commit → Deploy → **Live verification** of the deployed system (reachable, functionality works, matches the request, no regressions). Never report success from code inspection alone.
7. **Final state:** changes implemented, local verification green, issues resolved or documented, every logical change committed, nothing pushed without authorization, deployed and live-verified, Git status understood.
8. **Communication in English**; be transparent about failures, skipped verification, and incomplete work.

## Commands

- After every edit: `npm run check:fast` (< 5s).
- Before handing work back: `npm run check:task` (< 90s).
- Review/deep scan: `npm run check:full`.
- Improving a measured number (coverage, asset size) means raising its ratchet in `CONSTRAINTS.md` in the same commit.
