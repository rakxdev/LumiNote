# ADR-004: D1-Backed Saved Library with Hash-Routed Views

## Status
Accepted

## Date
2026-09-13

## Context
Through v4.2 every artifact LumiNote produced lived in volatile places: the
transcript in `localStorage` drafts, pushed clips in a transient tray that
died with the tab, transcripts nowhere at all once cleared. The product
needed durable notes, clips, and transcripts — a library the user can browse,
pin, copy, and delete from any session. Constraints:

- Zero-account product; the sync path (ADR-003) deliberately stores nothing
  long-term.
- Single-user deployment, but multi-user is a plausible future (a login
  already exists as a concept).
- Recording must survive navigation: separate HTML pages would tear down the
  `AudioContext`/`AudioWorklet` graph on every view change.
- The app already runs on Cloudflare Pages with Functions; storage must be
  server-side (a second device or a cleared browser must see the same data).

## Decision
1. **Cloudflare D1 (SQLite) as the system of record**, bound to the Pages
   Functions as `env.DB` (`wrangler.toml`). Schema in `db/schema.sql`, applied
   once per environment via `wrangler d1 execute`.
2. **One `notes` table for all three kinds** (`note`, `clip`, `transcript`
   enforced by a CHECK constraint) with `pinned`-first, `created_at DESC`
   ordering and a 200 KB per-entry text cap. A separate `app_settings`
   key/value table carries app-level state (used by ADR-005). `user_id`
   defaults to `'local'` now but is part of every query so multi-user later
   is a column-value change, not a migration of shape.
3. **Thin API** under `/api/notes` (list/create) and `/api/notes/:id`
   (get/patch/delete): same-origin, JSON, `no-store`, explicit 405 fallbacks.
   All validation and SQL live in a runtime-free module (`store.js`) so the
   rules unit-test in plain Node — mirroring the worker protocol module.
4. **Hash-routed views inside the single page** (`#/notes`, `#/clips`,
   `#/transcripts`): the router toggles `hidden` on panel containers while
   the audio graph keeps running. Because the toggled panels declare their
   own `display`, each carries an explicit `[hidden] { display: none }`
   re-assertion (the same UA-stylesheet trap `.link-overlay` hit), enforced
   by a contract test.
5. **Capture points where the content is born:** the Save button stores the
   editor text as a note, every fresh clipboard push/receipt is captured as a
   clip (snapshot replays excluded so reconnect catch-up never duplicates),
   and stopping a dictation session auto-saves its transcript.

## Alternatives Considered

### Cloudflare KV
- Pros: Simple, cheap, zero-schema.
- Cons: Key/value only — pinning, filtering by kind, and ordered listing
  become client-side scans; no indexes. Rejected.

### localStorage only
- Pros: No backend at all.
- Cons: Bound to one browser — the phone's clips would never reach the
  desktop, which defeats the point for a two-device product. Rejected as the
  system of record (it remains the draft-resilience layer).

### Separate pages per view (notes.html, etc.)
- Pros: Trivial routing.
- Cons: Every navigation unloads the module graph and the `AudioContext`,
  killing an active dictation. Rejected — hash routing keeps the recorder
  singleton alive.

## Consequences
- **Positive:** Everything the user dictates or pushes survives refreshes,
  cleared browsers, and device swaps; the library is server-side truth.
- **Positive:** The API surface is small and boring (five handlers over one
  table), fully covered by contract tests plus live CRUD verification.
- **Negative:** A D1 database is now part of the deployment (one-time
  `d1 create` + schema apply; documented in the README).
- **Neutral:** Entries are plain text by design — no incremental versions,
  no attachments; the 200 KB cap keeps D1 rows (and the list endpoint)
  snappy.
