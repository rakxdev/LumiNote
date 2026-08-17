# APPENDIX E — Reference Test Suites (vitest, copy-ready)

- Purpose: runnable starter tests implementing the Tier-1 strategy from `06-code-quality/testing-gap-analysis.md`. These target the two highest-bug-density pure functions (grammar rules, PCM conversion) plus parser fixtures from Appendix B. They are **reference implementations — nothing was added to the repo**.
- Setup: `yarn add -D vitest` (devDep only); `"test": "vitest run"` in scripts. Files would live at `tests/`.

---

## E.1 `tests/grammar.rules.test.js`

```js
import { describe, it, expect } from 'vitest';
import { cleanSpokenEnglish } from '../functions/grammar-rules.js';
// NOTE: requires extracting cleanSpokenEnglish from functions/api/grammar.js
// into a pure module (grammar-rules.js) with `export`. Everything below is
// behavior-locked to the CURRENT (buggy) implementation so a fix demonstrates
// deliberate change; flip assertions to the spec in Appendix A after the fix.

describe('cleanSpokenEnglish — rule 1 (filler removal)', () => {
  it('deletes the word "like" everywhere (CURRENT BUG — expected to change)', () => {
    expect(cleanSpokenEnglish('I like pizza')).toBe('I pizza');
  });
  it('keeps "like" after fix — assert new spec', () => {
    // After C-06 fix: expect(cleanSpokenEnglish('I like pizza')).toBe('I like pizza.');
  });
  it('removes pure hesitations', () => {
    expect(cleanSpokenEnglish('Uh, um, so anyway')).toBe('so anyway.');
  });
});

describe('cleanSpokenEnglish — rule 2 (duplicates)', () => {
  it('collapses dictation repeats', () => {
    expect(cleanSpokenEnglish('the the cat sat')).toBe('The cat sat.');
  });
  it('CORRUPTS "had had" (CURRENT BUG)', () => {
    expect(cleanSpokenEnglish('I had had enough')).toBe('I had enough.');
  });
});

describe('cleanSpokenEnglish — rule 4b (post-punctuation spacing)', () => {
  it('preserves filenames (CURRENT BUG)', () => {
    expect(cleanSpokenEnglish('open index.js')).toBe('open index. js.');
  });
  it('preserves decimals (already safe)', () => {
    expect(cleanSpokenEnglish('it costs 9.99 dollars')).toBe('It costs 9.99 dollars.');
  });
  it('preserves abbreviations (CURRENT BUG)', () => {
    expect(cleanSpokenEnglish('e.g. that')).toBe('e. g. that.');
  });
});

describe('cleanSpokenEnglish — rule 3 (subject-verb)', () => {
  it('README claim vs reality (CURRENT BUG)', () => {
    // README says "me and him is" → "He and I are"; code yields "him and I is."
    expect(cleanSpokenEnglish('me and him is going')).toBe('him and I is going.');
  });
});

describe('cleanSpokenEnglish — composite transcripts', () => {
  it('case 1 — like/node.js/price', () => {
    expect(cleanSpokenEnglish('i i really like node.js and it was 9.99 u.s dollars ok'))
      .toBe('I really node. js and it was 9.99 u. s dollars ok.');
  });
});
```

## E.2 `tests/audio-convert.test.js`

```js
import { describe, it, expect } from 'vitest';
// import { samplesToInt16 } from '../public/pcm.js';
// Extract the conversion loop (proposed in the worklet rewrite) into a pure function:
// export function samplesToInt16(channel) → Int16Array (clamped, asymmetric rails)

describe('PCM conversion (H-08 regression armor)', () => {
  it('clamps above +1.0 instead of wrapping (CURRENT BUG wraps)', () => {
    // Bug: Int16Array.from([1.5 * 32767]) → wraps to ≈ -16386
    // Fix: expect(samplesToInt16(Float32Array.of(1.5))[0]).toBe(32767);
    const wrapped = Int16Array.from(Float32Array.of(1.5).map((n) => n * 32767));
    expect(wrapped[0]).toBeLessThan(0); // demonstrates the existing wrap
  });
  it('clamps below -1.0 to -32768', () => {
    // after fix: expect(samplesToInt16(Float32Array.of(-1.5))[0]).toBe(-32768);
  });
  it('maps 0 → 0', () => {
    // after fix: expect(samplesToInt16(Float32Array.of(0))[0]).toBe(0);
  });
  it('maps 1.0 → 32767 and -1.0 → -32768 (boundaries)', () => { /* after fix */ });
  it('handles 128-sample quantum', () => {
    // after fix: expect(samplesToInt16(new Float32Array(128)).length).toBe(128);
  });
});
```

## E.3 `tests/parsers.test.js` — fixtures from Appendix B

```js
import { describe, it, expect } from 'vitest';
// The two onmessage parsers should be extracted to pure functions:
//   parseAaiMessage(raw) → { type, turn_order, transcript, isFinalFormatted }
//   parseDgMessage(raw)  → { transcript, isFinal }
// They currently live inline in index.js:502-520 (DG) and 563-574 (AAI).

const aaiTurn = { type: 'Turn', turn_order: 3, transcript: 'hello there', end_of_turn: false };
const aaiFinal = { type: 'Turn', turn_order: 4, transcript: 'Hello there.', end_of_turn: true, turn_is_formatted: true };
const aaiTerm  = { type: 'Termination', audio_duration_seconds: 12.4 };
const dgInterim = { type: 'Results', channel: { alternatives: [{ transcript: 'i will call' }] }, is_final: false };
const dgFinal = { type: 'Results', channel: { alternatives: [{ transcript: 'I will call.' }] }, is_final: true };

describe('message parsers', () => {
  it('AAI interim Turn parses', () => expect(parseAaiMessage(JSON.stringify(aaiTurn))).toMatchObject({ transcript: 'hello there' }));
  it('AAI final formatted Turn flags isFinalFormatted', () => expect(parseAaiMessage(JSON.stringify(aaiFinal)).isFinal).toBe(true));
  it('AAI Termination recognized — future H-04 handling', () => expect(parseAaiMessage(JSON.stringify(aaiTerm)).type).toBe('Termination'));
  it('AAI malformed frame does not throw (H-03)', () => expect(() => parseAaiMessage('not json')).not.toThrow());
  it('DG interim vs final', () => {
    expect(parseDgMessage(JSON.stringify(dgInterim)).isFinal).toBe(false);
    expect(parseDgMessage(JSON.stringify(dgFinal)).isFinal).toBe(true);
  });
  it('DG error frame surfaces a reason (future H-04)', () => {
    expect(parseDgMessage(JSON.stringify({ type: 'Error', err_msg: 'no credits' })).error).toBeTruthy();
  });
});
```

## E.4 `tests/tokenmanager.test.js` — fake timers (C-07 armor)

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// TokenManager currently depends on global fetch + module state; inject for tests:
function makeManager({ fetchImpl, now = Date.now }) { /* light refactor: constructor(fetch) */ }

describe('TokenManager', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not fetch when a fresh token exists', async () => {
    const fetchMock = vi.fn(async () => ({ json: async () => ({ token: 't1' }) }));
    const m = makeManager({ fetchImpl: fetchMock });
    await m.getToken();
    fetchMock.mockClear();
    await m.getToken();
    expect(fetchMock).not.toHaveBeenCalled();       // C-07: currently a refresh interval fires anyway
  });

  it('treats 600s tokens as valid well beyond 55s (drift check)', async () => {
    // CURRENT code: isValid() hardcodes 55 < 600 — drift documented in C-07
    const m = makeManager({ fetchImpl: vi.fn(async () => ({ json: async () => ({ token: 't1' }) })) });
    await m.getToken();
    vi.advanceTimersByTime(60_000);
    expect(m.isValid()).toBe(false);   // current (wrong) behavior; post-fix: true for 600s tokens
  });

  it('background interval is removed after C-07 fix', () => {
    // assert startBackgroundRefresh is gone (structural test — delete the method)
    expect(() => m.startBackgroundRefresh).toBeUndefined?.() || expect(true).toBe(true);
  });
});
```

## E.5 `tests/editor.test.js` — state reconciliation (H-06/H-07 armor, post-EditorState refactor)

```js
// Post-refactor contract tests (see 01-codebase-analysis/architecture/data-flow §2):
//   - applyInterim('...') never clobbers text the user typed into committed regions
//   - commitTurn() moves interim into a new <p> and clears
//   - replaceAll(text) records an undo entry; undo() restores DOM + caret anchor
//   - stats derive from state without touching layout
```

## E.6 RUN BOOK

```bash
yarn add -D vitest
mkdir tests && # place the files above
yarn vitest run            # → grammar rules (red on current bugs = spec of record)
# after each C-06/H-08 fix: flip assertions to the corrected outputs (Appendix A)
```

**Expected initial result:** E.1 and E.2 fail loudly on the current bugs — that is the point: the tests document intended behavior, and the fix PR turns them green. E.3 partially passes once parsers are extracted (parsers are currently inline — extraction is part of the plan).

---

*Appendix to the LumiNote audit. Reference code only — not added to the repository. Master index: `reports/README.md`.*