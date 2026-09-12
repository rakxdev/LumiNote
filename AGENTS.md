# Agent instructions

Read `CONSTRAINTS.md` before writing code. Do not weaken it to make a change pass.

- After every edit: `npm run check:fast` (< 5s).
- Before handing work back: `npm run check:task` (< 90s).
- Review/deep scan: `npm run check:full`.
- Improving a measured number (coverage, asset size) means raising its ratchet in `CONSTRAINTS.md` in the same commit. Loosening a ratchet needs the reason named in the commit message.
- Never push to any remote; commits stay local.
